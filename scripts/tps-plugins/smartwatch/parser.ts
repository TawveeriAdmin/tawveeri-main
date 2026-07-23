// scripts/tps-plugins/smartwatch/parser.ts
// ─────────────────────────────────────────────────────────────────────────────
// Smartwatch normalization (ADR-066) — bilingual, config-driven, tier-validated.
//
// A watch SKU is genuinely distinguished by CASE SIZE and CONNECTIVITY, not just
// model: an "Apple Watch Ultra 3 49mm Cellular" and a 42mm GPS Series are
// different products at materially different prices, and merging them would
// misprice the comparison. Colour and strap material are Commercial Variants and
// never enter identity (Constitution Art. III).
//
// Real Saudi listings this was built from:
//   ابل، ساعة الترا 3، جي بي اس، خاصية الاتصال، 49 ملم، غطاء تيتانيوم أسود
//   هواوي ساعة فيت 3، 45 مم، أخضر
//   شاومي، ساعة ذكية باند 9، أزرق
//   ميبرو، ساعة ذكية لايت 3 برو، أخضر
// ─────────────────────────────────────────────────────────────────────────────
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
import { normalizeArabic, bounded, LB, RB } from "../mobile/text";

interface FamilyRule { family: string; gen: RegExp; named?: { re: RegExp; generation: string }[] }

