import type { ProductCategory } from '@/lib/database/types';

const CATEGORY_KEYWORDS: Record<ProductCategory, string[]> = {
  smartphone: [
    'smartphone',
    'mobile phone',
    'cell phone',
    'iphone',
    'galaxy s',
    'galaxy z',
    'pixel',
    'redmi',
    'هاتف',
    'جوال',
    'هواتف',
    'هواتف ذكية',
    'موبايل',
    'ايفون',
    'آيفون',
  ],
  laptop: [
    'laptop',
    'notebook',
    'ultrabook',
    'macbook',
    'chromebook',
    'لابتوب',
    'حاسوب محمول',
    'كمبيوتر محمول',
  ],
  tablet: [
    'tablet',
    'ipad',
    'galaxy tab',
    'تابلت',
    'آيباد',
    'ايباد',
  ],
  tv: [
    'tv',
    'smart tv',
    'television',
    'oled',
    'qled',
    '4k tv',
    '8k tv',
    'تلفزيون',
    'شاشة',
    'شاشات',
  ],
  audio: [
    'headphone',
    'headset',
    'earbuds',
    'earphone',
    'airpods',
    'speaker',
    'soundbar',
    'سماعة',
    'سماعات',
    'مكبر صوت',
  ],
  camera: [
    'camera',
    'dslr',
    'mirrorless',
    'action cam',
    'كاميرا',
  ],
  gaming: [
    'gaming',
    'playstation',
    'ps5',
    'ps4',
    'xbox',
    'nintendo',
    'steam deck',
    'قيمنج',
    'ألعاب',
    'العاب',
    'بلايستيشن',
    'إكس بوكس',
    'اكس بوكس',
  ],
  accessories: [
    'accessory',
    'accessories',
    'case',
    'cover',
    'screen protector',
    'charger',
    'cable',
    'adapter',
    'ملحقات',
    'إكسسوارات',
    'جراب',
    'كفر',
    'شاحن',
    'كيبل',
  ],
  monitor: [
    'monitor',
    'display',
    'curved display',
    'ultrawide',
    'شاشة كمبيوتر',
    'شاشة حاسوب',
    'مونيتور',
  ],
  printer: [
    'printer',
    'inkjet',
    'laserjet',
    'laser printer',
    'all-in-one printer',
    'toner',
    'ink cartridge',
    'طابعة',
    'طابعات',
    'حبر طابعة',
  ],
  networking: [
    'router',
    'mesh',
    'wi-fi 6',
    'wifi extender',
    'access point',
    'network switch',
    'raspberry pi',
    'راوتر',
    'شبكة',
    'واي فاي',
  ],
  smart_home: [
    'smart home',
    'smart bulb',
    'smart plug',
    'smart lock',
    'smart doorbell',
    'alexa',
    'echo',
    'google home',
    'nest',
    'philips hue',
    'البيت الذكي',
    'جرس ذكي',
    'مصباح ذكي',
  ],
  wearable: [
    'smartwatch',
    'smart watch',
    'fitness tracker',
    'fitness band',
    'apple watch',
    'galaxy watch',
    'garmin',
    'fitbit',
    'ساعة ذكية',
    'ساعات ذكية',
    'سوار رياضي',
  ],
  appliance: [
    'refrigerator',
    'fridge',
    'washing machine',
    'washer',
    'dryer',
    'dishwasher',
    'freezer',
    'oven',
    'microwave',
    'air conditioner',
    'ac unit',
    'split ac',
    'water heater',
    'vacuum cleaner',
    'ثلاجة',
    'غسالة',
    'نشافة',
    'غسالة صحون',
    'فرن',
    'ميكروويف',
    'مكيف',
    'سخان',
    'مكنسة',
  ],
  kitchen: [
    'blender',
    'mixer',
    'coffee maker',
    'coffee machine',
    'espresso',
    'kettle',
    'toaster',
    'air fryer',
    'food processor',
    'juicer',
    'rice cooker',
    'slow cooker',
    'pressure cooker',
    'خلاط',
    'خفاقة',
    'صانعة قهوة',
    'ماكينة قهوة',
    'غلاية',
    'محمصة',
    'قلاية هوائية',
  ],
  personal_care: [
    'hair dryer',
    'hair straightener',
    'curling iron',
    'electric shaver',
    'electric razor',
    'trimmer',
    'electric toothbrush',
    'epilator',
    'مجفف شعر',
    'مكواة شعر',
    'ماكينة حلاقة',
    'فرشاة أسنان كهربائية',
  ],
};

