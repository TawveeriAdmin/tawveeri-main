/**
 * Centralized brand-voice copy.
 * Keeps bilingual strings consistent across badges, cards, empty states, and CTAs
 * so individual components don't drift. Feed a `locale` ('ar' | 'en') — most
 * callers will use `useLocale()` and pass its value.
 */

export type Locale = 'ar' | 'en';

const fmtNumber = (n: number, locale: Locale) =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(n));

/** Gold "Best Price" chip label. */
export const bestPrice = (locale: Locale): string =>
  locale === 'ar' ? '🏆 أفضل سعر' : '🏆 Best Price';

/** "Save X SAR" — use for savings chips on cards, product detail, and dashboard. */
export const savings = (amount: number, locale: Locale): string =>
  locale === 'ar' ? `وفّر ${fmtNumber(amount, 'ar')} ر.س` : `Save ${fmtNumber(amount, 'en')} SAR`;

/** "Compare across N stores" — used below cards with multi-store availability. */
export const compareAcross = (storeCount: number, locale: Locale): string =>
  locale === 'ar'
    ? `قارن السعر بين ${fmtNumber(storeCount, 'ar')} متاجر`
    : `Compare across ${fmtNumber(storeCount, 'en')} stores`;

/** Availability badge labels. */
export const outOfStock = (locale: Locale): string =>
  locale === 'ar' ? 'غير متوفر' : 'Out of stock';

export const limitedStock = (locale: Locale): string =>
  locale === 'ar' ? 'كمية محدودة' : 'Limited stock';

export const inStock = (locale: Locale): string =>
  locale === 'ar' ? 'متوفر' : 'In stock';

/** Coupon interactions. */
export const copyCoupon = (locale: Locale): string =>
  locale === 'ar' ? 'نسخ الكود' : 'Copy code';

export const copied = (locale: Locale): string =>
  locale === 'ar' ? 'تم النسخ' : 'Copied';

/** Empty-state default copy (used when the consumer doesn't pass custom text). */
export const emptyDefaults = (locale: Locale) => ({
  search: {
    title: locale === 'ar' ? 'لم نعثر على نتائج' : 'No results found',
    description:
      locale === 'ar'
        ? 'جرّب كلمات بحث أخرى أو تصفّح الفئات الشائعة.'
        : 'Try different keywords or browse popular categories.',
  },
  wishlist: {
    title: locale === 'ar' ? 'قائمة المفضلة فارغة' : 'Your wishlist is empty',
    description:
      locale === 'ar'
        ? 'احفظ المنتجات لمتابعة أسعارها والحصول على تنبيهات عند انخفاضها.'
        : 'Save products to track their price and get alerts when they drop.',
  },
  deals: {
    title: locale === 'ar' ? 'لا توجد عروض حاليًا' : 'No active deals',
    description:
      locale === 'ar'
        ? 'عُد لاحقًا — نضيف عروضًا جديدة يوميًا.'
        : 'Check back soon — we add new deals daily.',
  },
  compare: {
    title: locale === 'ar' ? 'لم تُضف منتجات للمقارنة' : 'Nothing to compare yet',
    description:
      locale === 'ar'
        ? 'أضف حتى 4 منتجات من نتائج البحث لمقارنتها جنبًا إلى جنب.'
        : 'Add up to 4 products from search to compare side-by-side.',
  },
});