const BRAND_FAMILIES: Record<string, FamilyRule[]> = {
  apple: [{
    family: "Apple Watch",
    gen: new RegExp(`(?:series|سيريس)\\s*(\\d{1,2})${RB}`),
    named: [
      { re: bounded("ultra|الترا"), generation: "Ultra" },
      { re: bounded("se|اس اي"), generation: "SE" },
    ],
  }],
  // Each rule below is anchored to a MEASURED miss on a brand sold by >=2
  // merchants, i.e. a lost comparison — not speculative coverage.
  samsung: [
    {
      family: "Galaxy Watch Ultra",
      gen: new RegExp(`(?:جالكسي|جالاكسي|galaxy)\\s*(\\d{1,2})\\s*(?:الترا|اولترا|ultra)${RB}`),
      // "سامسونج جالاكسي ساعة الترا 2025، 47 مم" — Samsung's Ultra line carries a
      // model YEAR rather than a generation number, and the word order puts
      // "ساعة" between the line and the variant. 10 measured misses on a
      // five-merchant brand, so each one is a lost comparison.
      named: [{ re: new RegExp(`(?:جالكسي|جالاكسي|galaxy)\\s*(?:ساعه|watch)\\s*(?:الترا|اولترا|ultra)`), generation: "Ultra" }],
    },
    // "ساعة سامسونج جالكسي 8 كلاسيك" — the line number follows Galaxy, not "watch".
    { family: "Galaxy Watch", gen: new RegExp(`(?:جالكسي|جالاكسي|galaxy)\\s*(?:watch|ووتش)?\\s*(\\d{1,2})${RB}`) },
    { family: "Galaxy Fit", gen: new RegExp(`(?:fit|فيت)\\s*(\\d{1,2})${RB}`) },
  ],
  huawei: [
    { family: "Huawei Watch Fit", gen: new RegExp(`(?:fit|فيت)\\s*(\\d{1,2})${RB}`) },
    { family: "Huawei Watch GT Runner", gen: new RegExp(`(?:gt|جي تي)\\s*(?:runner|رانر)\\s*(\\d{1,2})${RB}`) },
    { family: "Huawei Watch GT", gen: new RegExp(`(?:gt|جي تي)\\s*(\\d{1,2})${RB}`) },
    { family: "Huawei Band", gen: new RegExp(`(?:band|باند)\\s*(\\d{1,2})${RB}`) },
    // "هواوي، ساعة 5، 42 ملم" — Huawei's flagship line is written as a bare
    // "watch N" in Arabic. Last, so the specific lines above win.
    { family: "Huawei Watch", gen: new RegExp(`(?:ساعه|watch)\\s*(\\d{1,2})${RB}`) },
  ],
  honor: [
    { family: "Honor Choice Watch", gen: new RegExp(`(?:choice|تشويز)[^0-9]{0,18}?(\\d{1,2}\\s*(?:i|اي)?)${RB}`) },
    { family: "Honor Watch X", gen: new RegExp(`${LB}x\\s*(\\d{1,2}\\s*[a-z]?)${RB}`) },
    { family: "Honor Watch", gen: new RegExp(`(?:watch|ساعه)\\s*(\\d{1,2})${RB}`) },
    { family: "Honor Band", gen: new RegExp(`(?:band|باند)\\s*(\\d{1,2})${RB}`) },
  ],
  xiaomi: [
    // "ريدمي ووتش 5 اكتيف" and the shorter "ريدمي 5" are the same product line.
    { family: "Redmi Watch", gen: new RegExp(`(?:redmi|ريدمي)\\s*(?:watch|ووتش)?\\s*(\\d{1,2})${RB}`) },
    { family: "Xiaomi Band", gen: new RegExp(`(?:band|باند)\\s*(\\d{1,2})${RB}`) },
    { family: "Xiaomi Watch", gen: new RegExp(`(?:watch|ساعه)\\s*(\\d{1,2})${RB}`) },
  ],
  aukey: [
    // Sold by 2 merchants and previously 0/12 identified — a pure lost comparison.
    { family: "Aukey Smartwatch", gen: new RegExp(`(?:الترا|ultra)\\s*(\\d{0,2})${RB}`) },
    { family: "Aukey Smartwatch", gen: new RegExp(`${LB}(\\d{1,2}\\s*(?:s|اس)?)${RB}`) },
  ],
  // The Saudi wearable long tail. These brands name models with a bare letter+
  // digit code (Mibro C4, Kieslect KS Pro, Amazfit GTR 4), so the "family" is the
  // code itself rather than a marketing line.
  mibro: [
    // Mibro model codes are transliterated letter-by-letter in Arabic:
    // "سي 4" = C4, "ايه 3" = A3, "ميبرواي 3" = Mibro A3.
    { family: "Mibro Lite", gen: new RegExp(`(?:lite|لايت)\\s*(\\d{1,2})${RB}`) },
    { family: "Mibro C", gen: new RegExp(`(?:${LB}c|سي)\\s*(\\d{1,2})${RB}`) },
    { family: "Mibro A", gen: new RegExp(`(?:${LB}a|ايه|ميبرواي)\\s*(\\d{1,2})${RB}`) },
    { family: "Mibro", gen: new RegExp(`${LB}([a-z]{1,3}\\s*\\d{1,2})${RB}`) },
  ],
  kieslect: [
    { family: "Kieslect", gen: new RegExp(`${LB}(k[rs]\\s*-?\\s*\\d{1,2})${RB}`) },
    { family: "Kieslect KS", gen: new RegExp(`${LB}(ks)${RB}`) },
  ],
  oraimo: [
    // Sold by 2 merchants, previously 0/8 identified. Lines: "الذكية 5 لايت",
    // "نوفا اي ام" (Nova AM), plus the OSW-### model code in the title.
    { family: "Oraimo Nova", gen: new RegExp(`(?:نوفا|nova)\\s*([a-z]{0,2}\\s*(?:اي ام)?\\d{0,2})${RB}`) },
    { family: "Oraimo Watch", gen: new RegExp(`${LB}osw\\s*-?\\s*(\\d{3,4})${RB}`) },
    { family: "Oraimo Watch", gen: new RegExp(`(?:الذكيه|ساعه)\\s*(\\d{1,2})${RB}`) },
  ],
  amazfit: [
    { family: "Amazfit GTR", gen: new RegExp(`(?:gtr|جي تي ار)\\s*(\\d{1,2})${RB}`) },
    { family: "Amazfit GTS", gen: new RegExp(`(?:gts)\\s*(\\d{1,2})${RB}`) },
    { family: "Amazfit Bip", gen: new RegExp(`(?:bip|بيب)\\s*(\\d{1,2})${RB}`) },
  ],
  fitbit: [
    { family: "Fitbit Versa", gen: new RegExp(`(?:versa|فيرسا)\\s*(\\d{1,2})${RB}`) },
    { family: "Fitbit Charge", gen: new RegExp(`(?:charge|تشارج)\\s*(\\d{1,2})${RB}`) },
  ],
  garmin: [
    // Garmin names its running line "Forerunner", transliterated several ways by
    // Saudi retailers: فوررنر / فور رانر / فورنر / فوريرنر.
    // Saudi retailers write the model number on EITHER side of the line name:
    // "فوررنر 265" and "للجري 265 من فوررنر" are the same product.
    { family: "Garmin Forerunner", gen: new RegExp(`(?:forerunner|فوررنر|فور رانر|فورنر|فوريرنر)\\s*(\\d{2,4})${RB}`) },
    { family: "Garmin Forerunner", gen: new RegExp(`(\\d{2,4})\\s*(?:من\\s*)?(?:forerunner|فوررنر|فور رانر|فورنر|فوريرنر)${RB}`) },
    { family: "Garmin Fenix", gen: new RegExp(`(?:fenix|فينكس)\\s*(\\d{1,2})${RB}`) },
    { family: "Garmin Venu", gen: new RegExp(`(?:venu|فينو)\\s*(\\d{1,2})${RB}`) },
  ],
};

