// src/lib/agent/task-parser.ts
// E15.5 — deterministic natural-language → ShoppingTask parser (Arabic + English).
// A real shopping task ("مكيف لغرفة 30 متر في الرياض، هادئ وموفر للكهرباء، تحت 4000")
// is turned into a structured task the deterministic Decision Agent consumes. NO
// LLM — pure keyword/number extraction, so it is reproducible and testable. Unknown
// beats incorrect: fields it cannot extract stay undefined (never guessed).
import type { ShoppingTask } from "./decision-engine";
import { extractSpecsFromTitle } from "@/lib/scraping/config/spec-configs";

/**
 * Arabic-Indic (٠-٩) and Eastern-Arabic/Persian (۰-۹) digits → ASCII.
 *
 * MEASURED FAILURE this fixes: «ابي مكيف رخيص لغرفه ٤٠ متر» asked the shopper for the room
 * area they had just written in the same sentence. Every numeric regex in this file uses
 * `\d`, which matches ASCII ONLY — so a shopper typing on an Arabic keyboard had their room
 * size, their budget and their storage size all silently dropped, and the assistant then
 * asked for them. Nothing errored; the fields simply came back undefined.
 *
 * This is the third time Arabic-Indic digits have produced a false result in this codebase
 * (CHECKPOINT #17 recorded 18 "price missing" failures with the same cause). Normalising at
 * the single entry point is why it cannot recur per-regex.
 */
const ARABIC_INDIC = /[٠-٩۰-۹]/g;
const asciiDigits = (t: string) =>
  t.replace(ARABIC_INDIC, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });

// Arabic-Indic thousands separator (٬) and the Arabic decimal mark (٫) reach us from
// copy-pasted prices; strip the grouping mark so «٤٬٠٠٠» reads as 4000, not 4.
const norm = (t: string) => asciiDigits((t || "").toLowerCase()).replace(/٬/g, "");

// A stated burner/zone count — «4 عيون», «5 شعلات», "5 burners" — held as a reliable cooker/range
// signal with zero counterexamples across a multi-retailer taxonomy audit (2026-08-19, Noon/
// Amazon.sa/Almanea/Shaker/LG). See `parseCategory`'s own cooker branch for the full reasoning.
const COOKER_BURNER_SIGNAL = /\d+\s*(?:عي(?:و|ي)ن|شعل[ةه]?ات?)|\d+[\s-]?burners?\b/i;
// MEASURED LIVE (production, 2026-08-19, same session): bare «طباخ» is ALSO the head noun of
// small single-pot/hotplate appliances in Tawveeri's own catalog ("طباخ كهربائي مزدوج الوعاء",
// "طباخ الأشعة تحت الحمراء المحمولة") — a query naming one of these should not be routed to the
// `cooker` TPS category, which is exclusively full-size freestanding ranges. Mirrors
// `route.ts`'s own `hasStrongCookerSignal` exclusion.
const SMALL_COOKER_EXCLUSION = /متنقل|محمول|قدر|طنجر[ةه]|وعاء|الاشع[ةه] تحت الحمراء|بالتفريغ|sous.?vide/i;

function parseCategory(x: string): string | null {
  if (/مكيف|تكييف|air ?condition|\bac\b|split ac/.test(x)) return "air_conditioner";
  // Plural/ه-spelling stems (measured 2026-08-04): «شاشات», «ثلاجات», «غسالات» classified
  // as NO category, so plural browse queries lost routing while their singulars worked.
  // «تي في» (2026-09, multi-category Amazon expansion): the Arabic phonetic transliteration
  // of "TV" — «smart tv»/«\btv\b» above only matched LATIN-script "tv", not this common
  // Arabic spelling («سمارت تي في» etc.). Unambiguous — "تي في" names television only.
  if (/تلفزيون|تليفزيون|شاش[ةه]|شاشات|television|\btv\b|smart tv|تي في/.test(x)) return "tv";
  if (/تابلت|ايباد|آيباد|ipad|tablet|جالكسي تاب|galaxy tab|matepad/.test(x)) return "tablet";
  // «حاسوب»/«حاسوب محمول» (formal "computer"/"portable computer") and «كمبيوتر» added
  // 2026-08-10 (reopened mission, found via my own adversarial follow-up to case 3): these
  // were already listed as laptop synonyms in /api/search/route.ts's OWN category list
  // (CATEGORY_QUERY_TERMS) but never here — this file's classifier not knowing what a SIBLING
  // classifier already knows is the exact same "silently drifted, independent classifiers"
  // defect this whole reopened mission is about, just one synonym further.
  //
  // «حاسب» (2026-08-10, founder's own real-iPhone RETEST, second reopening — his own explicit
  // adversarial phrase «ابغى حاسب محمول للدراسه»): a genuinely distinct, common Arabic word for
  // "computer" (classical root, vs. «حاسوب»'s more modern coined form) — MEASURED to not match
  // any of the three synonym lists this codebase already had. Negative lookahead `(?!ة)`
  // excludes «حاسبة» ("calculator", a real but unrelated device sharing the same root) so a
  // calculator search is never silently reclassified as a laptop request.
  if (/لابتوب|لاب توب|حاسوب|حاسب(?!ة)|كمبيوتر|laptop|notebook|macbook/.test(x)) return "laptop";
  if (/سماعة|سماعات|headphone|earbuds|airpods|speaker|مكبر صوت/.test(x)) return "audio";
  // MEASURED DEFECT (2026-08-10, D→E mission Part F — re-verification sweep after the
  // English routing fix): bare "phone" was never recognized at all — only "smartphone",
  // "iphone", and "galaxy s" — even though "phone" is at least as common in English shopping
  // queries. `\bphone\b` is boundary-safe: it does not fire inside "headphone"/"earphone"/
  // "microphone" (no boundary between the preceding letter and "phone" in those words).
  //
  // CHECKED BEFORE "camera" (2026-08-10, FINAL SEMANTIC INTELLIGENCE mission, MEASURED
  // bilingual-parity defect — scripts/waffar-eval/parity.ts case P02): "I need a phone with
  // strong camera and battery under SAR 3,000" resolved to category="camera" instead of
  // "mobile", because the (then-earlier) camera check matched the FEATURE word "camera"
  // before this device-noun check ever ran — a phone-shopping sentence that happens to
  // mention its own camera as a feature is far more common than a bare "camera" standalone
  // shopping request, and a device noun (جوال/هاتف/phone) is a stronger, more specific signal
  // than a feature adjective. The Arabic side never had this collision ("تصويره" — its
  // camera/photography, possessive form — never matches the "كاميرا" category regex at all),
  // which is exactly what made this an ENGLISH-ONLY bilingual-parity bug, not a general one.
  // «آيفون» (madda-alef spelling) added alongside «ايفون» (2026-09, multi-category Amazon
  // expansion — smartphone is now an approved campaign category): MEASURED during the
  // Amazon Campaign V1 delivery-gap investigation as a real, common gap — this file's own
  // tablet regex two lines above already lists both «ايباد»/«آيباد»; mobile never got the
  // matching madda-alef variant. Narrow, additive, same pattern already proven safe here.
  if (/جوال|هاتف|ايفون|آيفون|iphone|smartphone|galaxy s|\bphone\b/.test(x)) return "mobile";
  if (/كاميرا|camera|dslr|mirrorless|eos/.test(x)) return "camera";
  // Appliances — ORDER MATTERS: dishwasher (غسالة صحون) before washing_machine (غسالة);
  // air_fryer (قلاية) and coffee_maker (specific) before generic checks.
  if (/غسال[ةه] صحون|غسالات صحون|غسالة أطباق|dishwasher|dish washer/.test(x)) return "dishwasher";
  if (/مايكرويف|ميكروويف|ميكرويف|microwave/.test(x)) return "microwave";
  // «اير فراير»/«ايرفراير» (2026-09, multi-category Amazon expansion): the Arabic phonetic
  // transliteration of "air fryer" (spaced and unspaced) — `air ?fryer` above only matched
  // LATIN script. Bare «قلاية» is deliberately NOT added here: Amazon.sa's own taxonomy files
  // «قلاية»/«مقالي» primarily under cookware FRYING PANS, not the air-fryer appliance
  // (verified live against amazon.sa during the multi-category destination-node audit) — a
  // bare "قلاية" query is genuinely ambiguous pan-vs-appliance, so it stays unclassified
  // rather than risk a wrong-category match. A brand alone appended to bare «قلاية» («قلاية
  // نينجا»/«قلاية فيليبس») does not resolve that same ambiguity, so those stay unclassified too.
  if (/قلاية هوائية|قلايه هوائية|air ?fryer|اير فراير|ايرفراير|قلاية بدون زيت/.test(x)) return "air_fryer";
  if (/منقي هواء|منقّي هواء|air purifier|air cleaner/.test(x)) return "air_purifier";
  // «روبوت تنظيف» (2026-09): a bare "cleaning robot" description is, in Saudi retail usage,
  // overwhelmingly a robot vacuum — unlike a bare BRAND name (see «دايسون» below), a
  // functional description naming the cleaning task stays in the floor-care family. «دايسون»
  // (Dyson) is deliberately NOT added: Dyson sells vacuums, hair dryers/stylers, air
  // purifiers and fans — a bare brand mention cannot safely resolve to one device category,
  // exactly the ambiguity this classifier must never guess through.
  if (/مكنسة|مكنسه|vacuum|hoover|روبوت تنظيف/.test(x)) return "vacuum";
  // «مكينة قهوة» (common dialect spelling, missing alef after م), «آلة قهوة» (formal
  // synonym), «نسبريسو»/«دولتشي قوستو» (2026-09): Nespresso and Dolce Gusto are single-
  // category capsule-coffee-machine brands (unlike Dyson/Ninja, they sell nothing outside
  // coffee machines/pods) — a bare brand mention safely resolves to coffee_maker here.
  if (/ماكينة قهوة|مكينة قهوة|آلة قهوة|صانعة قهوة|coffee maker|coffee machine|espresso|اسبريسو|إسبريسو|nespresso|نسبريسو|دولتشي قوستو/.test(x)) return "coffee_maker";
  // «كاتل» (2026-09): the Arabic phonetic transliteration of "kettle" — unambiguous, names
  // only the electric kettle.
  if (/غلاية|غلايه|electric kettle|\bkettle\b|كاتل/.test(x)) return "kettle";
  if (/محمصة|محمصه|toaster/.test(x)) return "toaster";
  // «نيوتربوليت» (NutriBullet, 2026-09): a single-category personal-blender brand (unlike
  // Dyson/Ninja) — a bare brand mention safely resolves to blender here. «سموثي» ("smoothie")
  // is deliberately NOT added: it names a drink/use-case, not a device, and could equally
  // resolve to grocery/ready-made-drink or cup/bottle listings — not a safe device signal.
  if (/خلاط|blender|نيوتربوليت/.test(x)) return "blender";
  // COOKER, checked BEFORE oven (2026-08-19, founder taxonomy audit, multi-retailer research —
  // Noon/Amazon.sa/Almanea/Shaker/LG all confirmed): a full-size freestanding cooker/range
  // (cooktop + oven cavity in one floor-standing unit) is a PHYSICALLY DIFFERENT product from a
  // built-in or countertop oven — but the market, including LG's own official Arabic product
  // title («فرن كهربائي | 178 لتر | 5 شعلات»), routinely calls a full range «فرن» too. Explicit
  // «طباخ»/«بوتاجاز»/"cooker"/"range" is unambiguous cooker intent on its own. A stated burner
  // count («4 عيون», «5 شعلات», "5 burners") alongside «فرن»/"oven" is the one signal that held
  // with zero counterexamples across every retailer studied — a bare oven cavity never has a
  // burner count; a cooker/range always does. `cooker` was already a real, populated TPS
  // category (ADR-254) — this is the query-routing half that was missing (it was previously
  // 100% unreachable: not in this parser, not in `CATEGORY_KEYS`, so even the LLM semantic
  // fallback could never return it).
  if (COOKER_BURNER_SIGNAL.test(x) && (/فرن|طباخ|بوتاجاز|\boven\b|\bcooker\b/.test(x))) return "cooker";
  if (!SMALL_COOKER_EXCLUSION.test(x) && /طباخ|بوتاجاز|\bcooker\b|cooking range|gas range|electric range|freestanding range/.test(x)) return "cooker";
  // «بلت ان» (2026-08-19, founder taxonomy audit — «فرن بلت ان كهربائي»): the everyday
  // transliterated-English colloquial spelling of "built-in" — «فرن مدمج» is the formal MSA
  // form already listed; the deterministic parser silently missed the colloquial one (this
  // query only resolved via the LLM semantic fallback, one call it should not have needed).
  if (/فرن كهربائي|فرن غاز|فرن مدمج|فرن بلت ?ان|built-?in oven|electric oven|gas oven/.test(x)) return "oven";
  if (/ثلاج|refrigerator|fridge|freezer/.test(x)) return "refrigerator";
  if (/غسال|washing machine|washer|نشاف|dryer/.test(x)) return "washing_machine";
  return null;
}

