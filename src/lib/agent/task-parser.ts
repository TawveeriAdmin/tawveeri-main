// src/lib/agent/task-parser.ts
// E15.5 — deterministic natural-language → ShoppingTask parser (Arabic + English).
// A real shopping task ("مكيف لغرفة 30 متر في الرياض، هادئ وموفر للكهرباء، تحت 4000")
// is turned into a structured task the deterministic Decision Agent consumes. NO
// LLM — pure keyword/number extraction, so it is reproducible and testable. Unknown
// beats incorrect: fields it cannot extract stay undefined (never guessed).
import type { ShoppingTask } from "./decision-engine";

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

function parseCategory(x: string): string | null {
  if (/مكيف|تكييف|air ?condition|\bac\b|split ac/.test(x)) return "air_conditioner";
  // Plural/ه-spelling stems (measured 2026-08-04): «شاشات», «ثلاجات», «غسالات» classified
  // as NO category, so plural browse queries lost routing while their singulars worked.
  if (/تلفزيون|تليفزيون|شاش[ةه]|شاشات|television|\btv\b|smart tv/.test(x)) return "tv";
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
  if (/جوال|هاتف|ايفون|iphone|smartphone|galaxy s|\bphone\b/.test(x)) return "mobile";
  if (/كاميرا|camera|dslr|mirrorless|eos/.test(x)) return "camera";
  // Appliances — ORDER MATTERS: dishwasher (غسالة صحون) before washing_machine (غسالة);
  // air_fryer (قلاية) and coffee_maker (specific) before generic checks.
  if (/غسال[ةه] صحون|غسالات صحون|غسالة أطباق|dishwasher|dish washer/.test(x)) return "dishwasher";
  if (/مايكرويف|ميكروويف|ميكرويف|microwave/.test(x)) return "microwave";
  if (/قلاية هوائية|قلايه هوائية|air ?fryer|قلاية بدون زيت/.test(x)) return "air_fryer";
  if (/منقي هواء|منقّي هواء|air purifier|air cleaner/.test(x)) return "air_purifier";
  if (/مكنسة|مكنسه|vacuum|hoover/.test(x)) return "vacuum";
  if (/ماكينة قهوة|صانعة قهوة|coffee maker|coffee machine|espresso|اسبريسو|إسبريسو|nespresso/.test(x)) return "coffee_maker";
  if (/غلاية|غلايه|electric kettle|\bkettle\b/.test(x)) return "kettle";
  if (/محمصة|محمصه|toaster/.test(x)) return "toaster";
  if (/خلاط|blender/.test(x)) return "blender";
  if (/فرن كهربائي|فرن غاز|فرن مدمج|built-?in oven|electric oven|gas oven/.test(x)) return "oven";
  if (/ثلاج|refrigerator|fridge|freezer/.test(x)) return "refrigerator";
  if (/غسال|washing machine|washer|نشاف|dryer/.test(x)) return "washing_machine";
  return null;
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

function parseStorageMin(x: string): number | undefined {
  const m = x.match(/(\d{2,4})\s*(?:جيجا|gb)\s*(?:على الأقل|أو أكثر|فأكثر|min|or more)?/);
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

export interface ParsedTask extends ShoppingTask {
  use?: string[];
  connectivity_needed?: string;
  storage_min?: number;
  ram_min?: number;
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
  'kettle', 'toaster', 'blender', 'oven', 'refrigerator', 'washing_machine',
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
  const room_size_m2 = parseRoomSize(x);
  const budget_total = parseBudget(x);
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
    fuel_type,
    room_size_m2, city, priorities: priorities.length ? priorities : undefined,
    budget_total: budget_total ?? undefined,
    quantity,
    wants_cheapest: wants_cheapest || undefined,
    wants_recommendation: wantsRecommendation(x) || undefined,
    wants_discount: wantsDiscount(x) || undefined,
    budget_referenced: budget_referenced || undefined,
    use_case_referenced: use_case_referenced || undefined,
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
  return task;
}
