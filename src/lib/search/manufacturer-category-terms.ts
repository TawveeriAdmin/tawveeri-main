import { normalizeArabic } from './arabic-normalize';

/** Manufacturer phones can be titled only "Galaxy A...", without the noun
 * "phone". Accept that noun only from corroborated manufacturer model metadata,
 * never from a weak legacy category tag or a brand/family title alone. */
export function manufacturerCategoryTerms(row: {
  category?: string | null; model_number?: string | null; tps_identity_key?: string | null;
  attributes?: unknown;
}): string {
  const model = (row.attributes as { manufacturer_model?: unknown } | null)?.manufacturer_model;
  return row.category === 'mobile' && typeof model === 'string' && model === row.model_number
    && row.tps_identity_key?.endsWith(`|MODEL:${model}`)
    ? 'phone smartphone mobile جوال هاتف' : '';
}

export function productQueryText(row: {
  name_ar?: string | null; name_en?: string | null; brand?: string | null; _verified_category_terms?: string;
}): string {
  return [normalizeArabic(row.name_ar || ''), row.name_en || '',
    row.brand || '', row._verified_category_terms || ''].join(' ').toLowerCase();
}
