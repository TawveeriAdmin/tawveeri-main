/** Public Saudi product-finder endpoints exposed by Samsung's own category pages.
 * A family contains multiple commercial SKUs. Neither family IDs nor URL aliases
 * are product identities. Preserve the full manufacturer model code.
 */
import type { ScrapedProduct } from '../base/types';
import type { ProductCategory } from '@/lib/database/types';

export const SAMSUNG_CATALOG_TYPES = [
  '01010000', '01020000', '01030000', '01040000', '01090000', '01050000',
  '04010000', '05010000', '04030000', '08030000', '08090000', '08110000',
  '08010000', '08050000', '08070000', '08120000', '07010000', '04060000',
  '04050000', '08080000',
] as const;

export function samsungCatalogExclusion(model: string): string | null {
  if (/^F-FA01COMBO\d+$/i.test(model)) return 'MULTI_PRODUCT_BUNDLE';
  if (/^(DA97|DC97)-/i.test(model)) return 'REPLACEMENT_ASSEMBLY_PART';
  if (model.toUpperCase() === 'F-FA00009LA0') return 'DECORATIVE_COLLABORATION_CASE';
  return null;
}

export interface SamsungCatalogModel {
  modelCode: string;
  modelName?: string;
  displayName: string;
  pdpUrl: string;
  originPdpUrl?: string;
  configuratorUrl?: string | null;
  price?: string | null;
  promotionPrice?: string | null;
  priceCurrency?: string | null;
  stockStatusText?: string | null;
  ctaEngText?: string | null;
  ctaType?: string | null;
  thumbUrl?: string;
  fmyChipList?: Array<{ fmyChipType: string; fmyChipName: string }>;
  keySummary?: Array<{ key?: string; value?: string }>;
}

export interface SamsungCatalogObservation {
  site: 'sa' | 'sa_en';
  type: string;
  subcategory: string;
  familyId: string;
  observedAt: string;
  sourceUrl: string;
  model: SamsungCatalogModel;
}

export const SAMSUNG_TYPE_CATEGORIES: Record<string, ProductCategory> = {
  '01010000': 'smartphone', '01020000': 'tablet', '01030000': 'wearable',
  '01040000': 'audio', '01090000': 'wearable', '01050000': 'accessories',
  '04010000': 'tv', '05010000': 'audio', '04030000': 'accessories',
  '08030000': 'appliance', '08090000': 'appliance', '08110000': 'appliance',
  '08010000': 'appliance', '08050000': 'appliance', '08070000': 'vacuum',
  '08120000': 'accessories', '07010000': 'monitor', '04060000': 'accessories',
  '04050000': 'projector', '08080000': 'appliance',
};

/** Finder price is the list price when promotionPrice exists. Neither instalment
 * amounts nor trade-in/coupon text participates in universal purchase pricing.
 * Stock and buy CTA must both affirm direct purchase; absence is not availability.
 */
