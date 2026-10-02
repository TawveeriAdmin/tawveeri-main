// src/lib/compare/brand-display.ts — ADR-388.
// Customer-facing brand names for the compare surfaces. The knowledge layer stores the
// canonical lowercase brand token (`lg`, `samsung`); a shopper reading an Arabic page
// should see «إل جي» / «سامسونج», not a lowercase Latin token, and a shopper reading the
// English page should see the manufacturer's own casing (LG, TCL). A brand not in this
// curated list is shown as stored (capitalised), never transliterated by guesswork.

const BRANDS: Record<string, [string, string]> = {
  lg: ['إل جي', 'LG'],
  samsung: ['سامسونج', 'Samsung'],
  apple: ['آبل', 'Apple'],
  huawei: ['هواوي', 'Huawei'],
  xiaomi: ['شاومي', 'Xiaomi'],
  honor: ['هونر', 'Honor'],
  sony: ['سوني', 'Sony'],
  tcl: ['تي سي إل', 'TCL'],
  hisense: ['هايسنس', 'Hisense'],
  gree: ['جري', 'Gree'],
  midea: ['ميديا', 'Midea'],
  haier: ['هاير', 'Haier'],
  panasonic: ['باناسونيك', 'Panasonic'],
  daikin: ['دايكن', 'Daikin'],
  carrier: ['كاريير', 'Carrier'],
  mitsubishi: ['ميتسوبيشي', 'Mitsubishi'],
  toshiba: ['توشيبا', 'Toshiba'],
  sharp: ['شارب', 'Sharp'],
  hitachi: ['هيتاشي', 'Hitachi'],
  bosch: ['بوش', 'Bosch'],
  whirlpool: ['ويرلبول', 'Whirlpool'],
  beko: ['بيكو', 'Beko'],
  dell: ['ديل', 'Dell'],
  hp: ['إتش بي', 'HP'],
  lenovo: ['لينوفو', 'Lenovo'],
  asus: ['أسوس', 'ASUS'],
  acer: ['أيسر', 'Acer'],
  microsoft: ['مايكروسوفت', 'Microsoft'],
  jbl: ['جي بي إل', 'JBL'],
  anker: ['أنكر', 'Anker'],
  aux: ['أوكس', 'AUX'],
  general: ['جنرال', 'General'],
  zamil: ['الزامل', 'Zamil'],
  westinghouse: ['ويستنجهاوس', 'Westinghouse'],
  fisher: ['فيشر', 'Fisher'],
  nikai: ['نيكاي', 'Nikai'],
  oppo: ['أوبو', 'OPPO'],
  realme: ['ريلمي', 'realme'],
  vivo: ['فيفو', 'vivo'],
  tecno: ['تكنو', 'Tecno'],
  infinix: ['إنفينكس', 'Infinix'],
  nokia: ['نوكيا', 'Nokia'],
  google: ['جوجل', 'Google'],
  oneplus: ['ون بلس', 'OnePlus'],
  canon: ['كانون', 'Canon'],
  nikon: ['نيكون', 'Nikon'],
  philips: ['فيليبس', 'Philips'],
  kenwood: ['كينوود', 'Kenwood'],
  tefal: ['تيفال', 'Tefal'],
  dyson: ['دايسون', 'Dyson'],
  garmin: ['جارمن', 'Garmin'],
  amazfit: ['أمازفيت', 'Amazfit'],
};

const ARABIC = /[؀-ۿ]/;

/**
 * ADR-400 — the input is whatever a product row carries, not always a string. Live-reproduced
 * 2026-10-02 (reviewer evidence #9): a search submitted from the HEADER bar on /search rendered
 * the page-level «حدث خطأ. يرجى المحاولة مرة أخرى» with `TypeError: e.trim is not a function`
 * raised here from product-card.tsx — one result's `brand` was not a string. A display helper
 * must never take a page down; a non-string brand is coerced (array → first entry, object → its
 * name fields) or shown as nothing.
 */
function coerceBrand(brand: unknown): string {
  if (typeof brand === 'string') return brand;
  if (brand == null || typeof brand === 'boolean') return '';
  if (typeof brand === 'number') return String(brand);
  if (Array.isArray(brand)) return coerceBrand(brand[0]);
  if (typeof brand === 'object') {
    const o = brand as Record<string, unknown>;
    return coerceBrand(o.name_ar ?? o.name_en ?? o.name ?? o.value ?? '');
  }
  return '';
}

/** Display name for a stored brand token. Already-Arabic input is returned as-is. */
export function brandDisplayName(brand: unknown, locale: 'ar' | 'en'): string {
  const raw = coerceBrand(brand).trim();
  if (!raw) return '';
  if (ARABIC.test(raw)) return raw;
  const pair = BRANDS[raw.toLowerCase()];
  if (pair) return pair[locale === 'ar' ? 0 : 1];
  // Unknown to the list: never invent an Arabic form — capitalise the stored token.
  return raw.length <= 3 ? raw.toUpperCase() : raw.charAt(0).toUpperCase() + raw.slice(1);
}
