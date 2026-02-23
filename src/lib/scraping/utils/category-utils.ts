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
    'smartwatch',
    'wearable',
    'ملحقات',
    'إكسسوارات',
    'جراب',
    'كفر',
    'شاحن',
    'كيبل',
    'ساعة ذكية',
  ],
};

const CATEGORY_DETECTION_ORDER: ProductCategory[] = [
  'laptop',
  'tablet',
  'tv',
  'audio',
  'camera',
  'gaming',
  'smartphone',
  'accessories',
];

const PRODUCT_CATEGORY_SET = new Set<ProductCategory>([
  'smartphone',
  'laptop',
  'tablet',
  'tv',
  'audio',
  'camera',
  'gaming',
  'accessories',
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
