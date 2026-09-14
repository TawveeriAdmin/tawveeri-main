// scripts/tps-plugins/stylus/parser.ts
// Standalone stylus identity contract: brand | compatible_family | compatible_generation.
//
// Colour is deliberately EXCLUDED from identity (same principle as ring's material choice,
// mobile's own colour exclusion): verified live on real Samsung KSA S Pen SKUs — every
// colour of "S Pen for Galaxy S23 Ultra" prices identically (219 SAR regardless of
// Beige/Green/Phantom Black) — so keying on colour would fragment one comparable product
// into several incomparable ones for zero real pricing signal.
//
// compatible_generation IS kept: a real Samsung KSA measurement (this mission) confirmed
// different generations of the same S Pen line are genuinely different manufactured units
// (different manufacturer part-number series — GH96-15658* for S23 Ultra vs GH96-20906*/
// EJ-PS948* for S26 Ultra) at potentially different specs/prices — never assume they're
// interchangeable.
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

const BRAND_FROM_TITLE: [RegExp, string][] = [
  [/samsung|سامسونج|galaxy/i, "samsung"],
];

// Order matters: more specific (Tab S) before the generic "Galaxy S" line.
const FAMILY_FROM_TITLE: [RegExp, string][] = [
  [/galaxy\s*tab\s*s/i, "Galaxy Tab S"],
  [/galaxy\s*z\s*fold/i, "Galaxy Z Fold"],
  [/galaxy\s*s(?!\s*pen)/i, "Galaxy S"],
];

/** e.g. "S Pen for Galaxy S23 Ultra" -> "S23 Ultra"; "for Galaxy Tab S11 and S11 Ultra" -> "S11". */
function extractGeneration(text: string): string | null {
  const m = text.match(/\b(s\d{2}|z\s*fold\s*\d{1,2})\s*(ultra|fe|plus|\+)?/i);
  if (!m) return null;
  const base = m[1].replace(/\s+/g, "").toUpperCase();
  const variant = m[2] ? ` ${m[2].charAt(0).toUpperCase()}${m[2].slice(1).toLowerCase()}` : "";
  return `${base}${variant}`.replace(/\s*\+$/, " Plus").trim();
}

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null): NormalizeResult {
  const text = `${nameAr} ${nameEn}`;
  let brand = canonicalizeBrand(rawBrand);
  if (!brand || brand === "unknown" || brand === "other") {
    for (const [re, b] of BRAND_FROM_TITLE) if (re.test(text)) { brand = b; break; }
  }

  let family: string | null = null;
  for (const [re, f] of FAMILY_FROM_TITLE) if (re.test(text)) { family = f; break; }

  const generation = extractGeneration(text);

  const ambiguity_flags: string[] = [];
  if (!family) ambiguity_flags.push("family_missing");
  if (!generation) ambiguity_flags.push("generation_missing");

  return {
    model_number: null,
    color: null,
    payload: { brand, family, generation },
    ignored_terms: [],
    ambiguity_flags,
  };
}
