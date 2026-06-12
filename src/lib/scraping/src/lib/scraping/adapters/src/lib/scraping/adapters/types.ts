/**
 * بروتوكول المتاجر الموحّد — Tawveeri Store Adapter Protocol v1
 * كل متجر = محوّل يطبّق StoreAdapter. إضافة متجر جديد = ملف واحد + سطر في السجل.
 */

/** عرض موحّد قادم من أي متجر — صيغة توفيري القياسية */
export interface NormalizedOffer {
  name_ar: string;
  name_en: string;
  brand: string;
  category: string;
  current_price: number;
  original_price: number | null;
  product_url: string;
  image_url?: string | null;
  availability: 'in_stock' | 'out_of_stock';
  barcode: string | null;
  /** معرّف المنتج عند المتجر (sku / uniqueId) */
  external_id: string;
  /** الحمولة الخام — تُحفظ في raw_observations.payload */
  _raw: unknown;
  /** مصدر الجلب: 'algolia' | 'unbxd_extra' | ... */
  _source: string;
}

export interface FetchResult {
  offers: NormalizedOffer[];
  /** 0 = اكتمل. يُخزَّن في store_sync_status.next_page — ترميزه شأن داخلي للمحوّل */
  nextState: number;
  done: boolean;
  lastError?: string;
}

/** الواجهة الموحّدة — كل متجر يطبّقها */
export interface StoreAdapter {
  /** سلَج إنجليزي ثابت — متوافق مع SEARCH_STORE_DISPLAY_NAMES في product-adapter.ts */
  slug: string;
  /** الاسم المخزّن في قاعدة البيانات (price_history / product_stores / store_sync_status) */
  dbName: string;
  nameEn: string;
  sourceType: 'search_api' | 'html' | 'feed';
  enabled: boolean;
  /** جلب دفعة واحدة قابلة للاستئناف */
  fetchBatch(startState: number, maxItems: number): Promise<FetchResult>;
}

// ── أدوات مشتركة بين المحوّلات ──────────────────────────────

export function firstStr(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) { for (const v of val) { const s = firstStr(v); if (s) return s; } return ''; }
  if (typeof val === 'object') { for (const v of Object.values(val as Record<string, unknown>)) { const s = firstStr(v); if (s) return s; } }
  return '';
}

export function toNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(n) ? null : n;
}

/** Unbxd وأمثاله يرجّعون الحقول كمصفوفات أحياناً */
export const pick = (v: unknown): string => Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
export const pickNum = (v: unknown): number | null => toNum(Array.isArray(v) ? v[0] : v);
