// scripts/tps-plugins/mobile/parser.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mobile normalization — bilingual, multi-brand, tier-validated (ADR-061).
//
// Rewritten from production evidence. The previous version handled only Apple
// and Samsung, matched raw Arabic substrings, and had no storage validation.
// Measured failures it produced (1,789 of 2,070 claimed listings):
//   • 778 + 497  accessories and other categories — now rejected by the detector
//   • 227  "جالاكسي، اس 25 الترا" — an Arabic comma defeated `\s+`, and the
//          Arabic transliterations اس (S), ايه (A), الترا (Ultra) were unknown
//   • 119  "أيفون 15" — the أ spelling was absent, so an entire store failed;
//          and "ايفون اير" (iPhone Air) has a NAMED generation, not a number
//   • 111 + 24  "1 تيرابايت" / "2 تيرا" — terabytes in Arabic were unparsed
//   •      "8 جيجابايت رام" became a STORAGE identity (`…|Standard|4`) because
//          two storage regexes returned without a range check
//
// Design: all text is folded once by `normalizeArabic`, then a per-brand config
// drives family/generation/variant. Adding a brand is DATA, not code — the
// long-tail brands (Xiaomi, Honor, Huawei, Oppo, realme, vivo, OnePlus, Google,
// Nothing, Tecno, Infinix) are entries in one table.
// ─────────────────────────────────────────────────────────────────────────────
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
import { normalizeArabic, STORAGE_TIERS, RAM_TIERS, bounded, LB, RB } from "./text";

// ── Variant vocabulary (bilingual) ───────────────────────────────────────────
// Order matters: longer forms first so "pro max" wins over "pro".
const VARIANTS: [RegExp, string][] = [
  [bounded("pro\\s*max|برو\\s*ماكس"), "Pro Max"],
  [bounded("ultra|الترا|اولترا"), "Ultra"],
  [bounded("pro\\s*\\+|pro\\s*plus|برو\\s*بلس"), "Pro Plus"],
  [bounded("pro|برو"), "Pro"],
  [bounded("plus|بلس|بلاس"), "Plus"],
  [bounded("max|ماكس"), "Max"],
  [bounded("mini|ميني"), "Mini"],
  [bounded("fe|اف اي"), "FE"],
  [bounded("edge|ايدج"), "Edge"],
  [bounded("lite|لايت"), "Lite"],
  [bounded("air|اير"), "Air"],
];

function readVariant(text: string): string | null {
  for (const [re, v] of VARIANTS) if (re.test(text)) return v;
  return null;
}

/** A brand's product lines. `gen` captures the generation token. */
interface FamilyRule {
  family: string;
  /** Must capture the generation in group 1. */
  gen: RegExp;
  /** Optional fixed generation for named models (e.g. iPhone Air). */
  named?: { re: RegExp; generation: string; variant?: string }[];
}