const CATEGORY_DETECTION_ORDER: ProductCategory[] = [
  'laptop',
  'tablet',
  'monitor',
  'printer',
  'tv',
  'audio',
  // `smart_home` must come BEFORE `camera` so "Ring doorbell camera" and
  // similar security cameras are classified as smart_home, not as a
  // stand-alone camera (they're smart-home products that happen to include
  // a camera lens).
  'smart_home',
  'camera',
  'gaming',
  'wearable',
  'networking',
  'appliance',
  'kitchen',
  'personal_care',
  'smartphone',
  'accessories',
];

/**
 * Strong accessory-indicator keywords. If ANY of these appear in a title we
 * refuse to reclassify the product to a specific device category — it is
 * almost certainly an accessory FOR that device, not the device itself
 * ("iPhone 14 case" contains 'iphone' but is clearly not a smartphone).
 *
 * Keep this list tight: anything that can be the primary product type
 * (keyboard, mouse, headphones) does NOT belong here — those are correctly
 * typed as 'accessories' already.
 */
const ACCESSORY_INDICATORS = [
  // English
  ' case',
  ' cover',
  'protector',
  'protective film',
  ' sleeve',
  ' pouch',
  'laptop bag',
  'camera bag',
  'tablet bag',
  ' charger',
  ' adapter',
  ' cable',
  'lightning cable',
  'usb cable',
  ' cord',
  ' stand',
  ' mount',
  ' holder',
  ' bracket',
  'wall mount',
  'screen mount',
  'strap',
  'power bank',
  'powerbank',
  'tempered glass',
  'screen guard',
  'car mount',
  'phone grip',
  'popsocket',
  'tripod',
  'selfie stick',
  'lens filter',
  'cleaning kit',
  'skins for',
  'replacement band',
  // Arabic
  'جراب',
  'كفر',
  'حامل',
  'شاحن',
  'كيبل',
  'كابل',
  'واقي',
  'حافظة',
  'ستراب',
  'حزام',
  'غطاء',
  'مشبك',
];

function looksLikeAccessory(text: string): boolean {
  return ACCESSORY_INDICATORS.some((kw) => text.includes(kw));
}

const PRODUCT_CATEGORY_SET = new Set<ProductCategory>([
  'smartphone',
  'laptop',
  'tablet',
  'tv',
  'audio',
  'camera',
  'gaming',
  'accessories',
  'monitor',
  'printer',
  'networking',
  'smart_home',
  'wearable',
  'appliance',
  'kitchen',
  'personal_care',
]);

function containsKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

/**
 * Determines a product's category from its title using keyword matching.
 * Shared between search scrapers and cron scrapers.
 */
export function determineCategory(title: string): ProductCategory {
  const t = title.toLowerCase();
  for (const category of CATEGORY_DETECTION_ORDER) {
    if (containsKeyword(t, CATEGORY_KEYWORDS[category])) {
      return category;
    }
  }

  return 'accessories';
}

/**
 * High-confidence title-based classifier. Returns null when no *specific*
 * category keyword matches — the caller should then keep whatever
 * category the scraper derived from the listing URL.
 *
 * Use this to OVERRIDE a URL-derived category with what the product title
 * actually says. It differs from `determineCategory` in two ways:
 *   1. Never returns 'accessories' — that is too generic to override with.
 *   2. Returns null on no match, instead of defaulting to 'accessories'.
 *
 * Motivating case: Jarir's `computers-tablets.html` hosts BOTH laptops and
 * tablets under one URL. Without this classifier every product gets tagged
 * with whatever category name the scraper was called with (laptop or tablet),
 * which is essentially random. Reading the title ("MacBook Pro" vs "iPad Air")
 * fixes this deterministically.
 */
export function classifyFromTitle(title: string): ProductCategory | null {
  if (!title) return null;
  const t = title.toLowerCase();
  // If the title looks like an accessory (case, cable, stand, charger, …),
  // refuse to override the category — we would otherwise flip "iPhone 14
  // case" into 'smartphone' because it contains the `iphone` keyword. Let
  // the scraper's URL-derived category stand.
  if (looksLikeAccessory(t)) return null;
  for (const category of CATEGORY_DETECTION_ORDER) {
    if (category === 'accessories') continue;
    if (containsKeyword(t, CATEGORY_KEYWORDS[category])) {
      return category;
    }
  }
  return null;
}

/**
 * Checks if a product matches a given category filter.
 * Uses the product's category field if set, otherwise determines from title.
 */
export function matchesCategory(
  product: { category?: ProductCategory | string; name_en?: string | null; name_ar?: string | null },
  category: ProductCategory,
): boolean {
  if (product.category && PRODUCT_CATEGORY_SET.has(product.category as ProductCategory)) {
    const explicitCategory = product.category as ProductCategory;
    if (explicitCategory !== 'accessories') {
      return explicitCategory === category;
    }
    if (category === 'accessories') {
      return true;
    }
  }

  const title = product.name_en || product.name_ar || '';
  return title ? determineCategory(title) === category : false;
}