/**
 * Brand inferred from the TITLE when the store supplies none.
 *
 * Measured need: Jarir and Amazon publish `brand: "Unknown"` on wearables whose
 * titles clearly say "Honor Watch 5" or "Apple Watch SE 3". Rejecting those for a
 * missing brand discarded real, identifiable products — the title is evidence too.
 */
const BRAND_FROM_TITLE: [RegExp, string][] = [
  [bounded("apple watch|ابل|آبل"), "apple"],
  [bounded("galaxy watch|galaxy fit|samsung|سامسونج"), "samsung"],
  [bounded("huawei|هواوي"), "huawei"],
  [bounded("honor|هونر"), "honor"],
  [bounded("xiaomi|شاومي|mi band|redmi"), "xiaomi"],
  [bounded("amazfit|امازفيت"), "amazfit"],
  [bounded("garmin|جارمين|قارمين|غارمين"), "garmin"],
  [bounded("fitbit|فيتبيت"), "fitbit"],
  [bounded("mibro|ميبرو"), "mibro"],
  [bounded("kieslect|كيسليكت"), "kieslect"],
  [bounded("aukey|اوكي|أوكي"), "aukey"],
];

/** Case sizes real watches ship in (mm). Anything else is not a case size. */
const CASE_SIZES = new Set([38, 40, 41, 42, 43, 44, 45, 46, 47, 49, 51]);

function readCaseSize(text: string): number | null {
  for (const m of text.matchAll(new RegExp(`(\\d{2})\\s*(?:مم|ملم|ملي|mm)${RB}`, "g"))) {
    const n = Number(m[1]);
    if (CASE_SIZES.has(n)) return n;
  }
  return null;
}

/** Cellular is a different SKU at a different price — identity, not commercial. */
function readConnectivity(text: string): string {
  if (bounded("cellular|esim|الاتصال|جي اس ام|lte").test(text)) return "cellular";
  return "gps"; // GPS-only is the base configuration
}

const VARIANTS: [RegExp, string][] = [
  [bounded("pro\\s*max|برو\\s*ماكس"), "Pro Max"],
  [bounded("ultra|الترا"), "Ultra"],
  [bounded("pro|برو"), "Pro"],
  [bounded("lite|لايت"), "Lite"],
  [bounded("active|اكتيف"), "Active"],
  [bounded("classic|كلاسيك"), "Classic"],
];

export function normalize(
  nameAr: string, nameEn: string, rawBrand: string | null, _payload?: Record<string, unknown>
): NormalizeResult {
  const text = normalizeArabic(`${nameAr} ${nameEn}`);
  let brand = canonicalizeBrand(rawBrand);
  // Stores publish `brand: "Unknown"` on wearables whose title names the brand
  // outright; the title is evidence, so read it rather than discard the product.
  if (!brand || brand === "unknown") {
    for (const [re, b] of BRAND_FROM_TITLE) if (re.test(text)) { brand = b; break; }
  }

  let family: string | null = null, generation: string | null = null;
  for (const rule of BRAND_FAMILIES[brand] ?? []) {
    for (const n of rule.named ?? []) {
      if (n.re.test(text)) { family = rule.family; generation = n.generation; break; }
    }
    if (generation) break;
    const m = rule.gen.exec(text);
    if (m) { family = rule.family; generation = m[1]; break; }
  }

  let variant: string | null = null;
  if (family) { for (const [re, v] of VARIANTS) if (re.test(text)) { variant = v; break; } }

  const size_mm = readCaseSize(text);
  const connectivity = readConnectivity(text);

  const ambiguity_flags: string[] = [];
  if (!family) ambiguity_flags.push("family_missing");
  if (!generation) ambiguity_flags.push("generation_missing");
  if (size_mm === null) ambiguity_flags.push("size_missing");

  return {
    model_number: null,
    color: null,
    //  is carried in the payload so buildIdentityKey uses the INFERRED
    // brand. Re-deriving it there from the raw value discarded the inference and
    // rejected every product whose store published brand: "Unknown".
    payload: { brand, family, generation, variant: variant ?? "Standard", size_mm, connectivity },
    ignored_terms: [],
    ambiguity_flags,
  };
}
