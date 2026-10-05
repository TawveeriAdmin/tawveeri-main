// src/lib/identity/source-field-trust-matrix.ts — measured trust of every (merchant, field) that can carry a manufacturer model.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// STATUS: DATA ONLY, SHADOW. Generated from docs/evidence/amazon-diagnostic-2026-10-03/phase3b/source-field-trust-2026-10-04.json
// (scripts/tps-analysis/source-field-trust.ts, current offers, production read-only; merchant labels come from approved-retailers STORE_ID_TO_SLUG — an earlier hand-written store map had swapped blackbox/alnakheelk/lulu). Re-measure with that script (and page-field-trust.ts for `page.*` rows) and
// replace the rows; never edit a number by hand and never promote a row because a merchant is "reputable".
//
// Trust belongs to the PAIR (merchant, field), measured by labels independent of any extractor:
//   trap_pct       share of declared values that are sizes / refresh rates / panel words / retailer SKUs / the whole title / a fragment
//   confirmed_pct  share of confirmable values a DIFFERENT merchant independently states in the same canonical group
//   HIGH   n>=20, traps<2% and (confirmed>=20% or own-title>=80%)      LOW  traps>=20%      else MEDIUM      n<20 → UNMEASURED
// UNMEASURED is NOT trusted: unknown beats incorrect. Merchant neutrality: a row says how reliable a FIELD is, never how good the merchant is.

export type TrustLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMEASURED';

export interface SourceFieldTrust {
  merchant: string;
  /** `top.<payloadKey>` for a top-level payload field, `spec.<cleaned spec key>` for a key inside `specifications`. */
  field: string;
  declared: number;
  trap_pct: number | null;
  own_title_pct: number | null;
  confirmed_pct: number | null;
  confirmable: number;
  trust: TrustLevel;
  /** Known failure classes — documented, not inferred. */
  failure_classes: string[];
}

export const SOURCE_TRUST_MEASURED_AT = '2026-10-04';

const row = (
  merchant: string, field: string, declared: number, trap_pct: number | null, own_title_pct: number | null,
  confirmed_pct: number | null, confirmable: number, trust: TrustLevel, failure_classes: string[] = [],
): SourceFieldTrust => ({ merchant, field, declared, trap_pct, own_title_pct, confirmed_pct, confirmable, trust, failure_classes });

export const SOURCE_FIELD_TRUST: readonly SourceFieldTrust[] = [
  row('almanea', 'top.model', 1598, 0.8, 65, 69.6, 582, 'HIGH'),
  row('amazon', 'top.model', 1328, 44.9, 29.7, 43.7, 119, 'LOW', ['asin', 'title_truncation', 'spec_word']),
  row('amazon', 'spec.model name', 220, 8.6, 21.4, 23.4, 124, 'MEDIUM', ['marketing_name']),
  row('amazon', 'spec.item model number', 72, 33.3, 29.2, 38.1, 42, 'LOW', ['asin', 'seller_sku']),
  row('amazon', 'spec.model number', 3, 0, 66.7, 0, 1, 'UNMEASURED'),
  row('extra', 'top.modelNumber', 1637, 0.8, 0, 80.7, 720, 'HIGH'),
  row('extra', 'top.model', 454, 11.7, 0, 9.4, 138, 'MEDIUM', ['title_fragment']),
  row('jarir', 'top.model', 259, 63.7, 1.2, 0, 23, 'LOW', ['title_fragment', 'spec_word']),
  row('lulu', 'top.model', 85, 100, 0, null, 0, 'LOW', ['whole_title_or_non_model']),
  row('noon', 'top.model', 1109, 10.9, 0, 4, 325, 'MEDIUM', ['retailer_code', 'title_fragment']),
  row('noon', 'spec.model_number', 365, 4.1, 46, 30.9, 181, 'MEDIUM'),
  row('noon', 'spec.model_name', 299, 7, 38.8, 35.2, 142, 'MEDIUM', ['marketing_name']),
  row('samsung_ksa', 'top.model', 1313, 0, 90.9, 96.4, 473, 'HIGH'),
  row('shaker', 'top.model', 3, 100, 0, null, 0, 'UNMEASURED'),
  // PAGE fields — measured over page captures (scripts/tps-analysis/page-field-trust.ts, 2026-10-04, 1,700 pages; n<20 = UNMEASURED; LOW also when never corroborated by another merchant).
  row('almanea', 'page.jsonld.mpn', 84, 0, 84.5, 96.3, 80, 'HIGH'),
  row('almanea', 'page.jsonld.sku', 84, 100, 0, null, 0, 'LOW', ['merchant_sku']),
  row('almanea', 'page.jsonld.gtin', 83, 3.6, 0, 0, 77, 'LOW', ['never_corroborated']),
  row('alnakheelk', 'page.jsonld.sku', 215, 29.3, 0, 0, 42, 'LOW', ['merchant_sku']),
  row('extra', 'page.jsonld.sku', 174, 95.4, 0, 0, 8, 'LOW', ['merchant_sku']),
  row('extra', 'page.jsonld.mpn', 166, 0, 0, 81.9, 138, 'HIGH'),
  row('extra', 'page.script.modelNumber', 166, 0, 0, 81.9, 138, 'HIGH'),
  row('jarir', 'page.jsonld.mpn', 258, 4.3, 6.2, 11.1, 90, 'MEDIUM'),
  row('jarir', 'page.jsonld.sku', 258, 100, 0, null, 0, 'LOW', ['merchant_sku']),
  row('jarir', 'page.jsonld.model', 258, 16.7, 10.9, 5.9, 85, 'MEDIUM'),
  row('jarir', 'page.table.manufacturer_number', 247, 4.5, 6.5, 11.1, 90, 'MEDIUM'),
  row('jarir', 'page.label.manufacturer_no', 246, 4.5, 6.1, 11.1, 90, 'MEDIUM'),
  row('jarir', 'page.jsonld.gtin', 168, 0, 0, 0, 57, 'LOW', ['never_corroborated']),
  row('najm', 'page.jsonld.sku', 180, 7.2, 0, 0, 39, 'LOW', ['merchant_sku']),
  row('samsung_ksa', 'page.jsonld.sku', 75, 0, 98.7, 100, 74, 'HIGH'),
  row('shaker', 'page.jsonld.sku', 270, 0, 70.7, 74.9, 167, 'HIGH'),
];

const INDEX = new Map(SOURCE_FIELD_TRUST.map((r) => [`${r.merchant}|${r.field}`, r]));

/** Measured trust for a (merchant, field); UNMEASURED when the pair has no row (never defaulted upward). */
export function sourceFieldTrust(merchant: string, field: string): { trust: TrustLevel; row: SourceFieldTrust | null } {
  const r = INDEX.get(`${merchant}|${field}`) ?? null;
  return { trust: r?.trust ?? 'UNMEASURED', row: r };
}