/**
 * True when the text resolves to `oven` via a BARE, unqualified phrasing («فرن كهربائي»/«فرن
 * غاز» — no burner count, no built-in qualifier). Multi-retailer taxonomy audit (2026-08-19:
 * Noon, Amazon.sa, Almanea, Shaker, LG's own official site) found this exact bare phrasing is
 * genuinely ambiguous in the SOURCE data, not just in Tawveeri's own parsing — LG's own
 * official Arabic product title for a full 5-burner, 178L freestanding range reads «فرن
 * كهربائي», identically to how a built-in oven is named. A stated burner count already resolves
 * to `cooker` (see the cooker branch above) and «بلت ان»/«مدمج» is already explicit — both
 * return false here; only the genuinely undecided phrasing returns true. Used by the search UI
 * to offer a one-tap disambiguation instead of silently guessing (founder decision,
 * 2026-08-19) — never wired into `decide()`/`shouldAsk()`, which only fire for advisory-routed
 * queries; a bare category browse like this never reaches that mechanism.
 */
export function isAmbiguousBareOvenQuery(text: string): boolean {
  const x = norm(text);
  if (parseCategory(x) !== "oven") return false;
  // The built-in qualifier does not have to sit immediately next to «فرن» ("فرن كهربائي مدمج"
  // is exactly as explicit as "فرن مدمج") — checked anywhere in the sentence, not as a fixed
  // adjacent phrase.
  return !/مدمج|بلت ?ان|built-?in/.test(x);
}

/**
 * Fuel/power type, stated explicitly ("فرن غاز", "فرن كهربائي", "gas oven", "electric
 * oven"). Generic across any category — not oven-specific: any config-factory appliance
 * whose `APPLIANCE_META` declares a `gas` feature flag reads this the same way. A HARD
 * constraint (the shopper named the type), unlike `priorities` — see decideAppliance's
 * fuel-type gate in decision-engine.ts: PRICE/PRIORITIES MAY RANK eligible candidates,
 * a STATED fuel type MUST exclude a non-matching one, the same rule `applyBudgetGate`
 * already enforces for a stated budget.
 */
function parseFuelType(x: string): "gas" | "electric" | undefined {
  if (/غاز|\bgas\b/.test(x)) return "gas";
  if (/كهربائي|كهربائية|\belectric\b/.test(x)) return "electric";
  return undefined;
}

/**
 * AC type, stated explicitly ("شباك"/"سبليت"/"مخفي"/"كاسيت"/"دولابي" or their English
 * equivalents). MEASURED DEFECT this fixes (Waffar decision-engine audit): `decideAc()` had
 * NO field to read a stated AC type from at all — a shopper naming "شباك" only confirmed the
 * CATEGORY (air_conditioner) via `parseCategory` above, and the word's own meaning vanished;
 * every AC sub-type produced an identical ranking.
 *
 * SAME canonical vocabulary `scripts/tps-plugins/ac/parser.ts` extracts into
 * `canonical_products.attributes.ac_type` (which `deriveAcDna` in decision-engine.ts reads
 * back) — reusing it here, rather than inventing a second list, is what lets a stated request
 * line up with the stored value with no translation layer to drift out of sync.
 */
const AC_TYPE_PATTERNS: [string, RegExp][] = [
  ["window", /شباك|window/],
  ["portable", /نقال|portable/],
  ["evaporative", /صحراوي|evaporative|air cooler/],
  ["cabinet", /دولابي|cabinet|floor standing/],
  ["cassette", /كاسيت|cassette/],
  ["ducted", /مخفي|ducted|ceiling/],
  ["split", /سبليت|جداري|split/],
];

function parseAcType(x: string): string | undefined {
  for (const [type, re] of AC_TYPE_PATTERNS) if (re.test(x)) return type;
  return undefined;
}

/**
 * AC compressor tech, stated explicitly ("انفرتر" vs "غير انفرتر"/"non-inverter"/"on/off").
 * MEASURED DEFECT this fixes (same Waffar sub-type audit as `parseAcType`): the word "انفرتر"
 * did not exist ANYWHERE in this file before this fix — not even as a `low_electricity`
 * priority keyword — so "مكيف انفرتر رخيص" produced an IDENTICAL ranking to a bare "مكيف رخيص".
 *
 * The "false" (non-inverter) branch is checked FIRST and deliberately narrow: it mirrors ONLY
 * the explicit vocabulary `scripts/tps-plugins/ac/parser.ts`'s own Patch 1 uses for
 * `technology = "Standard"` ("غير انفرتر"/"non-inverter"/"on/off") — bare «عادي» ("regular") is
 * NOT read as non-inverter, because the ingest parser itself does not commit to that reading
 * (too ambiguous outside AC context to trust as a hard exclusion — «عادي» is one of the most
 * generic adjectives in Arabic). Checking "false" first also matters mechanically: "انفرتر" is
 * a literal substring of "غير انفرتر", so the "true" branch would otherwise fire on a negated
 * mention too.
 */
function parseAcInverterPref(x: string): boolean | undefined {
  if (/on\s*\/?\s*off|أون\s*\/?\s*أوف|غير\s*انفرتر|غير\s*إنفرتر|non[\s-]?inverter/.test(x)) return false;
  if (/انفرتر|إنفرتر|inverter/.test(x)) return true;
  return undefined;
}

/**
 * Fridge configuration, stated explicitly ("باب واحد"/"جنب لجنب"/"فرنسي" or English
 * equivalents). SAME canonical vocabulary `scripts/tps-plugins/refrigerator/parser.ts`'s own
 * `extractType` writes to `attributes.fridge_type` — reused here rather than a second list.
 * Deliberately DROPS that function's own "mini|compact|صغيرة|ميني" branch for `single_door`:
 * those words are a fine *display* label on the ingest side, but as a HARD request-side
 * restriction they would wrongly narrow an honest size preference ("ثلاجة صغيرة" — "a small
 * fridge") down to only literally single-door-labelled rows, excluding perfectly good compact
 * top_mount fridges that were never asked to be single-door specifically. `single_door` here
 * only fires on the unambiguous phrasing.
 */