export function samsungCatalogProduct(item: SamsungCatalogObservation): ScrapedProduct {
  const model = item.model;
  const amount = (raw: unknown, allowZero = false) => {
    const value = typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
    return value !== null && (value > 0 || (allowZero && value === 0)) ? value : null;
  };
  const list = amount(model.price), promotion = amount(model.promotionPrice, true);
  const current = model.priceCurrency === 'SAR' ? (promotion ?? list) : null;
  const original = current !== null && list !== null && list > current ? list : null;
  // Saudi's global finder labels its commerce CTA `whereToBuy` even for direct
  // purchase (verified against Tab/washer PDP saleable flags). ctaEngText is
  // optional; requiring it incorrectly hides purchasable products.
  const buy = model.ctaType === 'whereToBuy'
    && (!model.ctaEngText || /^(buy|buy now|add to cart)$/i.test(model.ctaEngText.trim()));
  const stock = model.stockStatusText;
  const availability: ScrapedProduct['availability'] = current !== null && buy && stock === 'inStock'
    ? 'in_stock' : current !== null && buy && stock === 'lowStock' ? 'limited_stock' : 'out_of_stock';
  const variants = (model.fmyChipList || []).map(chip => chip.fmyChipName).filter(Boolean).join(' ');
  const name = `${model.displayName} ${variants} (${model.modelCode})`.replace(/\s+/g, ' ').trim();
  const origin = samsungSaudiUrl(model.originPdpUrl || model.pdpUrl);
  let url = origin;
  // Marketing redirects discard the SKU path. Samsung's buying tool honors
  // modelCode server-side (verified for two distinct Fold variants).
  if (model.originPdpUrl !== model.pdpUrl && model.configuratorUrl) {
    const buying = samsungSaudiUrl(model.configuratorUrl);
    if (buying && /\/buy\/$/.test(new URL(buying).pathname)) {
      const selected = new URL(buying);
      selected.searchParams.set('modelCode', model.modelCode);
      url = selected.href;
    }
  }
  if (!url || !model.modelCode || !model.displayName) throw new Error('Samsung finder identity incomplete');
  return {
    name_ar: name, name_en: name, brand: 'Samsung', model: model.modelCode, sku: model.modelCode,
    current_price: current, original_price: original, availability, product_url: url,
    image_urls: model.thumbUrl ? [new URL(model.thumbUrl, 'https://www.samsung.com').href] : [],
    category: SAMSUNG_TYPE_CATEGORIES[item.type], description_ar: null, description_en: null,
    specifications: { raw: Object.fromEntries((model.keySummary || []).filter(s => s.key && s.value).map(s => [s.key!, s.value!])),
      samsung_catalog: { type: item.type, subcategory: item.subcategory, model_code: model.modelCode,
        variant: model.fmyChipList || [], stock_status: stock ?? null, purchase_cta: model.ctaEngText ?? null,
        origin_url: origin, source_url: item.sourceUrl, observed_at: item.observedAt, source_method: 'samsung_public_finder' } },
  };
}

export function samsungSaudiUrl(path: string): string | null {
  try {
    const url = new URL(path, 'https://www.samsung.com');
    if (url.protocol !== 'https:' || url.hostname !== 'www.samsung.com' || !/^\/(sa|sa_en)\//.test(url.pathname)) return null;
    url.search = ''; url.hash = '';
    return url.href;
  } catch { return null; }
}

export async function fetchSamsungCatalog(
  types: readonly string[] = SAMSUNG_CATALOG_TYPES,
  sites: readonly ('sa' | 'sa_en')[] = ['sa_en', 'sa'],
): Promise<SamsungCatalogObservation[]> {
  const observations: SamsungCatalogObservation[] = [];
  for (const site of sites) for (const type of types) {
    const seen = new Set<string>();
    let complete = false;
    for (let start = 1; start < 10000;) {
      const query = new URLSearchParams({ type, siteCode: site, start: String(start), num: '12',
        sort: 'newest', onlyFilterInfoYN: 'N', keySummaryYN: 'Y' });
      const sourceUrl = `https://searchapi.samsung.com/v6/front/b2c/product/finder/global?${query}`;
      const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Samsung finder HTTP ${response.status}: ${site}/${type}`);
      const json = await response.json();
      const data = json.response?.resultData;
      if (!data?.common || !Array.isArray(data.productList)) throw new Error('Invalid Samsung finder schema');
      const total = Number(data.common.totalRecord), end = Number(data.common.toRecord);
      for (const family of data.productList) {
        if (seen.has(family.familyId)) throw new Error('Samsung finder repeated a family during pagination');
        seen.add(family.familyId);
        if (!Array.isArray(family.modelList) || Number(family.modelCount) !== family.modelList.length) {
          throw new Error(`Samsung finder incomplete variants: ${family.familyId}`);
        }
        for (const model of family.modelList as SamsungCatalogModel[]) {
          if (!model.modelCode || !samsungSaudiUrl(model.originPdpUrl || model.pdpUrl)) throw new Error('Samsung finder missing model or Saudi PDP');
          observations.push({ site, type, subcategory: family.categorySubTypeEngName,
            familyId: family.familyId, observedAt: new Date().toISOString(), sourceUrl, model });
        }
      }
      if (Number.isFinite(total) && end >= total) { complete = true; break; }
      if (!Number.isFinite(end) || end < start || !data.productList.length) throw new Error('Samsung finder pagination stalled');
      start = end + 1;
    }
    if (!complete) throw new Error('Samsung finder pagination limit exceeded');
  }
  return observations;
}
