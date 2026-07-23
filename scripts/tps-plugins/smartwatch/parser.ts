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
  samsung: [
    { family: "Galaxy Watch", gen: new RegExp(`(?:watch|ووتش)\\s*(\\d{1,2})${RB}`) },
    { family: "Galaxy Fit", gen: new RegExp(`(?:fit|فيت)\\s*(\\d{1,2})${RB}`) },
  ],
  huawei: [
    { family: "Huawei Watch Fit", gen: new RegExp(`(?:fit|فيت)\\s*(\\d{1,2})${RB}`) },
    { family: "Huawei Watch GT", gen: new RegExp(`(?:gt|جي تي)\\s*(\\d{1,2})${RB}`) },
    { family: "Huawei Band", gen: new RegExp(`(?:band|باند)\\s*(\\d{1,2})${RB}`) },
  ],
  honor: [
    { family: "Honor Watch", gen: new RegExp(`(?:watch|ساعه)\\s*x?\\s*(\\d{1,2})${RB}`) },
    { family: "Honor Band", gen: new RegExp(`(?:band|باند)\\s*(\\d{1,2})${RB}`) },
  ],
  xiaomi: [
    { family: "Xiaomi Band", gen: new RegExp(`(?:band|باند)\\s*(\\d{1,2})${RB}`) },
    { family: "Xiaomi Watch", gen: new RegExp(`(?:watch|ساعه)\\s*(\\d{1,2})${RB}`) },
  ],
  // The Saudi wearable long tail. These brands name models with a bare letter+
  // digit code (Mibro C4, Kieslect KS Pro, Amazfit GTR 4), so the "family" is the
  // code itself rather than a marketing line.
  mibro: [
    { family: "Mibro", gen: new RegExp(`${LB}([a-z]{1,3}\\s*\\d{1,2})${RB}`) },
    { family: "Mibro Lite", gen: new RegExp(`(?:lite|لايت)\\s*(\\d{1,2})${RB}`) },
  ],
  kieslect: [
    { family: "Kieslect", gen: new RegExp(`${LB}(k[rs]\\s*-?\\s*\\d{1,2})${RB}`) },
    { family: "Kieslect KS", gen: new RegExp(`${LB}(ks)${RB}`) },
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
};

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
  const brand = canonicalizeBrand(rawBrand);

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
    payload: { family, generation, variant: variant ?? "Standard", size_mm, connectivity },
    ignored_terms: [],
    ambiguity_flags,
  };
}
