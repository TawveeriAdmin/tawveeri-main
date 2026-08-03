// scripts/tps-core/store-identity-guard.ts
// ADR-191 — A STORE NAME IS NOT A BRAND.
//
// Measured on production 2026-08-03: **22 active canonicals keyed `sony world - ksa|…`** —
// Sony WH-1000XM6, WF-1000XM6, WF-C510, INZONE H3/H9, WH-G500 — carrying the RETAILER as their
// manufacturer, because that merchant's feed puts its own shop name in the brand field.
//
// Two harms, and the second is the one that matters:
//   · the customer reads «sony world - ksa Wh-1000xm6» as a product name;
//   · `brand` is the FIRST SEGMENT of `tps_identity_key`, so the identical headphone sold by
//     another retailer can never corroborate with it — the listing is fenced inside a brand
//     namespace only that merchant occupies. A store identifier reaching an identity key breaks
//     the Constitution's *one canonical identity · one canonical store identity*.
//
// MEASURED CEILING, stated because it decides how much this deserves: of the seven affected
// models, only **two** (WH-1000XM6, INZONE H3) have a `sony`-branded twin at all, so correcting
// the existing rows is worth **at most 2 comparisons**. The 22 rows are therefore NOT re-keyed
// here — that needs ADR-184's merge machinery for a two-comparison prize. **This guard is about
// recurrence:** the next feed that does this is caught on arrival, for free.
//
// EXACT MATCH ONLY, never substring. "Samsung" must survive as a brand even though a store is
// called "Samsung KSA", and "Sony" must survive even though a store is called "Sony World".
// A guard that eats real brands would be far worse than the defect it prevents.

import { TPS_STORES } from "./category-registry";
import { APPROVED_RETAILERS } from "../../src/lib/retailers/approved-retailers";

const normalize = (s: string): string =>
  s.toLowerCase()
    .replace(/[ً-ْ]/g, "")     // Arabic diacritics
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")     // punctuation/dashes → space ("sony world - ksa")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Every name a store is known by, normalized — DERIVED from the registries, not hand-typed.
 *
 * The first version of this used a hand-written list and immediately missed «مكتبة جرير»,
 * because `TPS_STORES` calls that store «جرير». A hand-list of store names will always be one
 * merchant behind; the registries are the things that get updated when a merchant is onboarded,
 * so the guard reads those and inherits every future addition for free.
 *
 * Sources: `TPS_STORES` (ingest-side, where the offending merchant is defined) and
 * `APPROVED_RETAILERS` (slug · name_en · name_ar). Plus the English transliterations of stores
 * that exist only in `TPS_STORES` under an Arabic name — those cannot be derived, so they are
 * listed, and each one is a value observed in a real feed rather than a guess.
 */
const STORE_NAMES: ReadonlySet<string> = (() => {
  const out = new Set<string>();
  const add = (v: string | null | undefined) => {
    const n = normalize(v ?? "");
    // 3 characters is the floor at which a token can identify a store rather than collide with
    // a brand — it also keeps a bare "SA"/"KSA" out of the set.
    if (n.length >= 3) out.add(n);
  };
  for (const s of TPS_STORES) add(s.name);
  for (const r of APPROVED_RETAILERS) { add(r.slug); add(r.name_en); add(r.name_ar); }
  for (const n of ["sony world", "sonyworld", "amn kum", "golden store", "pc palace", "easy world"]) add(n);
  return out;
})();

const COUNTRY_SUFFIX = /\s+(ksa|sa|saudi|saudi arabia|السعوديه|السعودية)$/;

/**
 * True when a value is a STORE's identity rather than a manufacturer's.
 *
 * Exact match against the known store names, after normalization and after stripping a trailing
 * country suffix. Returns false for anything it does not positively recognise — an unknown value
 * is far more likely to be a real brand than a store, and unknown must not become rejected.
 */
export function isStoreIdentity(value: string | null | undefined): boolean {
  const n = normalize(value ?? "");
  if (n.length < 3) return false;
  if (STORE_NAMES.has(n)) return true;
  const stripped = n.replace(COUNTRY_SUFFIX, "").trim();
  return stripped.length >= 3 && STORE_NAMES.has(stripped);
}

/** The brand, or `null` when the "brand" is really the seller. Unknown beats incorrect. */
export function brandOrNull(value: string | null | undefined): string | null {
  const b = (value ?? "").trim();
  if (!b) return null;
  return isStoreIdentity(b) ? null : b;
}