const FRIDGE_TYPE_PATTERNS: [string, RegExp][] = [
  ["french_door", /french\s*door|فرنش|أربعة أبواب|4\s*door|quad/],
  ["side_by_side", /side\s*by\s*side|جنباً|جنبا|باب لباب/],
  ["bottom_mount", /bottom\s*mount|bottom\s*freezer|فريزر سفلي|مجمد سفلي/],
  ["top_mount", /top\s*mount|top\s*freezer|فريزر علوي|مجمد علوي|بابين|2\s*door|double door/],
  ["single_door", /single\s*door|باب واحد|باب مفرد/],
];

function parseFridgeType(x: string): string | undefined {
  for (const [type, re] of FRIDGE_TYPE_PATTERNS) if (re.test(x)) return type;
  return undefined;
}

/**
 * LOCK/KEY REQUIREMENT (Shopper Constraint Truth mission, 2026-09-05 — real incident:
 * «أبي ثلاجة صغيرة وقفلها مهم»). Deliberately NOT a structured, filterable product attribute:
 * a live production audit (`raw_observations.raw_name`, 484 real refrigerators) found
 * "Lock & Key" phrasing genuinely present in real listing titles, but overwhelmingly on ONE
 * provider (Amazon) with low, uneven coverage across the catalog, and absence of the phrase
 * in a title is NOT proof a fridge has no lock (titles are marketing text, not exhaustive spec
 * sheets) — exactly the "unknown beats incorrect" case CLAUDE.md governs. Promoting this to a
 * canonical `attributes.has_lock` boolean would require low-confidence NLP over incomplete,
 * single-provider-skewed text and a new ingestion field — the "do not force it, ship the
 * honest unsupported/verify-yourself behavior first" instruction this mission's own Section 25
 * anticipates for exactly this shape of evidence. So this stays a REQUEST-side signal only:
 * `decideRefrigerator` reads it to disclose, via the existing `reasons.caution()` mechanism
 * (ADR-187 — cautions are NEVER dropped for space, always reach the customer), that Tawveeri
 * cannot verify lock availability — never to filter, never to silently imply satisfaction.
 * Same negative-before-positive check order as `parseAcInverterPref` above, but the negation
 * here is Arabic SUBJECT-FIRST ("القفل مو ضروري" — lock, [is] not necessary), the mirror image
 * of `polarityBeforeMatch`'s before-only window (built for "مو مهم القفل"-shaped sentences) —
 * so this is a small dedicated check rather than a forced fit into the shared priority-negation
 * system, same reasoning `parseAcInverterPref` already uses for its own local negation check.
 */
function parseLockRequirement(x: string): boolean | undefined {
  const LOCK_TERM = /قفل|مفتاح|قابل\s*للقفل|lockable|door\s*lock|key\s*lock/;
  if (!LOCK_TERM.test(x)) return undefined;
  if (/(?:قفل|مفتاح)\S{0,3}\s*(?:مو|مب|مش|غير)\s*(?:ضروري|ضرورية|مهم|مهمة|لازم)|بدون\s*قفل|no\s*lock|without\s*(?:a\s*)?lock/.test(x)) return false;
  return true;
}

/**
 * Washer loading configuration, stated explicitly ("أمامية"/"علوية" or English equivalents).
 * SAME canonical vocabulary `scripts/tps-plugins/washing_machine/parser.ts`'s own
 * `extractType` writes to `attributes.washer_type`.
 */
const WASHER_TYPE_PATTERNS: [string, RegExp][] = [
  ["front_load", /front\s*load|أمامي|تحميل أمامي|فرونت/],
  ["top_load", /top\s*load|علوي|تحميل علوي|توب/],
];

function parseWasherType(x: string): string | undefined {
  for (const [type, re] of WASHER_TYPE_PATTERNS) if (re.test(x)) return type;
  return undefined;
}

/**
 * TV panel technology, stated explicitly ("OLED"/"QLED"/"Mini LED" etc.). SAME canonical
 * vocabulary and ORDER (most specific first) as `scripts/tps-plugins/tv/parser.ts`'s own
 * `extractPanel` writes to `attributes.panel`. The Arabic transliteration branches are matched
 * directly against `x` (already lowercased, ASCII-digit-normalized by `norm()`) rather than
 * through that file's separate `normalizeArabic` helper — this module has no such import, and
 * a typed shopping query is short and rarely carries the diacritics that helper strips.
 */
const TV_PANEL_PATTERNS: [string, RegExp][] = [
  ["neo_qled", /neo[\s-]*qled|نيو\s*كيو\s*ليد/],
  ["oled", /qd[\s-]*oled|\boled\b|او\s*ال\s*اي\s*دي|او\s*ليد|اوليد/],
  ["qned", /\bqned\b/],
  ["nanocell", /nano[\s-]*cell|nanocell|نانو\s*سيل/],
  ["mini_led", /(?:qd[\s-]*)?mini[\s-]*led|ميني\s*ليد/],
  ["uled", /\buled\b/],
  ["qled", /\bqled\b|كيو\s*ال\s*اي\s*دي|كيو\s*ليد/],
  ["crystal", /crystal|كريستال/],
  ["lcd", /\blcd\b/],
  ["led", /\bled\b|ال\s*اي\s*دي|ليد/],
];

function parseTvPanel(x: string): string | undefined {
  for (const [type, re] of TV_PANEL_PATTERNS) if (re.test(x)) return type;
  return undefined;
}

function parseRoomSize(x: string): number | undefined {
  const ok = (n: number) => (n >= 5 && n <= 200 ? n : undefined);
  // "30 متر", "30م²", "30 m2", "30 sqm", "30 square". Digits are already ASCII by `norm`.
  const m = x.match(/(\d{1,3})\s*(?:م(?:²|2|تر)?|متر مربع|m2|m²|sqm|sq ?m|square ?met)/);
  if (m) { const v = ok(Number(m[1])); if (v) return v; }
  // Unit-less, but unambiguous from the noun it follows: «غرفة ٤٠», "room 40". A bare
  // number ANYWHERE is deliberately NOT read as an area — «تحت 4000» is a budget and
  // «مكيف 24000` is a BTU rating, and guessing either as square metres would be a
  // fabricated input to a capacity calculation. Only the room noun licenses it.
  const r = x.match(/(?:غرف[ةه]|غرفتي|صال[ةه]|مجلس|room)\s*(?:بمساحة\s*|مساحتها\s*|of\s*)?(\d{1,3})(?!\s*\d)/);
  if (r) { const v = ok(Number(r[1])); if (v) return v; }
  return undefined;
}

function parseBudget(x: string): number | null | undefined {
  // "تحت 4000", "ميزانية 4000", "بميزانيتي 5000", "under 4000", "budget 4000", "4000 ريال"
  //
  // MEASURED FAILURE (baseline 2026-08-04, «ابي 3 مكيفات بميزانيتي 5000 ريال»): the
  // attached-morpheme form «بميزانيتي» (بـ + ميزانية + ـي) matched neither branch, AND the
  // fallback ended in `\b` after «ريال` — JS `\b` never matches beside Arabic letters (the
  // same trap as CHECKPOINT #17's digit failures), so «5000 ريال» parsed as no budget. The
  // budget was silently dropped, no need signal fired, and the advisor was never routed —
  // while the identical English sentence parsed fine. `\b` stays only after Latin tokens,
  // where it is valid.
  // «بحدود 4000» — attached-morpheme form of «في حدود», same class of gap as «بميزانيتي»
  // above (fixed 2026-08-04). «ما يتعدى» / «لا يتعدى» ("does not exceed") added 2026-08-09,
  // measured live: «…لغرفة 30 متر ما يتعدى 4000» parsed no budget before this fix.
  //
  // MEASURED FAILURE (2026-08-09, D→E mission Section 11 category sweep — laptop/tablet/
  // washer/refrigerator/TV forks all hit this independently): «غير الميزانية إلى 4000» ("change
  // the budget TO 4000") matched neither branch — «ميزانية» is followed by «إلى» before the
  // number, not directly by whitespace+digits, and there is no «ريال» suffix. The optional
  // «(?:الى|إلى|to)\s*» below is the SAME absolute-target vocabulary already handled in
  // `counterfactual.ts`'s `parseCounterfactualDelta`, propagated here so CONSTRAINT_CHANGE
  // (and every other mutation intent sharing this parser) recognizes it too — a fix that
  // exists in one budget parser and not this one is still the same bug from the caller's view.
  // MEASURED DEFECT (2026-08-10, FINAL SEMANTIC INTELLIGENCE mission, case CS05 in
  // scripts/waffar-eval): «budget حول 4000» ("budget AROUND 4000") failed — the optional
  // «(?:الى|إلى|to)?» bridge only handled an absolute-target phrasing («ميزانية إلى 4000»),
  // not an approximator between the marker and the number. «حول»/«تقريبا»/"around"/"about"
  // is the same class of gap, added as a second optional bridge word.
  const m = x.match(/(?:تحت|أقل من|اقل من|ميزانية|ميزانيتي|في حدود|بحدود|حدود|يتعدى|under|below|budget|max)\s*(?:الى|إلى|to|حول|تقريبا|تقريباً|around|about)?\s*([\d,]{3,7})/) ||
            x.match(/([\d,]{3,7})\s*(?:ريال|sar\b|sr\b)/);
  if (m) { const n = Number(m[1].replace(/,/g, "")); if (n >= 100 && n <= 500000) return n; }
  return undefined;
}

