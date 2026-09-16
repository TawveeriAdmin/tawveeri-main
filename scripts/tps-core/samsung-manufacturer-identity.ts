export { samsungCatalogExclusion } from '../../src/lib/scraping/stores/samsung-catalog';

/** Exact manufacturer identities for the manufacturer's own Saudi consumer feed.
 * No suffix removal, fuzzy matching, or merchant ranking rules. Other merchants
 * continue through their existing evidence contracts.
 */
export function samsungManufacturerIdentity(storeId: number | null, payload: Record<string, unknown>): {
  category: string; model: string; key: string;
} | null {
  if (storeId !== 6 || String(payload.brand).toLowerCase() !== 'samsung') return null;
  const model = typeof payload.sku === 'string' ? payload.sku.trim().toUpperCase() : '';
  // Genuine manufacturer SKUs include MX-T70/ZN and all-letter filter/stacking
  // kit codes (HAF-QIN/EXP, SKK-ALE/SC). Identity is corroborated by the official
  // variant URL below, not by assuming every model contains a digit.
  if (model.length < 8 || model.length > 40 || !/^[A-Z][A-Z0-9-]*(?:\/[A-Z0-9]{2,4})?$/.test(model)
    || !/[-/\d]/.test(model) || model.startsWith('F-')) return null;
  let url: URL;
  try { url = new URL(String(payload.product_url)); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.samsung.com' || !/^\/(sa|sa_en)\//.test(url.pathname)) return null;
  // A variant PDP or the verified buying-tool selector must name the exact SKU.
  const skuInPath = url.pathname.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(model.replace(/[^A-Z0-9]/g, ''));
  const skuInBuyingTool = /\/buy\/$/.test(url.pathname) && url.searchParams.get('modelCode')?.toUpperCase() === model;
  if (!skuInPath && !skuInBuyingTool) return null;
  const path = url.pathname.toLowerCase();
  let category: string | null = null;
  if (/\/(mobile-accessories|tv-accessories|home-appliance-accessories|display-accessories|projector-accessories)\//.test(path)) {
    category = /smarttag/.test(path) ? 'tracker' : /s-pen/.test(path) ? 'stylus' : 'accessories';
  } else {
    const categories: Record<string, string> = {
      smartphones: 'mobile', tablets: 'tablet', watches: 'smartwatch', rings: 'ring',
      'audio-sound': 'audio', 'audio-devices': 'audio', tvs: 'tv', 'lifestyle-tvs': 'tv',
      monitors: 'monitor', refrigerators: 'refrigerator', 'washers-and-dryers': 'washing_machine',
      dishwashers: 'dishwasher', 'microwave-ovens': 'microwave', 'air-conditioners': 'air_conditioner',
      'vacuum-cleaners': 'vacuum', 'cooking-appliances': 'cooker', projectors: 'projector',
      'movable-screens': 'tv',
    };
    category = categories[path.split('/')[2]] || null;
  }
  const specs = payload.specifications as { samsung_catalog?: { type?: string } } | undefined;
  if (/\/cooking-appliances\/hoods\//.test(path)) category = 'hood';
  if (specs?.samsung_catalog?.type === '04060000') category = 'accessories';
  return category ? { category, model, key: `samsung|MODEL:${model}` } : null;
}

export type SamsungVerifiedModel = NonNullable<ReturnType<typeof samsungManufacturerIdentity>>;

/** A retailer-declared complete MPN may use the same manufacturer identity only
 * when that exact code has independently verified Saudi manufacturer evidence.
 * No image filenames, title fragments, region stripping, or fuzzy model guesses.
 */
export function samsungDeclaredModelIdentity(brand: string | null, payload: Record<string, unknown>, verified: Map<string, SamsungVerifiedModel>): SamsungVerifiedModel | null {
  if (brand?.toLowerCase() !== 'samsung') return null;
  const candidates = [payload.model, payload.modelNumber, payload.model_number, payload.mpn, payload.sku]
    .filter((value): value is string => typeof value === 'string')
    .map(value => verified.get(value.trim().toUpperCase())).filter((value): value is SamsungVerifiedModel => !!value);
  const unique = new Map(candidates.map(value => [value.key, value]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}
