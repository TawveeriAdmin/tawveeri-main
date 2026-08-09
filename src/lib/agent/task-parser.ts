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
  if (/لابتوب|لاب توب|laptop|notebook|macbook/.test(x)) return "laptop";
  if (/سماعة|سماعات|headphone|earbuds|airpods|speaker|مكبر صوت/.test(x)) return "audio";
  if (/كاميرا|camera|dslr|mirrorless|eos/.test(x)) return "camera";
  if (/جوال|هاتف|ايفون|iphone|smartphone|galaxy s/.test(x)) return "mobile";
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
  const m = x.match(/(?:تحت|أقل من|اقل من|ميزانية|ميزانيتي|في حدود|بحدود|حدود|يتعدى|under|below|budget|max)\s*([\d,]{3,7})/) ||
            x.match(/([\d,]{3,7})\s*(?:ريال|sar\b|sr\b)/);
  if (m) { const n = Number(m[1].replace(/,/g, "")); if (n >= 100 && n <= 500000) return n; }
  return undefined;
}

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

function parsePriorities(x: string): string[] {
  const p = new Set<string>();
  // «هادي» (no hamza) added 2026-08-09 — colloquial spelling measured live in the founder's
  // Golden Query; «هادئ» alone missed the everyday-typed form (same class as CHECKPOINT #17).
  if (/هادئ|هادي|هادى|هدوء|صامت|quiet|silent|low ?noise/.test(x)) p.add("quiet");
  if (/موفر|توفير|كهرباء|فاتورة|اقتصادي|low ?electric|energy ?saving|efficient/.test(x)) p.add("low_electricity");
  if (/تدفئة|دفء|حار وبارد|heating|warm|hot ?and ?cold/.test(x)) p.add("heating");
  if (/ألعاب|العاب|قيمنق|gaming|games/.test(x)) p.add("gaming");
  if (/أفلام|افلام|سينما|movies|cinema|netflix/.test(x)) p.add("movies");
  if (/رياضة|كرة|مباريات|sports|football/.test(x)) p.add("sports");
  if (/غرفة مضيئة|إضاءة|bright ?room|sunny/.test(x)) p.add("bright_room");
  if (/إنتاجية|انتاجية|عمل|productivity|work|office/.test(x)) p.add("productivity");
  if (/قراءة|reading|كتب|books/.test(x)) p.add("reading");
  if (/كاميرا|تصوير|صور|camera|photo/.test(x)) p.add("camera");
  if (/بطارية|battery/.test(x)) p.add("battery");
  if (/أحدث|احدث|جديد|latest|newest/.test(x)) p.add("latest");
  if (/خفيف|محمول|portable|lightweight|light ?weight|للسفر|travel/.test(x)) p.add("portability");
  if (/كبير|كبيرة|عائلة|عائلية|large|family|big/.test(x)) p.add("large");
  return [...p];
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

export interface ParsedTask extends ShoppingTask {
  use?: string[];
  connectivity_needed?: string;
  storage_min?: number;
  ram_min?: number;
  parsed_from_text: string;
  unresolved?: string[]; // fields the parser could not extract (fail-loud transparency)
}

/** Parse free-text into a ShoppingTask. Returns null category if undetectable. */
export function parseShoppingTask(text: string): ParsedTask {
  const x = norm(text);
  const category = parseCategory(x);
  const room_size_m2 = parseRoomSize(x);
  const budget_total = parseBudget(x);
  const quantity = parseQuantity(x, category);
  const priorities = parsePriorities(x);
  const connectivity = parseConnectivity(x);
  const city = parseCity(x);
  const storage_min = parseStorageMin(x);

  const unresolved: string[] = [];
  if (!category) unresolved.push("category");
  if (category === "air_conditioner" && !room_size_m2) unresolved.push("room_size_m2");

  const task: ParsedTask = {
    category: category ?? "",
    room_size_m2, city, priorities: priorities.length ? priorities : undefined,
    budget_total: budget_total ?? undefined,
    quantity,
    parsed_from_text: text, unresolved: unresolved.length ? unresolved : undefined,
  };
  // Tablet-specific structured fields.
  if (category === "tablet") {
    if (connectivity === "cellular") task.connectivity_needed = "cellular";
    if (storage_min) task.storage_min = storage_min;
    if (priorities.length) task.use = priorities;
  }
  if (category === "tv" && priorities.length) task.priorities = priorities;
  if (category === "mobile" && storage_min) task.storage_min = storage_min;
  if (category === "laptop") { if (storage_min) task.storage_min = storage_min; const rm = x.match(/(\d{1,2})\s*(?:جيجا|gb)\s*رام|رام\s*(\d{1,2})/); const r = rm ? Number(rm[1] || rm[2]) : null; if (r && [4, 8, 16, 32, 64].includes(r)) (task as ParsedTask & { ram_min?: number }).ram_min = r; }
  return task;
}
