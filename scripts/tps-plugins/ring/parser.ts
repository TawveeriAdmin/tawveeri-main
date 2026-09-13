// scripts/tps-plugins/ring/parser.ts
// Smart-ring identity contract (ADR-351): brand | family | material.
//
// Ring SIZE (a numeric fit, like a clothing size — Samsung ships Galaxy Ring in
// sizes 6-15) is deliberately EXCLUDED from identity: every size of the same
// ring/material ships at the SAME price, so treating each size as a separate
// product would fragment one comparable item into a dozen incomparable ones —
// the same "commercial variant, not identity" principle mobile applies to
// color. Material/finish (Titanium Black/Gold/Silver) IS kept as part of
// identity: Samsung assigns each material its OWN model code, and unlike size,
// a color/finish line is the conventional GTIN-level variant boundary (GS1).
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

const BRAND_FROM_TITLE: [RegExp, string][] = [
  [/galaxy ring|samsung|سامسونج/i, "samsung"],
  [/\boura\b/i, "oura"],
  [/ringconn/i, "ringconn"],
  [/circular ring|\bcircular\b/i, "circular"],
  [/ultrahuman/i, "ultrahuman"],
];

const FAMILY_FROM_TITLE: [RegExp, string][] = [
  [/galaxy ring/i, "Galaxy Ring"],
  [/oura ring|\boura\b/i, "Oura Ring"],
  [/ringconn gen\s*(\d)/i, "RingConn Gen"], // generation handled via material fallback below if unmatched
  [/ringconn/i, "RingConn"],
  [/circular ring/i, "Circular Ring"],
  [/ultrahuman ring/i, "Ultrahuman Ring"],
];

const MATERIALS: [RegExp, string][] = [
  [/titanium\s*black|أسود\s*تيتانيوم/i, "Titanium Black"],
  [/titanium\s*gold|ذهبي\s*تيتانيوم/i, "Titanium Gold"],
  [/titanium\s*silver|فضي\s*تيتانيوم/i, "Titanium Silver"],
  [/\btitanium\b/i, "Titanium"],
  [/\bblack\b|أسود/i, "Black"],
  [/\bgold\b|ذهبي/i, "Gold"],
  [/\bsilver\b|فضي/i, "Silver"],
];

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null): NormalizeResult {
  const text = `${nameAr} ${nameEn}`;
  let brand = canonicalizeBrand(rawBrand);
  if (!brand || brand === "unknown" || brand === "other") {
    for (const [re, b] of BRAND_FROM_TITLE) if (re.test(text)) { brand = b; break; }
  }

  let family: string | null = null;
  for (const [re, f] of FAMILY_FROM_TITLE) if (re.test(text)) { family = f; break; }

  let material: string | null = null;
  for (const [re, m] of MATERIALS) if (re.test(text)) { material = m; break; }

  const ambiguity_flags: string[] = [];
  if (!family) ambiguity_flags.push("family_missing");

  return {
    model_number: null,
    color: null,
    payload: { brand, family, material: material ?? "Standard" },
    ignored_terms: [],
    ambiguity_flags,
  };
}