/**
 * NEED-DISCOVERY SIGNALS (2026-08-10, founder's own production gap: «وش أفضل لابتوب
 * لاحتياجي وميزانيتي؟» fell through to a plain 83-result browse instead of asking what
 * "احتياجي"/"ميزانيتي" actually mean). The founder's own framing, verbatim: a possessive
 * REFERENCE to budget/need is not the same as a VALUE — «ميزانيتي» alone means
 * budget_requested=true, budget_value=unknown, never a completed constraint. These three
 * detectors capture exactly that distinction, independent of whether `parseBudget`/
 * `parsePriorities` above found an actual value.
 *
 * `wants_recommendation`: the shopper is explicitly asking US to decide/pick FOR them
 * («أفضل», «انصحني», «وش تنصحني», "recommend", "what should I get") — as opposed to
 * naming a product or browsing a category. This is the marker that turns "category with
 * nothing else" from an honest browse (rule 5 in route-query.ts) into a real
 * recommendation request worth clarifying, without hardcoding any specific product/category
 * example — it fires identically for "أفضل لابتوب"/"أفضل جوال"/"أفضل مكيف".
 */
// MEASURED GAP (2026-08-11, Saudi Shopper Language mission — measured on «افضل ثلاجه كبيره
// للعائله وسعرها كويس»): a BARE superlative ("افضل X" / "أبي أفضل X", no «وش» prefix and no
// trailing «لي»/"for me") matched none of the existing markers below — only "وش
// افضل"/"الافضل"/"افضل لي" did. Bare «افضل»/«أفضل» is safe to add unqualified: it never
// collides with `compare-intent.ts`'s own "وش أفضل" comparison-marker detection (a different
// file, a different classifier, unaffected by this list) — a query that DOES start with «وش»
// is claimed by that classifier before `routeQuery` ever consults this one, so this only closes
// the genuinely uncovered bare-superlative case.
// English "what is a good/best X" / "is there a good/best X" (2026-08-11, same mission —
// measured on two independent holdout cases, "what is a good fridge..." and "is there a good
// offer..."): the existing English markers required either an explicit "recommend"/"suggest me"
// verb or the narrow "best...for me" shape; a QUESTION framed around "a good/best X" is at
// least as common and had nothing to match it. Narrow and question-shaped by design (requires
// "what is"/"is there" + "a/the/any" + good/best/great) rather than a bare "best"/"good"
// anywhere in the sentence, which would be far too broad and risk misfiring on ordinary prose.
const RECOMMENDATION_MARKERS = /افضل|أفضل|انصحني|أنصحني|تنصحني|توصيتك|توصيك|نصيحتك|اقترح لي|إقترح لي|الانسب لي|الأنسب لي|وش تنصح|ايش تنصح|recommend|suggest.{0,20}me|what should i (get|buy|choose|pick)|which (one )?(is|to) (best|choose|get|buy)|help me choose|help me pick|best.{0,20}for me|(?:what(?:'s| is)|is there) (?:a |the |any )?(?:good|best|great)\b/;

/**
 * INDECISION SIGNAL (Product Truth & Decision Quality mission, 2026-09-05 — measured production
 * gap: «محتار بين جوالين» ["torn between two phones"] names no specific model and states no
 * budget/priority, so it carried ZERO need signals and ZERO comparison markers — `routeQuery`
 * sent it to a bare, unfiltered "mobile" category browse (route-query.ts rule 5, "a browse, not
 * a described need"), and `detectCompareIntent` (compare-intent.ts) never fires either, since the
 * shopper named no nameable subjects to split into a pair. The shopper's own words already say
 * exactly what they need — help choosing, not a product list — but nothing existing could hear
 * it. This is NOT the same shopper as a plain "جوال" browse: a bare category name is silence,
 * "محتار"/"حائر" is the shopper explicitly signalling they are stuck between options and want
 * help resolving it (same class of signal as `wants_recommendation` above, distinct wording).
 * Routes through the identical `needSignals()` mechanism (route-query.ts) into `advisory` mode,
 * which already asks the category's own use-case clarify question (e.g. `MOBILE_USE_CASE_Q`,
 * clarify.ts) instead of showing an undifferentiated grid — zero new UI, zero new engine logic,
 * only a wider front door into a pipeline that already exists and is already tested.
 */
const INDECISION_MARKERS = /محتار|محتاره|حائر|حايره|حايرة|مو عارف اي|مو عارف ايش|ما ادري اي|ما اعرف اي|مادري ايش|مب قادر اقرر|ما قدر اقرر|ماقدر اقرر|can'?t decide|torn between|don'?t know which (?:one|to)|which one should i (?:get|choose|pick|buy)/;

/**
 * REPLACEMENT-TIMING SIGNAL (same mission, same measured gap class): «أغير جوالي الآن أو
 * أنتظر» ["should I change my phone now or wait"] is not a product query at all — it is a
 * timing question. Tawveeri has no reliable price-forecast evidence (no model predicts future
 * price movement), so this deliberately does NOT attempt to answer "now or later" — inventing a
 * wait/buy verdict with no supporting evidence is exactly the fabrication CLAUDE.md forbids
 * ("unknown beats incorrect"). What it DOES do, honestly: recognizes the shopper is evaluating a
 * REPLACEMENT decision and routes them into the same advisory/clarify pipeline used for an
 * explicit recommendation ask, so they get real help picking what they would replace it WITH —
 * the one part of their question Tawveeri can actually answer today. Narrow by construction
 * (requires the "now vs. wait" framing, not just the word "الآن") to avoid firing on unrelated
 * sentences that merely mention "now".
 */
const REPLACEMENT_TIMING_MARKERS = /الحين ولا (?:اصبر|أصبر|استنى|أستنى|انتظر|أنتظر)|الآن (?:او|أو) (?:انتظر|أنتظر)|الان (?:او|أو) (?:انتظر|أنتظر)|اشتري(?:ه|ها)? الحين ولا|ابدل(?:ها|ه)? الحين ولا|now or (?:wait|later)\b|buy now or wait|upgrade now or (?:wait|later)/i;

function wantsIndecisionHelp(x: string): boolean { return INDECISION_MARKERS.test(x); }
function wantsReplacementTimingHelp(x: string): boolean { return REPLACEMENT_TIMING_MARKERS.test(x); }

/**
 * DEAL/DISCOUNT-SEEKING SIGNAL (2026-08-11, Saudi Shopper Language & Demand Discovery mission
 * — measured gap: this exact structure appeared in the founder's own illustrative examples
 * «ابي ايباد جديد وعليه تخفيض» and had NO field to land in anywhere in the FIRST-turn parse).
 * Distinct from `decision-intent.ts`'s `DEAL_EVALUATION` markers, which classify a FOLLOW-UP
 * question about an ALREADY-SELECTED product ("هل هذا العرض جيد؟" — is THIS deal good) and are
 * gated behind an active `DecisionState`. This detector fires on a first-turn statement that
 * the shopper wants something CURRENTLY on offer — a search-time preference, not a question
 * about one candidate. Kept as its own boolean field (like `wants_recommendation`), not folded
 * into `PRIORITY_KEYWORDS`: a discount is a claim about a SPECIFIC listing's price history
 * (verified vs. inflated_reference, per Discount Integrity/ADR-091), not a soft ranking
 * preference like "quiet" or "value" — conflating the two would let an unverified "خصم" claim
 * be silently promoted to the same status as a genuine spec preference. The decide route
 * answers it using the SAME evidence-cited Discount Integrity data it already computes for
 * every candidate (never a new/separate claim, never fabricated when no verified discount
 * exists — CLAUDE.md: "Unknown beats incorrect").
 */
const DISCOUNT_MARKERS = /عليه عرض|عليها عرض|فيه عرض|فيها عرض|في عرض|عليه تخفيض|عليها تخفيض|فيه تخفيض|فيها تخفيض|عليه خصم|عليها خصم|فيه خصم|فيها خصم|مخفض|مخفضة|نازل السعر|نازلة السعر|السعر نازل|مخفض السعر|\bdeals?\b|\boffers?\b|on sale|\bdiscount(?:ed|s)?\b|\bpromo(?:tion)?\b/;

function wantsDiscount(x: string): boolean { return DISCOUNT_MARKERS.test(x); }

/** «ميزانيتي»/«على قد ميزانيتي»/"my budget" WITHOUT a number attached anywhere in the
 *  sentence — the reference exists, the value does not. */
const BUDGET_REFERENCE = /ميزاني|على قد|my budget/;

/** «احتياجي»/«استخدامي»/«يناسبني» — the shopper is pointing at "my situation" without
 *  stating what it is. Symmetric to BUDGET_REFERENCE for the exact same reason. */
const USE_CASE_REFERENCE = /احتياجي|احتياجك|استخدامي|يناسبني|يناسب احتياجي|my (needs|use ?case)/;

function hasBudgetReference(x: string): boolean { return BUDGET_REFERENCE.test(x); }
function hasUseCaseReference(x: string): boolean { return USE_CASE_REFERENCE.test(x); }
function wantsRecommendation(x: string): boolean { return RECOMMENDATION_MARKERS.test(x); }

/**
 * Quantity: a small count directly before the category noun («ابي 3 مكيفات»,
 * "3 air conditioners"). Deliberately narrow — a number is a quantity ONLY when the very
 * next word(s) classify as the query's own category, so «مكيف 24000» (BTU), «شاشة 65»
 * (inches) and «تحت 4000» (budget) can never be misread as counts. Range 2–20: a count of
 * one is the default and huge counts are far more likely to be model numbers.
 * (Measured absence 2026-08-04: «3 مكيفات» had no field to land in and was silently lost.)
 */
function parseQuantity(x: string, category: string | null): number | undefined {
  if (!category) return undefined;
  const words = x.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    if (!/^\d{1,2}$/.test(words[i])) continue;
    const n = Number(words[i]);
    if (n < 2 || n > 20) continue;
    // Two-word window: English category nouns are phrases ("air conditioners").
    if (parseCategory(words.slice(i + 1, i + 3).join(" ")) === category) return n;
  }
  return undefined;
}

/**
 * NEGATION POLARITY (2026-08-09, D→E mission, Section 7 — founder's own production
 * failure). MEASURED: «ابي جوال تصويره ممتاز وبطاريته قوية وميزانيتي 3000 ريال وما يهمني
 * الألعاب» — «ما يهمني الألعاب» ("gaming doesn't matter to me") matched the SAME bare
 * substring regex as a POSITIVE "gaming" priority, so the parser recorded the shopper as
 * WANTING gaming performance — the exact opposite of what they said. Every keyword group
 * below is now checked for a preceding negation marker before being added as a positive
 * priority at all.
 *
 * Two distinct polarities, not one — the mission's own examples («ما يهمني» vs «ما أبي») are
 * different strengths of statement and must not collapse to the same thing:
 *   - DE-PRIORITIZE («ما يهمني», «مو مهم», «غير مهم») — "don't optimize for this", a neutral
 *     dismissal. The item is simply left OUT of positive `priorities` (the engine already
 *     treats an absent priority as neutral — no fabricated exclusion needed).
 *   - EXCLUDE («ما أبي», «ما اريد», «بدون», «ممنوع») — an active rejection, stronger than
 *     de-prioritization. Recorded separately (`excluded`) so a future hard-constraint pass
 *     has real data to act on, without silently narrowing the candidate set today just
 *     because this parser learned the word exists.
 * A window of the 12 characters immediately BEFORE the matched keyword is checked — Arabic
 * negation precedes what it negates («ما يهمني الألعاب», not «الألعاب ما يهمني»).
 *
 * MEASURED (2026-08-09): a wider 20-character window let a negation marker BLEED across a
 * clause boundary into a later, unrelated keyword — «...وما يهمني الألعاب وبطاريته قوية»
 * (gaming doesn't matter to me, AND battery matters) incorrectly de-prioritized "battery"
 * too, because "ما يهمني" sat within 20 characters of "بطاريته" despite belonging to the
 * PRIOR clause. 12 characters is wide enough to catch every marker immediately preceding its
 * own keyword (the longest, «مو لازم», plus a space, is well under that) while too narrow to
 * reach across a "و"-joined clause to a keyword it was never meant to negate.
 */
const DEPRIORITIZE_MARKERS = /ما ?يهمني|مو ?مهم|مب ?مهم|غير ?مهم|مو ?لازم|مب ?لازم/;
const EXCLUDE_MARKERS = /ما ?(?:ابي|أبي|اريد|أريد|احتاج|أحتاج)|بدون|ممنوع|مو ?(?:ابي|أبي)|مب ?(?:ابي|أبي)/;
const NEGATION_WINDOW_CHARS = 12;

/**
 * ENGLISH NEGATION POLARITY (2026-08-10, FINAL SEMANTIC INTELLIGENCE mission — measured via
 * `scripts/waffar-eval`, case NEG03): the Arabic negation markers above only ever check the
 * text BEFORE a keyword match, matching Arabic's pre-negation word order («ما يهمني الألعاب»).
 * English negation of a shopping priority is overwhelmingly POST-positioned instead ("gaming
 * doesn't matter to me"), so the same before-window check silently let "gaming" through as a
 * POSITIVE priority — the exact inversion bug Section 7's Arabic fix (DEPRIORITIZE_MARKERS
 * above) already exists to prevent, just never ported to English. A narrow, closed set,
 * checked in an AFTER-window the same fixed size as the existing BEFORE-window, so an
 * unrelated later clause cannot bleed backward into an earlier keyword either.
 */
const EN_DEPRIORITIZE_BEFORE = /don'?t care about|do not care about|not interested in/i;
const EN_DEPRIORITIZE_AFTER = /doesn'?t matter|does not matter|isn'?t important|is not important|isn'?t a priority|is not a priority/i;
const EN_EXCLUDE_BEFORE = /don'?t want|do not want|don'?t need|do not need|without/i;

type Polarity = "positive" | "deprioritized" | "excluded";

function polarityBeforeMatch(x: string, re: RegExp): Polarity | null {
  const m = re.exec(x);
  if (!m) return null;
  const before = x.slice(Math.max(0, m.index - NEGATION_WINDOW_CHARS), m.index);
  // Wider than the before-window: "gaming doesn't matter" needs 16+ chars after "gaming" to
  // fit " doesn't matter" in full — a narrower window silently truncated the phrase and never
  // matched, letting the priority through as positive despite the negation being present.
  const after = x.slice(m.index + m[0].length, m.index + m[0].length + 20);
  if (EXCLUDE_MARKERS.test(before) || EN_EXCLUDE_BEFORE.test(before)) return "excluded";
  if (DEPRIORITIZE_MARKERS.test(before) || EN_DEPRIORITIZE_BEFORE.test(before) || EN_DEPRIORITIZE_AFTER.test(after)) return "deprioritized";
  return "positive";
}

const PRIORITY_KEYWORDS: [string, RegExp][] = [
  // «هادي» (no hamza) added 2026-08-09 — colloquial spelling measured live in the founder's
  // Golden Query; «هادئ» alone missed the everyday-typed form (same class as CHECKPOINT #17).
  // «أهدأ» (comparative "quieter" — 2026-08-10, D→E mission Part A, one of the founder's own
  // named example follow-ups «أبيه أهدأ») was missing: none of the base-form spellings match
  // the comparative, so «طيب أبيه أهدأ» parsed NO priority at all before this fix.
  ["quiet", /هادئ|هادي|هادى|أهدأ|اهدا|هدوء|صامت|quiet|quieter|silent|low ?noise/],
  // «كهرب» (2026-08-11, Saudi Shopper Language & Demand Discovery mission — measured on
  // «ما يصرف كهرب كثير»): the everyday colloquial short form (dropping the formal «-اء»
  // ending) matched nothing — only the full «كهرباء» did. Same ة/ه-class spelling-register
  // gap this codebase keeps finding one word at a time (CHECKPOINT #17, «جامعة»/«جامعه»).
  //
  // MEASURED DEFECT (2026-08-19, real-user production report — «افضل فرن كهربائي»): bare
  // «كهرب» is also a substring of «كهربائي»/«كهربائية» ("electric", a fuel/power-TYPE
  // adjective — "غلاية كهربائية", "فرن كهربائي") — a completely different axis from "wants to
  // save on the electricity bill". Every appliance described as "electric" was silently
  // scored as if the shopper had asked for energy-saving. `(?!ائ)` excludes exactly the
  // adjective's own continuation («كهرباء», the noun, is unaffected — it continues «اء», not
  // «ائ»); fuel/power type itself is now parsed separately, see `parseFuelType` below.
  ["low_electricity", /موفر|توفير|كهرباء|كهرب(?!ائ)|فاتورة|اقتصادي|low ?electric|energy ?saving|efficient/],
  ["heating", /تدفئة|دفء|حار وبارد|heating|warm|hot ?and ?cold/],
  ["gaming", /ألعاب|العاب|قيمنق|gaming|games/],
  ["movies", /أفلام|افلام|سينما|movies|cinema|netflix/],
  ["sports", /رياضة|كرة|مباريات|sports|football/],
  ["bright_room", /غرفة مضيئة|إضاءة|bright ?room|sunny/],
  // «دراسة»/«برمجة» (study/programming) added 2026-08-09 — measured on «لابتوب للدراسة
  // والبرمجة»: neither use-case was recognized at all, so a laptop request for exactly the
  // RAM/CPU-focused fit this priority already scores for produced no priority signal.
  // «جامعة»/«الجامعة»/«دوام»/«وظيفة» (2026-08-10, need-discovery mission): MEASURED — none
  // of these matched anything before this fix, so "لابتوب للجامعة" carried zero priority
  // signal despite genuinely implying the same RAM/CPU-focused fit "دراسة" already scores
  // for. Arabic work vocabulary was also missing — only the English literals "work"/"office"
  // existed. Deliberately NOT adding bare «مكتب» ("office"): it is a substring of «مكتبي»
  // ("my office"), which is ALSO a substring collision with the unrelated "reading" group's
  // «كتب» ("books") check — "لمكتبي" would silently gain a fabricated reading priority. Not
  // worth the ambiguity for one word when «دوام»/«وظيفة»/«جامعة» already cover the common
  // Saudi phrasings without it.
  // MEASURED SEVERE DEFECT (2026-08-10, founder's own production report — reopened mission):
  // «جامعة»/«الجامعة» were listed with ONLY the formal ة-ending spelling — «للجامعه» (the
  // everyday ه-ending typed form, extremely common on mobile keyboards) matched nothing, so
  // "ابي لاب توب للجامعه" carried NO priority signal, fell through to a bare category browse
  // (`routeQuery`'s "category only" rule) instead of Waffar's advisory clarification, and the
  // unprotected plain-search path is what let a laptop backpack surface as the sole result.
  // The SAME ة/ه spelling-pair gap this codebase has already paid for elsewhere (CHECKPOINT
  // #17) — «دراسة»/«دراسه» two lines above already lists BOTH spellings; «جامعة» simply never
  // got its own ه counterpart added. Fixed here, not as a one-word patch: every ة-ending
  // keyword in this array should carry its ه counterpart, the same discipline already applied
  // to «دراسة»/«برمجة» — see «عائلة» in the "large" group below for the second instance found
  // and fixed in this same pass.
  ["productivity", /إنتاجية|انتاجية|عمل|دراسة|دراسه|برمجة|برمجه|جامعة|جامعه|الجامعة|الجامعه|دوام|وظيفة|وظيفه|وظيفتي|productivity|work|office|university|college|studying|study|programming|coding/],
  // MEASURED GAP (2026-08-10, founder's own production report — reopened mission, case 2):
  // «ابي لاب توب للتصميم» resolved category=laptop but NO priority at all — no "design" key
  // existed anywhere in this list, unlike "gaming"/"productivity" which are both scored. Design
  // work (graphics/video/3D) has genuinely different laptop needs than plain productivity
  // (discrete GPU matters, not just RAM/CPU) — wired into `decideLaptop` alongside gaming/
  // productivity, not left as a silently-dropped signal.
  ["design", /تصميم|مونتاج|جرافيك|رندر|design|graphic design|video editing|3d modeling|rendering/],
  // MEASURED DEFECT (2026-08-10, need-discovery mission — found while testing an unrelated
  // "مكتب" addition, fixed on discovery since it fabricates a priority): bare «كتب» matched
  // inside «مكتب»/«مكتبي» ("office"/"my office"), so "لابتوب لمكتبي" silently gained a
  // fabricated reading priority. A negative lookbehind excludes "كتب" preceded by "م" while
  // still matching a standalone "كتب"/"الكتب".
  ["reading", /قراءة|reading|(?<!م)كتب|books/],
  // «كاميرته»/«كاميرتها» (possessive "its camera") added 2026-08-11 (Saudi Shopper Language
  // mission — measured on «كاميرته زينه»): the SAME possessive morpheme shift battery already
  // has a fix for (ة→ت before a pronoun suffix) also applies to «كاميرة» → «كاميرته», and the
  // bare «كاميرا» pattern never matches it. «كاميرت» is the shared root of every possessive
  // form, same technique as «بطاريت» below.
  ["camera", /كاميرا|كاميرت|تصوير|صور|camera|photo/],
  // «بطاريته»/«بطاريتها» (possessive "its/his battery") added 2026-08-09 — measured on «جوال
  // …وبطاريته قوية…»: the bare «بطارية» pattern does not match, because Arabic shifts the
  // final ة to ت before a possessive pronoun attaches (بطارية → بطاريته), so the substring
  // «بطارية» is never present in the possessive form. «بطاريت» is the shared root of every
  // possessive-suffixed form (ـه/ـها/ـهم/ـك/ـي), so matching on it covers all of them without
  // enumerating each pronoun.
  ["battery", /بطارية|بطاريت|battery/],
  // «حديث»/«حديث الإصدار» (2026-08-11, Saudi Shopper Language mission — measured on «آيباد
  // حديث الإصدار»): a distinct, common MSA word for "recent/modern" alongside «جديد» ("new").
  ["latest", /أحدث|احدث|جديد|حديث|latest|newest/],
  // «وزن» (weight) added 2026-08-09 — Section 7's own worked example «ما يهمني الوزن» ("the
  // weight doesn't matter to me") named a word this group never matched at all, positive or
  // negative — a shopper mentioning weight either way was previously invisible to the parser.
  ["portability", /خفيف|محمول|portable|lightweight|light ?weight|للسفر|travel|وزن/],
  // «عائلة» had the same ة-only gap «جامعة» did above (found in the same audit pass) — «عائله»
  // is the equally common ه-ending typed form.
  ["large", /كبير|كبيرة|عائلة|عائله|عائلية|عائليه|large|family|big/],
  // MEASURED REAL-SHOPPER DEFECT (2026-09-05, Shopper Constraint Truth mission — «أبي ثلاجة
  // صغيرة وقفلها مهم»): «صغيرة»/«صغير» had no landing spot anywhere in this list — the exact
  // same gap class as every other missing priority documented above, just never hit until a
  // real shopper's own words exposed it. Live-verified: `canonical_products` for
  // `category=refrigerator` has 100% `capacity_liters` coverage (484/484) with a real,
  // measurable compact cluster (77/484, ~16%, under 200L) distinct from the 350L+ majority
  // (318/484, ~66%) — real production data, not a guessed threshold, justifies treating
  // "small" as a genuine, scoreable signal for this category (see `decideRefrigerator`'s own
  // wantSmall branch). Kept in PRIORITY_KEYWORDS (not fridge_type — see that field's own
  // comment above on why a size adjective must never become a hard type restriction).
  // `(?!\s*-?\s*led)`/negative lookahead on «ميني»: TV_PANEL_PATTERNS' `mini_led` ("mini LED",
  // a panel TECHNOLOGY, not a size preference) shares the same substring — "تلفزيون mini led"
  // must never also register a fabricated "small" size priority.
  ["small", /صغير|صغيرة|صغيره|ميني(?!\s*ليد)|مصغر|mini(?!\s*-?\s*led)|compact|\bsmall\b/],
  // MEASURED STRUCTURAL GAP (2026-08-11, Saudi Shopper Language & Demand Discovery mission —
  // repo audit + a new evaluation corpus, scripts/shopper-demand-eval/): "quality/reasonable
  // price" ("رخيص وجودته عاليه", "سعره كويس/مناسب") appeared in a majority of the founder's
  // OWN illustrative examples across categories (AC, mobile, tablet, refrigerator) and had NO
  // landing spot anywhere in this parser — not a priority, not the budget parser (no digit),
  // not `CHEAPEST_MARKER` (which this file's own comment already says «رخيص» deliberately does
  // NOT trigger — it means "sort to the single cheapest item", a different instruction from a
  // soft quality-price preference). Distinct field, closes exactly the gap that comment already
  // anticipated. Deliberately excludes «أرخص»/«ارخص» (no shared substring with «رخيص» — the
  // extra ي makes them non-overlapping) so this never fires alongside/instead of the cheapest
  // marker.
  ["value", /رخيص|سعر(?:ه|ها)? (?:مناسب|معقول|كويس|زين|حلو)|بسعر (?:مناسب|معقول|كويس|زين|حلو)|جودة عالية|جودت(?:ه|ها) عالية|قيمة مقابل السعر|مو غالي|ما يكون غالي|مب غالي|reasonable price|good value|great value|worth (?:the |its )?(?:money|price)|affordable|budget[- ]friendly|not overpriced/],
  // MEASURED STRUCTURAL GAP (2026-08-11, same mission): washing-machine "combo dryer" wants
  // ("فيها نشافة"/"غسالة ونشافة") were ONLY ever read by an ad hoc regex directly on
  // `parsed_from_text` inside `decideWashingMachine` — never through `PRIORITY_KEYWORDS`, so
  // the want was invisible to the negation/deprioritize/exclude polarity system every other
  // category's priorities already get ("ما ابي نشافة" had no keyword to negate). Promoted to a
  // real priority key; `decideWashingMachine` now reads it the same way `decideRefrigerator`
  // already reads "large" — via `priorities[]` first.
  ["dryer_combo", /نشاف[ةه]?|تجفيف|\bdryer\b|washer[- ]dryer/],
];

interface PriorityParse {
  positive: string[];
  deprioritized: string[];
  excluded: string[];
}

function parsePriorities(x: string): PriorityParse {
  const positive = new Set<string>();
  const deprioritized = new Set<string>();
  const excluded = new Set<string>();
  for (const [key, re] of PRIORITY_KEYWORDS) {
    const polarity = polarityBeforeMatch(x, re);
    if (polarity === "positive") positive.add(key);
    else if (polarity === "deprioritized") deprioritized.add(key);
    else if (polarity === "excluded") excluded.add(key);
  }
  return { positive: [...positive], deprioritized: [...deprioritized], excluded: [...excluded] };
}

function parseConnectivity(x: string): string | undefined {
  if (/شريحة|خلوي|بيانات|5g|4g|lte|cellular|sim/.test(x)) return "cellular";
  if (/واي ?فاي|wifi|wi-?fi/.test(x)) return "wifi";
  return undefined;
}

function parseCity(x: string): string | undefined {
  const map: [RegExp, string][] = [[/الرياض|riyadh/, "Riyadh"], [/جدة|jeddah/, "Jeddah"], [/الدمام|dammam/, "Dammam"], [/مكة|makkah|mecca/, "Makkah"], [/المدينة|madinah/, "Madinah"], [/الخبر|khobar/, "Khobar"]];
  for (const [re, v] of map) if (re.test(x)) return v;
  return undefined;
}

/**
 * ROOM-TYPE — Intent Router item 6 (2026-08-23), the exact second gap in the query that
 * motivated this whole mission («تلفزيون 43 بوصة للمطبخ»): «للمطبخ» ("for the kitchen")
 * matched no existing extractor at all — `USE_CASE_REFERENCE` only covers «احتياجي/
 * استخدامي/يناسبني», not a location noun. Category-AGNOSTIC (unlike AC's numeric
 * `room_size_m2`): a TV, an AC, or a speaker can all genuinely be "for the kitchen" — the
 * room word itself carries no category information, so it is parsed the same way regardless
 * of what category the query resolves to. ROUTING/DISCLOSURE ONLY — never read by any
 * `decide*()` scoring function; it earns a query a seat at the advisory table, exactly like
 * `use_case_referenced` already does, without changing which product ranks first.
 */
const ROOM_TYPE_PATTERNS: [string, RegExp][] = [
  ["kitchen", /للمطبخ|بالمطبخ|في المطبخ|\bkitchen\b/i],
  ["living_room", /للصالة|بالصالة|في الصالة|\bliving room\b|\blounge\b/i],
  ["bedroom", /لغرفة النوم|لغرفه النوم|بغرفة النوم|بغرفه النوم|في غرفة النوم|في غرفه النوم|\bbedroom\b/i],
  ["majlis", /للمجلس|بالمجلس|في المجلس|\bmajlis\b/i],
];

function parseRoomType(x: string): string | undefined {
  for (const [type, re] of ROOM_TYPE_PATTERNS) if (re.test(x)) return type;
  return undefined;
}

// «قيقا»/«قيغا» (2026-08-23, Intent Router follow-up #2, ADR-270 consolidated list): the
// everyday-typed dialect spelling of «جيجا» — MEASURED on production («جوال ايفون 128 قيغا
// تحت 3500» returned zero closest-options candidates, ADR-271) — matched neither this regex
// nor the relevance-gate's own word-matching (see the ARABIC_TO_ENGLISH synonym fix in
// src/app/api/search/route.ts for that second half of the same gap).
function parseStorageMin(x: string): number | undefined {
  const m = x.match(/(\d{2,4})\s*(?:جيجا|قيقا|قيغا|كيقا|gb)\s*(?:على الأقل|أو أكثر|فأكثر|min|or more)?/);
  if (m) { const n = Number(m[1]); if ([32, 64, 128, 256, 512, 1024].includes(n)) return n; }
  return undefined;
}

/**
 * CHEAPEST intent (P1, founder's "ONE BRAIN / consolidation" mandate — 2026-08-10). MEASURED
 * GAP: «أرخص لابتوب» as a standalone first message previously behaved identically to
 * «لابتوب» — "أرخص" sat only in `route.ts`'s STOPWORDS list (pure noise-stripping) and
 * `counterfactual.ts`'s follow-up-only marker (gated behind an active DecisionState), so a
 * bare cheapest request on the FIRST turn was silently dropped in both the search path and
 * the decision path. This is the single shared source of truth both paths now read — one
 * regex, not two independently-maintained near-duplicates. Hamza forms («أرخص» vs «ارخص»)
 * are both listed explicitly because this parser's `norm()` (unlike the search route's
 * `normalizeArabic`) does not fold hamza, by design — see the file's own docstring.
 * Deliberately NOT triggered by bare «رخيص» ("cheap/affordable") alone — that is a quality
 * preference ("عادي بس رخيص وكويس"), not an instruction to sort/pick the single cheapest
 * item, and conflating the two would make an affordability preference silently override fit.
 */
export const CHEAPEST_MARKER = /ارخص|أرخص|اقل سعر|أقل سعر|اوفر|أوفر|cheapest|cheaper|lowest[- ]?price/;

/**
 * COMPARATOR PARSING (2026-08-23, Intent Router follow-up #3, ADR-270 consolidated list —
 * "»65 inch«-style comparator parsing... needs inequality-aware parsing before an
 * inequality-phrased request can be honestly compared"). Previously EQUALITY-ONLY: «تلفزيون
 * سامسونج فوق 65 بوصة» ("over 65 inches") extracted `requested=65` with no way to record that
 * ">65" and "=65" are different claims, so a 65" pick read as a match to an "over 65" ask.
 * DISCLOSURE ONLY, same rule as `screen_size_requested` itself — never read by any
 * ranking/eligibility path, only by the mismatch-disclosure comparison downstream.
 */
export type SizeComparator = "eq" | "gt" | "gte" | "lt" | "lte";

// Matches the SAME size+unit shape `extractSpecsFromTitle`'s screen-size regex accepts
// (inch/"/بوصة/انش/إنش/in) — kept in sync manually since this needs the MATCH POSITION (to
// inspect the surrounding words for a comparator), which extractSpecsFromTitle's return
// value alone cannot provide.
const SIZE_UNIT_RE = /(\d+(?:\.\d+)?)\s*[-"]?\s*(?:inch|"|بوصة|انش|إنش|in\b)/i;
const SIZE_GT_BEFORE = /(?:فوق|أكثر من|اكثر من|اعلى من|أعلى من|more than|over|above)\s*$/i;
const SIZE_LT_BEFORE = /(?:أقل من|اقل من|دون|تحت|less than|under|below)\s*$/i;
const SIZE_GTE_AFTER = /^\s*(?:فأكثر|أو أكثر|وأكثر|or more|or above)/i;
const SIZE_LTE_AFTER = /^\s*(?:فأقل|أو أقل|وأقل|or less|or below)/i;

/**
 * The comparator for a stated screen size, read from a narrow window immediately around the
 * matched size+unit text — a comparator word ELSEWHERE in the sentence (unrelated to the
 * size) must never be misread as qualifying it. Exported so decide/route.ts and search/
 * route.ts's mismatch-disclosure code can share ONE implementation of "does this actual size
 * satisfy that requested comparator" rather than two independently-maintained copies.
 */
export function parseScreenSizeComparator(x: string): SizeComparator {
  const m = SIZE_UNIT_RE.exec(x);
  if (!m || m.index == null) return "eq";
  const before = x.slice(Math.max(0, m.index - 20), m.index);
  const after = x.slice(m.index + m[0].length, m.index + m[0].length + 15);
  const gtBefore = SIZE_GT_BEFORE.test(before);
  const ltBefore = SIZE_LT_BEFORE.test(before);
  const gteAfter = SIZE_GTE_AFTER.test(after);
  const lteAfter = SIZE_LTE_AFTER.test(after);
  if (gtBefore) return gteAfter ? "gte" : "gt";
  if (ltBefore) return lteAfter ? "lte" : "lt";
  if (gteAfter) return "gte";
  if (lteAfter) return "lte";
  return "eq";
}

/** True when `actual` satisfies `requested` under `comparator` — the one place this
 *  inequality logic lives, shared by every mismatch-disclosure call site. */
export function sizeSatisfiesComparator(actual: number, comparator: SizeComparator, requested: number): boolean {
  switch (comparator) {
    case "gt": return actual > requested;
    case "gte": return actual >= requested;
    case "lt": return actual < requested;
    case "lte": return actual <= requested;
    default: return actual === requested;
  }
}

/**
 * CAPACITY PARSING — washer (kg), fridge (liters), dishwasher (place settings). Intent Router
 * item 5 (ADR-270 consolidated list #4/#5, 2026-08-23): a stated capacity is exactly as
 * describable a constraint as a screen size, but previously had NO field to land in at all —
 * «غسالة 12 كيلو» silently dropped its own stated capacity. DISCLOSURE/ROUTING ONLY, same rule
 * as `screen_size_requested` — never read by `decideWashingMachine`/`decideRefrigerator`/
 * `decideAppliance`'s ranking/eligibility, only compared to the winning pick's own
 * `dna.capacity_kg`/`capacity_liters`/`capacity` downstream (decide/route.ts) to caption an
 * honest mismatch, mirroring the existing TV size mechanism.
 *
 * `\b` placed ONLY after the Latin alternative in each group (kg/l/settings) — never after an
 * Arabic word — per this file's own documented rule: JS `\b` does not match beside Arabic
 * letters (see `parseBudget`'s doc comment above for the CHECKPOINT #17 history of this trap).
 */
function parseCapacityKg(x: string): number | undefined {
  const m = x.match(/(\d{1,2}(?:\.\d)?)\s*(?:كيلو|كجم|كغ|kg\b)/i);
  if (m) { const n = Number(m[1]); if (n >= 3 && n <= 20) return n; }
  return undefined;
}
function parseCapacityLiters(x: string): number | undefined {
  const m = x.match(/(\d{2,4})\s*(?:لتر|liters?\b|l\b)/i);
  if (m) { const n = Number(m[1]); if (n >= 50 && n <= 1000) return n; }
  return undefined;
}
function parseCapacitySettings(x: string): number | undefined {
  const m = x.match(/(\d{1,2})\s*(?:طقم|أطقم|مكان|اماكن|أماكن|place settings?\b|settings?\b)/i);
  if (m) { const n = Number(m[1]); if (n >= 6 && n <= 20) return n; }
  return undefined;
}

/**
 * Budget FLOOR — «فوق 2000»/«أكثر من 2000 ريال» ("more than 2000"), the mirror case
 * `parseBudget` above never covers: that function is CEILING-only by construction (تحت/أقل
 * من/ميزانية/... phrasings all state a MAX). Kept on a SEPARATE field, never folded into
 * `budget_total` — every existing consumer of `budget_total` (applyBudgetGate, closestOptions,
 * inferredMaxPrice in search/route.ts) reads it as a hard MAX price ceiling; silently
 * repurposing it for a floor statement would flip "spend more than 2000" into a "spend under
 * 2000" filter downstream — a real eligibility regression outside this mission's scope
 * (parser/router only, no ranking or eligibility changes). `budget_min` is parsed and exposed
 * for routing/disclosure only; nothing outside task-parser.ts/route-query.ts reads it yet.
 */
function parseBudgetMin(x: string): number | undefined {
  const m = x.match(/(?:فوق|أكثر من|اكثر من|اعلى من|أعلى من|more than|over|above)\s*(?:الى|إلى|to)?\s*([\d,]{3,7})\s*(?:ريال|sar\b|sr\b)?/);
  if (m) { const n = Number(m[1].replace(/,/g, "")); if (n >= 100 && n <= 500000) return n; }
  return undefined;
}

export interface ParsedTask extends ShoppingTask {
  use?: string[];
  connectivity_needed?: string;
  storage_min?: number;
  ram_min?: number;
  /** Budget FLOOR («فوق 2000»/«أكثر من 2000 ريال») — see `parseBudgetMin`'s own doc comment.
   *  Disclosure/routing only; never read by any ranking or eligibility gate. */
  budget_min?: number;
  /** Capacity, category-gated — see `parseCapacityKg`/`parseCapacityLiters`/
   *  `parseCapacitySettings`'s shared doc comment. Disclosure/routing only. */
  capacity_kg_requested?: number;
  capacity_liters_requested?: number;
  capacity_settings_requested?: number;
  /** Room type («للمطبخ»/«للصالة»/«لغرفة النوم»/«للمجلس») — see `parseRoomType`'s doc
   *  comment. Category-agnostic, routing/disclosure only. */
  room_type?: string;
  parsed_from_text: string;
  unresolved?: string[]; // fields the parser could not extract (fail-loud transparency)
  /** Section 7 (2026-08-09): stated but explicitly de-prioritized ("ما يهمني X") — never
   *  scored as a positive priority, but preserved for display/state, not silently dropped. */
  deprioritized_priorities?: string[];
  /** Section 7: actively rejected ("ما أبي X", "بدون X") — stronger than de-prioritized. */
  excluded_priorities?: string[];
  /** Need-discovery signals (2026-08-10) — a REFERENCE to budget/need/a recommendation ask,
   *  distinct from an actual VALUE. See the detectors' own doc comment above. */
  wants_recommendation?: boolean;
  budget_referenced?: boolean;
  use_case_referenced?: boolean;
  /** Product Truth & Decision Quality mission (2026-09-05) — see the detectors' own doc
   *  comments above `INDECISION_MARKERS`/`REPLACEMENT_TIMING_MARKERS`. Routing-only signals,
   *  never read by ranking/eligibility: they only decide whether the advisory pipeline gets a
   *  chance to help, never which product wins inside it. */
  indecision_signal?: boolean;
  replacement_timing_signal?: boolean;
  /**
   * FINAL SEMANTIC INTELLIGENCE mission (2026-08-10) — NEVER set by `parseShoppingTask`
   * itself (this function stays pure keyword/number extraction, unchanged). Populated only by
   * the semantic-fallback orchestration in `/api/v1/agent/decide` when the deterministic parse
   * above found nothing to act on. Kept on a SEPARATE field from `priorities` — never merged
   * into it — so a downstream consumer (`applyParsedTask`, decision-state.ts) can route these
   * into `inferred_preferences`, never `explicit_preferences`: the explicit/inferred boundary
   * Section 10 requires, made structural rather than a convention someone has to remember.
   */
  inferred_priorities?: string[];
  /** Set alongside `inferred_priorities`/a semantic `category` — the model's own self-reported
   *  confidence (0–1), carried so a low-confidence guess is never treated as equal to a
   *  keyword match. Absent when no semantic fallback ran. */
  semantic_confidence?: number;
}

/** The CLOSED category vocabulary `parseCategory` can produce — exported so the semantic
 *  fallback (semantic-fallback.ts) can constrain its own output to the SAME set rather than
 *  maintaining a second, driftable list. A category not in this set is never accepted from
 *  any source, deterministic or semantic (Section 9: semantic intelligence may interpret
 *  MEANING, never invent a product category Tawveeri has no data for). */
export const CATEGORY_KEYS = [
  'air_conditioner', 'tv', 'tablet', 'laptop', 'audio', 'camera', 'mobile',
  'dishwasher', 'microwave', 'air_fryer', 'air_purifier', 'vacuum', 'coffee_maker',
  'kettle', 'toaster', 'blender', 'oven', 'cooker', 'refrigerator', 'washing_machine',
] as const;

/** The CLOSED priority vocabulary the decision engine actually scores against
 *  (`PRIORITY_KEYWORDS`'s own keys) — same governing rule as `CATEGORY_KEYS`. */
export const PRIORITY_KEYS = PRIORITY_KEYWORDS.map(([key]) => key);

/**
 * True when `word` matches ANY priority-keyword pattern (task-parser.ts's OWN closed
 * vocabulary, not a second copy of it) — i.e. it describes the shopper's NEED/CONTEXT
 * ("للجامعة", "رخيص وجودته عاليه"'s "رخيص") rather than a product's own identity. Exported
 * for `/api/search/route.ts` (2026-08-10, reopened mission, case 3): a query's context words
 * must never be REQUIRED for a full-text retrieval match — a laptop's real catalog title never
 * contains "جامعة", so requiring it excludes every genuine laptop and leaves only whichever
 * accessory happens to have padded its own title with the shopper's exact wording.
 */
export function isPriorityDescriptorWord(word: string): boolean {
  return PRIORITY_KEYWORDS.some(([, re]) => re.test(word));
}

/** Parse free-text into a ShoppingTask. Returns null category if undetectable. */
export function parseShoppingTask(text: string): ParsedTask {
  const x = norm(text);
  const category = parseCategory(x);
  const fuel_type = parseFuelType(x);
  // NOT gated on `category === "air_conditioner"` (unlike the AC-only structured fields
  // below): a bare type word ("شباك رخيص", no "مكيف") can resolve category via the semantic
  // fallback AFTER this deterministic pass runs (see `/api/v1/agent/decide`) — gating here
  // would silently drop the type on exactly that phrasing. Harmless when the category turns
  // out not to be `air_conditioner`: `ac_type` is read nowhere except `decideAc`.
  const ac_type = parseAcType(x);
  // Same "not gated on category" reasoning as `ac_type` immediately above — each is read
  // nowhere except its own category's decider, so a stray value on an unrelated category is
  // inert, not a leak.
  const wants_inverter = parseAcInverterPref(x);
  const fridge_type = parseFridgeType(x);
  const wants_lock = parseLockRequirement(x);
  const washer_type = parseWasherType(x);
  const tv_panel = parseTvPanel(x);
  const room_size_m2 = parseRoomSize(x);
  const budget_total = parseBudget(x);
  const budget_min = parseBudgetMin(x);
  const room_type = parseRoomType(x);
  const quantity = parseQuantity(x, category);
  const priorityParse = parsePriorities(x);
  const priorities = priorityParse.positive;
  const connectivity = parseConnectivity(x);
  const city = parseCity(x);
  const storage_min = parseStorageMin(x);
  const wants_cheapest = CHEAPEST_MARKER.test(x);
  // Referenced-but-unvalued (2026-08-10): only a real gap if the value itself never
  // resolved — a sentence that both references AND states its budget («ميزانيتي 3000»)
  // is fully answered already; this must not re-flag it as still-missing.
  const budget_referenced = hasBudgetReference(x) && budget_total == null;
  const use_case_referenced = hasUseCaseReference(x) && priorities.length === 0;

  const unresolved: string[] = [];
  if (!category) unresolved.push("category");
  if (category === "air_conditioner" && !room_size_m2) unresolved.push("room_size_m2");

  const task: ParsedTask = {
    category: category ?? "",
    fuel_type, ac_type, wants_inverter, fridge_type, wants_lock, washer_type, tv_panel,
    room_size_m2, city, priorities: priorities.length ? priorities : undefined,
    budget_total: budget_total ?? undefined,
    budget_min: budget_min ?? undefined,
    room_type: room_type ?? undefined,
    quantity,
    wants_cheapest: wants_cheapest || undefined,
    wants_recommendation: wantsRecommendation(x) || undefined,
    wants_discount: wantsDiscount(x) || undefined,
    budget_referenced: budget_referenced || undefined,
    use_case_referenced: use_case_referenced || undefined,
    indecision_signal: wantsIndecisionHelp(x) || undefined,
    replacement_timing_signal: wantsReplacementTimingHelp(x) || undefined,
    parsed_from_text: text, unresolved: unresolved.length ? unresolved : undefined,
    deprioritized_priorities: priorityParse.deprioritized.length ? priorityParse.deprioritized : undefined,
    excluded_priorities: priorityParse.excluded.length ? priorityParse.excluded : undefined,
  };
  // Tablet-specific structured fields.
  if (category === "tablet") {
    if (connectivity === "cellular") task.connectivity_needed = "cellular";
    if (storage_min) task.storage_min = storage_min;
    if (priorities.length) task.use = priorities;
  }
  if (category === "tv" && priorities.length) task.priorities = priorities;
  // Decision Card v1, ruling B1 (2026-08-22): a requested screen size («تلفزيون 75 بوصة»),
  // DISCLOSURE ONLY — never read by decideTv()'s ranking/eligibility, only compared to the
  // winning pick's dna.screen_size downstream (decide/route.ts) to caption an honest
  // mismatch. Reuses `extractSpecsFromTitle`'s existing inch regex — the SAME extraction a
  // product title goes through — rather than a second, possibly-diverging regex.
  if (category === "tv") {
    const requestedSize = extractSpecsFromTitle(text).screen_size;
    if (requestedSize) {
      task.screen_size_requested = Number(requestedSize);
      // Intent Router follow-up #3 (2026-08-23) — see `parseScreenSizeComparator`'s own doc
      // comment. DISCLOSURE ONLY, same rule as screen_size_requested itself.
      task.screen_size_comparator = parseScreenSizeComparator(x);
    }
  }
  if (category === "mobile" && storage_min) task.storage_min = storage_min;
  if (category === "laptop") {
    if (storage_min) task.storage_min = storage_min;
    // "16 رام" (bare digit + رام, no جيجا/gb between) is the common colloquial form —
    // e.g. the founder's own D→E mission Part C example phrase "ابيه 16 رام" — not just
    // the fuller "16 جيجا رام" / "16GB رام". Both sides ("X رام" and "رام X") stay optional
    // on the جيجا/gb unit word so either phrasing parses to the same ram_min signal.
    const rm = x.match(/(\d{1,2})\s*(?:(?:جيجا|gb)\s*)?رام|رام\s*(?:(?:من|قدرها)\s*)?(\d{1,2})/);
    const r = rm ? Number(rm[1] || rm[2]) : null;
    if (r && [4, 8, 16, 32, 64].includes(r)) (task as ParsedTask & { ram_min?: number }).ram_min = r;
  }
  // Capacity, category-gated — see the shared doc comment on `parseCapacityKg` above.
  if (category === "washing_machine") {
    const kg = parseCapacityKg(x);
    if (kg) task.capacity_kg_requested = kg;
  }
  if (category === "refrigerator") {
    const liters = parseCapacityLiters(x);
    if (liters) task.capacity_liters_requested = liters;
  }
  if (category === "dishwasher") {
    const settings = parseCapacitySettings(x);
    if (settings) task.capacity_settings_requested = settings;
  }
  return task;
}