const BRAND_FAMILIES: Record<string, FamilyRule[]> = {
  apple: [{
    family: "iPhone",
    gen: /(?:iphone|ايفون)\s*(\d{1,2})/,
    // iPhone Air / iPhone SE carry a NAME where other models carry a number.
    named: [
      { re: /(?:iphone|ايفون)\s*(?:air|اير)/, generation: "Air", variant: "Standard" },
      { re: /(?:iphone|ايفون)\s*(?:se|اس اي)/, generation: "SE", variant: "Standard" },
    ],
  }],
  samsung: [
    { family: "Galaxy Z", gen: /(?:z\s*fold|زد\s*فولد|فولد)\s*(\d{1,2})/ },
    { family: "Galaxy Z", gen: /(?:z\s*flip|زد\s*فليب|فليب)\s*(\d{1,2})/ },
    // Line letter must be its own token: `اس 25`, `s 25`, `s25` — but never the
    // "س" inside سامسونج or the "a" inside a longer Latin word.
    { family: "Galaxy S", gen: new RegExp(`${LB}(?:s|اس)\\s*(\\d{2})${RB}`) },
    { family: "Galaxy A", gen: new RegExp(`${LB}(?:a|ايه)\\s*(\\d{2})${RB}`) },
    { family: "Galaxy M", gen: new RegExp(`${LB}(?:m|ام)\\s*(\\d{2})${RB}`) },
    { family: "Galaxy Note", gen: /(?:note|نوت)\s*(\d{1,2})/ },
  ],
  xiaomi: [
    { family: "Redmi Note", gen: /(?:redmi|ريدمي)\s*(?:note|نوت)\s*(\d{1,2})/ },
    { family: "Redmi", gen: /(?:redmi|ريدمي)\s*(\d{1,2})/ },
    { family: "POCO", gen: /(?:poco|بوكو)\s*([a-z]?\d{1,2})/ },
    // Xiaomi's budget A-series, written "شاومي ايه 5" in Arabic. 31 measured
    // misses on a three-merchant brand — every one a lost comparison.
    { family: "Xiaomi A", gen: /(?:xiaomi|شاومي)\s*(?:\ba\b|ايه)\s*(\d{1,2})/ },
    { family: "Xiaomi", gen: /(?:xiaomi|شاومي)\s*(\d{1,2})/ },
  ],
  honor: [
    { family: "Honor Magic", gen: /(?:magic|ماجيك)\s*(\d{1,2})/ },
    { family: "Honor X", gen: /(?:honor|هونر)\s*x\s*(\d{1,2})/ },
    { family: "Honor", gen: /(?:honor|هونر)\s*(\d{1,2})/ },
  ],
  huawei: [
    { family: "Huawei Mate", gen: /(?:mate|ميت)\s*(\d{1,2})/ },
    { family: "Huawei nova", gen: /(?:nova|نوفا)\s*(\d{1,2})/ },
    { family: "Huawei P", gen: /(?:huawei|هواوي)\s*p\s*(\d{1,2})/ },
  ],
  oppo: [
    { family: "OPPO Reno", gen: /(?:reno|رينو)\s*(\d{1,2})/ },
    { family: "OPPO Find", gen: /(?:find|فايند)\s*([a-z]?\d{1,2})/ },
    { family: "OPPO A", gen: /(?:oppo|اوبو)\s*a\s*(\d{1,3})/ },
  ],
  realme: [
    { family: "realme Note", gen: /(?:realme|ريلمي)\s*(?:note|نوت)\s*(\d{1,2})/ },
    { family: "realme", gen: /(?:realme|ريلمي)\s*(?:\bc\b)?\s*(\d{1,2})/ },
  ],
  vivo: [
    { family: "vivo Y", gen: /(?:vivo|فيفو)\s*y\s*(\d{1,3})/ },
    { family: "vivo V", gen: /(?:vivo|فيفو)\s*v\s*(\d{1,2})/ },
  ],
  oneplus: [
    { family: "OnePlus Nord", gen: /(?:nord|نورد)\s*(\d{1,2})/ },
    { family: "OnePlus", gen: /(?:oneplus|ون بلس)\s*(\d{1,2})/ },
  ],
  google: [{ family: "Pixel", gen: /(?:pixel|بكسل|بيكسل)\s*(\d{1,2})/ }],
  tecno: [
    { family: "Tecno Spark", gen: /(?:spark|سبارك)\s*(\d{1,2})/ },
    { family: "Tecno Camon", gen: /(?:camon|كامون)\s*(\d{1,2})/ },
    // Pova is Tecno's largest Saudi line and was missing entirely — 36 measured
    // misses. "Curve" is a named model with no generation number.
    { family: "Tecno Pova", gen: /(?:pova|بوفا)\s*(\d{1,2})/, named: [{ re: /(?:pova|بوفا)\s*(?:curve|كيرف)/, generation: "Curve" }] },
    { family: "Tecno Spark", gen: /(?:go|جو)\s*(\d{1,2})/ },
  ],
  infinix: [
    { family: "Infinix Hot", gen: /(?:hot|هوت)\s*(\d{1,2})/ },
    { family: "Infinix Note", gen: /(?:note|نوت)\s*(\d{1,2})/ },
  ],
};

// ── Storage / RAM ────────────────────────────────────────────────────────────
/**
 * Read storage in GB. Every candidate must land on a real storage tier, and any
 * figure explicitly labelled RAM is excluded first. Returns null rather than a
 * guess — a wrong storage value forks one product into two identities.
 */
function readStorageAndRam(text: string): { storage_gb: number | null; ram_gb: number | null } {
  let ram: number | null = null;

  // RAM first, so its digits can never be mistaken for storage.
  const ramMatch =
    text.match(/(\d{1,2})\s*(?:جيجابايت|جيجا|gb|g)\s*(?:رام|ram)/) ||
    text.match(/(?:رام|ram)\s*(\d{1,2})\s*(?:جيجابايت|جيجا|gb|g)?/);
  if (ramMatch) { const n = Number(ramMatch[1]); if (RAM_TIERS.has(n)) ram = n; }

  // Terabytes, both languages — "1 تيرابايت", "2 تيرا", "1TB".
  const tb = text.match(new RegExp(`(\\d)\\s*(?:تيرابايت|تيرا|tb)${RB}`));
  if (tb) {
    const gb = Number(tb[1]) * 1024;
    if (STORAGE_TIERS.has(gb)) return { storage_gb: gb, ram_gb: ram };
  }

  // An explicitly-labelled storage figure wins over a bare one.
  const labelled = text.match(/(?:سعه\s*تخزين|تخزين|storage)\s*(\d{2,4})\s*(?:جيجابايت|جيجا|gb)?/);
  if (labelled) { const n = Number(labelled[1]); if (STORAGE_TIERS.has(n)) return { storage_gb: n, ram_gb: ram }; }

  // Otherwise take the largest tier-valid figure that is not the RAM value.
  // Arabic listings use BOTH word orders — "128 جيجابايت" and "جيجابايت 128"
  // (the latter is how Almanea writes it), so both are collected.
  let best: number | null = null;
  const consider = (raw: string) => {
    const n = Number(raw);
    if (!STORAGE_TIERS.has(n)) return;
    if (ram !== null && n === ram) return;
    if (best === null || n > best) best = n;
  };
  for (const m of text.matchAll(new RegExp(`(\\d{2,4})\\s*(?:جيجابايت|جيجا|gb)${RB}`, "g"))) consider(m[1]);
  for (const m of text.matchAll(new RegExp(`(?:جيجابايت|جيجا|gb)\\s*(\\d{2,4})${RB}`, "g"))) consider(m[1]);
  return { storage_gb: best, ram_gb: ram };
}

