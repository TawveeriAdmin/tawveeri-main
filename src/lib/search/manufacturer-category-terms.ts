import { normalizeArabic } from './arabic-normalize';

/** Official titles can omit the shopper's category noun (Galaxy Tab, Buds,
 * Bespoke AI...). Require full manufacturer identity; additional categories also
 * require agreement with the recorded normalization parser, never a legacy tag.
 * Subtypes remain distinct: a standalone dryer is not a washing machine. */
export function manufacturerCategoryTerms(row: {
  category?: string | null; model_number?: string | null; tps_identity_key?: string | null;
  attributes?: unknown; name_en?: string | null;
}): string {
  return normalizeArabic(verifiedCategoryTerms(row));
}

function verifiedCategoryTerms(row: {
  category?: string | null; model_number?: string | null; tps_identity_key?: string | null;
  attributes?: unknown; name_en?: string | null;
}): string {
  const attrs = row.attributes as Record<string, unknown> | null;
  const model = attrs?.manufacturer_model;
  if (typeof model !== 'string' || model !== row.model_number
    || !row.tps_identity_key?.endsWith(`|MODEL:${model}`)) return '';
  if (row.category === 'mobile') return 'phone smartphone mobile جوال هاتف';
  if (attrs?.source !== 'progressive' || typeof attrs.parser_version !== 'string'
    || !attrs.parser_version.startsWith(`${row.category}-v`)) return '';
  switch (row.category) {
    case 'tablet': return 'tablet tab تابلت لوحي';
    case 'smartwatch': return 'watch smartwatch ساعة ساعات';
    case 'refrigerator': return 'refrigerator fridge ثلاجة ثلاجات';
    case 'washing_machine':
      if (attrs.is_dryer_only === true) return 'dryer tumble dryer نشافة مجفف';
      return attrs.is_dryer_only === false ? 'washer washing machine غسالة غسالات' : '';
    case 'audio':
      if (attrs.type === 'earbuds' || attrs.type === 'headphones' || attrs.type === 'headphone'
        || (attrs.type == null && /\bearphones?\b/i.test(row.name_en || ''))) {
        return 'audio earbuds headphones earphones سماعة سماعات اذن';
      }
      if (attrs.type === 'speaker') return 'audio speaker speakers صوتيات مكبر صوت';
      return '';
    default: return '';
  }
}

export function productQueryText(row: {
  name_ar?: string | null; name_en?: string | null; brand?: string | null; _verified_category_terms?: string;
}): string {
  return [normalizeArabic(row.name_ar || ''), row.name_en || '',
    row.brand || '', row._verified_category_terms || ''].join(' ').toLowerCase();
}
