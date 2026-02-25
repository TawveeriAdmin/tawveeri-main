/**
 * Electronics-only filtering for scraped results.
 * The goal is to keep electronics and electronics accessories while dropping
 * clearly unrelated products (food, fashion, books, etc.).
 */

const TECH_CATEGORY_KEYWORDS = [
  'electronics',
  'electronic',
  'computer',
  'computers',
  'mobile',
  'mobiles',
  'smartphone',
  'smartphones',
  'tablet',
  'tablets',
  'laptop',
  'laptops',
  'tv',
  'television',
  'audio',
  'camera',
  'gaming',
  'console',
  'accessories',
  'wearable',
  'network',
  'printer',
  'electronics',
  'الكترونيات',
  'إلكترونيات',
  'جوال',
  'هواتف',
  'هواتف ذكية',
  'لابتوب',
  'كمبيوتر',
  'كمبيوترات',
  'تابلت',
  'سماعات',
  'كاميرات',
  'شاشات',
  'ملحقات',
  'العاب',
  'ألعاب',
] as const;

const NON_TECH_CATEGORY_KEYWORDS = [
  'grocery',
  'food',
  'fresh',
  'fruits',
  'vegetables',
  'produce',
  'bakery',
  'beverage',
  'kitchenware',
  'fashion',
  'clothing',
  'apparel',
  'beauty',
  'toys',
  'books',
  'stationery',
  'sportswear',
  'مواد غذائية',
  'خضار',
  'فواكه',
  'البقالة',
  'الاغذية',
  'الأغذية',
  'ملابس',
  'أزياء',
  'كتب',
  'قرطاسية',
] as const;

const TECH_KEYWORDS = [
  'iphone',
  'ipad',
  'ipod',
  'macbook',
  'imac',
  'airpods',
  'apple watch',
  'galaxy',
  'pixel',
  'xperia',
  'smartphone',
  'mobile',
  'phone',
  '5g',
  'laptop',
  'notebook',
  'chromebook',
  'desktop',
  'pc',
  'monitor',
  'tv',
  'oled',
  'qled',
  'uhd',
  '4k',
  '8k',
  'headphone',
  'headset',
  'earbuds',
  'speaker',
  'soundbar',
  'camera',
  'dslr',
  'mirrorless',
  'lens',
  'gaming',
  'playstation',
  'xbox',
  'nintendo',
  'ps5',
  'ps4',
  'controller',
  'game',
  'games',
  'console',
  'joystick',
  'vr',
  'headset gaming',
  'العاب',
  'ألعاب',
  'لعبة',
  'جيمنج',
  'قيمنق',
  'يد تحكم',
  'keyboard',
  'mouse',
  'router',
  'modem',
  'ssd',
  'hdd',
  'ram',
  'gpu',
  'cpu',
  'printer',
  'projector',
  'smartwatch',
  'wearable',
  'usb-c',
  'magsafe',
  'شاحن',
  'جوال',
  'هاتف',
  'هواتف',
  'ايفون',
  'آيفون',
  'ايباد',
  'آيباد',
  'ماكبوك',
  'لابتوب',
  'كمبيوتر',
  'تابلت',
  'سماعة',
  'سماعات',
  'شاشة',
  'شاشات',
  'كاميرا',
  'بلايستيشن',
  'اكس بوكس',
  'إكس بوكس',
  'نينتندو',
  'ملحقات',
] as const;

const NON_TECH_KEYWORDS = [
  'fresh',
  'organic',
  'fruit',
  'fruits',
  'vegetable',
  'vegetables',
  'produce',
  'grocery',
  'bakery',
  'snack',
  'drink',
  'beverage',
  'book',
  'novel',
  'magazine',
  'shirt',
  'pants',
  'dress',
  'shoes',
  'perfume',
  'makeup',
  'toy car',
  'doll',
  'dolls',
  'plush',
  'stuffed animal',
  'fresh apple',
  'apple royal gala',
  'apple green',
  'apple red',
  'food',
  'crisp',
  'ripe',
  'طازج',
  'عضوي',
  'فواكه',
  'فاكهة',
  'خضار',
  'الخضار',
  'البقالة',
  'كتاب',
  'رواية',
  'ملابس',
  'عطور',
  'مكياج',
  'ألعاب أطفال',
] as const;

const PRODUCE_TERMS = [
  'apple',
  'تفاح',
  'fruit',
  'fruits',
  'produce',
  'fresh',
  'organic',
  'grocery',
  'royal gala',
  'fuji',
  'granny smith',
] as const;

const APPLE_TECH_TERMS = [
  'iphone',
  'ipad',
  'ipod',
  'macbook',
  'imac',
  'airpods',
  'apple watch',
  'magsafe',
  'ios',
] as const;