// ── Commercial attributes (never part of identity) ───────────────────────────
const COLORS: [RegExp, string][] = [
  [bounded("titanium|تيتانيوم"), "titanium"], [bounded("black|اسود|سوداء"), "black"],
  [bounded("white|ابيض|بيضاء"), "white"], [bounded("blue|ازرق|زرقاء"), "blue"],
  [bounded("green|اخضر|خضراء"), "green"], [bounded("pink|وردي|زهري"), "pink"],
  [bounded("silver|فضي|فضيه"), "silver"], [bounded("gold|ذهبي|ذهبيه"), "gold"],
  [bounded("gray|grey|رمادي|رماديه"), "gray"], [bounded("purple|بنفسجي"), "purple"],
  [bounded("orange|برتقالي"), "orange"], [bounded("yellow|اصفر"), "yellow"],
  [bounded("red|احمر"), "red"],
];

export function normalize(
  nameAr: string, nameEn: string, rawBrand: string | null, rawPayload?: Record<string, unknown>
): NormalizeResult {
  const payload = rawPayload ?? {};
  const text = normalizeArabic(`${nameAr} ${nameEn}`);
  const brand = canonicalizeBrand(rawBrand) || inferBrand(text);

  let family: string | null = null, generation: string | null = null;
  // A NAMED model fixes its own variant: "iPhone Air" is generation Air, variant
  // Standard — the word "Air" must not also be read as a variant, or the same
  // phone splits into `iPhone|Air|Air` and `iPhone|Air|Standard`.
  let namedVariant: string | null = null;
  const rules = BRAND_FAMILIES[brand] ?? [];
  for (const rule of rules) {
    for (const n of rule.named ?? []) {
      if (n.re.test(text)) { family = rule.family; generation = n.generation; namedVariant = n.variant ?? "Standard"; break; }
    }
    if (generation) break;
    const m = rule.gen.exec(text);
    if (m) { family = rule.family; generation = m[1].toUpperCase(); break; }
  }

  // Samsung generations are conventionally written with their line letter.
  if (family === "Galaxy S" && generation) generation = `S${generation}`;
  if (family === "Galaxy A" && generation) generation = `A${generation}`;
  if (family === "Galaxy M" && generation) generation = `M${generation}`;
  if (family === "Galaxy Z" && generation) {
    generation = /fold|فولد/.test(text) ? `Z Fold ${generation}` : `Z Flip ${generation}`;
  }

  const variant = family ? (namedVariant ?? readVariant(text) ?? "Standard") : null;

  // Structured store fields beat text when present (Almanea publishes them).
  const payloadStorage = Number(payload.storage ?? payload.storage_gb ?? NaN);
  const fromText = readStorageAndRam(text);
  const storage_gb = STORAGE_TIERS.has(payloadStorage) ? payloadStorage : fromText.storage_gb;

  let color: string | null = null;
  for (const [re, c] of COLORS) if (re.test(text)) { color = c; break; }

  const network = bounded("5g|5 جي|الجيل الخامس").test(text) ? "5G"
    : bounded("4g|4 جي|lte").test(text) ? "4G" : null;

  const ambiguity_flags: string[] = [];
  if (!family) ambiguity_flags.push("family_missing");
  if (!generation) ambiguity_flags.push("generation_missing");
  if (storage_gb === null) ambiguity_flags.push("storage_missing");

  return {
    model_number: null,
    color,
    payload: { family, generation, variant, storage_gb, ram_gb: fromText.ram_gb, network, color },
    ignored_terms: [color, network].filter(Boolean) as string[],
    ambiguity_flags,
  };
}

/** Last resort: read the brand from the title when the store supplied none. */
function inferBrand(text: string): string {
  for (const key of Object.keys(BRAND_FAMILIES)) {
    for (const rule of BRAND_FAMILIES[key]) if (rule.gen.test(text)) return key;
  }
  return "unknown";
}