const TECH_BRANDS = [
  'apple',
  'samsung',
  'huawei',
  'xiaomi',
  'honor',
  'oppo',
  'vivo',
  'realme',
  'nokia',
  'sony',
  'lg',
  'lenovo',
  'dell',
  'hp',
  'asus',
  'acer',
  'msi',
  'microsoft',
  'google',
  'canon',
  'nikon',
  'fujifilm',
  'panasonic',
  'bose',
  'jbl',
  'anker',
  'belkin',
  'logitech',
  'corsair',
  'intel',
  'amd',
  'nvidia',
  'playstation',
  'xbox',
  'nintendo',
] as const;

function normalizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(text: string, terms: readonly string[]): boolean {
  if (!text) return false;
  return terms.some((term) => text.includes(term));
}

function isKnownTechBrand(brandText: string): boolean {
  if (!brandText) return false;
  return TECH_BRANDS.some((brand) => brandText.includes(brand));
}

function looksLikeProduce(titleText: string): boolean {
  if (!titleText) return false;

  const hasProduceTerm = containsAny(titleText, PRODUCE_TERMS);
  if (!hasProduceTerm) return false;

  const hasAppleTechTerm = containsAny(titleText, APPLE_TECH_TERMS);
  if (hasAppleTechTerm) return false;

  const hasWeight = /\b\d+(\.\d+)?\s*(kg|كيلو|كيلوجرام|g|gram|جرام|غم|lb|pound)\b/i.test(titleText);
  return hasWeight || hasProduceTerm;
}

/**
 * Check if a product is electronics-related.
 */
export function isTechProduct(
  title: string,
  brand: string | null,
  category: string,
  additionalData?: {
    description?: string;
    url?: string;
    product_url?: string;
    [key: string]: unknown;
  }
): boolean {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) return false;

  const normalizedBrand = normalizeText(brand || '');
  const normalizedCategory = normalizeText(category);
  const normalizedDescription = normalizeText(additionalData?.description || '');
  const normalizedUrl = normalizeText(additionalData?.url || additionalData?.product_url || '');
  const combinedText = `${normalizedTitle} ${normalizedDescription} ${normalizedUrl}`.trim();

  const hasTechBrand = isKnownTechBrand(normalizedBrand);
  const hasTechTitleKeyword = containsAny(normalizedTitle, TECH_KEYWORDS);
  const hasTechContextKeyword = containsAny(combinedText, TECH_KEYWORDS);
  const hasTechCategory = containsAny(normalizedCategory, TECH_CATEGORY_KEYWORDS);

  const hasNonTechCategory = containsAny(normalizedCategory, NON_TECH_CATEGORY_KEYWORDS);
  const hasNonTechText = containsAny(combinedText, NON_TECH_KEYWORDS);
  const isProduceLike = looksLikeProduce(normalizedTitle);

  const techSignals = Number(hasTechBrand) + Number(hasTechTitleKeyword) + Number(hasTechCategory);
  const nonTechSignals = Number(hasNonTechCategory) + Number(hasNonTechText) + Number(isProduceLike);

  if (hasTechBrand && !hasNonTechCategory && !isProduceLike) return true;
  if (hasNonTechCategory && !hasTechTitleKeyword && !hasTechBrand) return false;
  if (isProduceLike && !hasTechTitleKeyword && !hasTechBrand) return false;

  if (techSignals >= 2) return true;
  if (nonTechSignals >= 2 && techSignals === 0) return false;
  if (hasTechContextKeyword && !hasNonTechCategory) return true;
  if (hasNonTechText && !hasTechTitleKeyword && !hasTechBrand) return false;

  // Keep borderline products to avoid hiding electronics accessories.
  return techSignals >= nonTechSignals;
}

type FilterableProduct = {
  name_en?: string;
  name_ar?: string;
  title?: string;
  brand?: string | null;
  category?: string;
  description_ar?: string | null;
  description_en?: string | null;
  description?: string | null;
  product_url?: string;
  url?: string;
  [key: string]: unknown;
};

/**
 * Keep only electronics-related products.
 */
export function filterTechProducts<T extends FilterableProduct>(products: T[]): T[] {
  return products.filter((product) => {
    const title = (product.name_en || product.name_ar || product.title || '').trim();
    if (!title) return false;

    const description =
      product.description_en ||
      product.description_ar ||
      (typeof product.description === 'string' ? product.description : '') ||
      '';
    const url = product.product_url || product.url || '';

    return isTechProduct(
      title,
      product.brand || null,
      product.category || '',
      { description, url, product_url: url }
    );
  });
}
