/**
 * E6 — AC in live search: category-aware TPS canonical routing (ADR-024).
 * The search route must select ONE canonical category per query (never both):
 * clearly-AC → air_conditioner, accessory → none, else → mobile (unchanged).
 * This mirrors detectCanonicalCategory and asserts the route wires it (drift fails).
 */
import fs from 'fs';
import path from 'path';

const routeSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'api', 'search', 'route.ts'), 'utf8');

// Faithful mirror of route.ts normalizeArabic + detectCanonicalCategory.
function normalizeArabic(s: string): string {
  return (s || '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .trim();
}
const ACCESSORY_HINTS_AR = ['حامل', 'فتحة', 'موجه', 'غطاء', 'كفر', 'ملحق', 'ملحقات', 'حافظة', 'واقي', 'شاحن', 'كيبل', 'سلك', 'لاصقة', 'حماية', 'استاند', 'عدسة', 'ماجسيف', 'جراب', 'سماعه اذن'];
const ACCESSORY_HINTS_EN = ['accessory', 'accessories', 'cover', 'mount', 'holder', 'vent', 'adapter', 'charger', 'cable', 'case', 'remote', 'bracket', 'protector', 'stand', 'sticker', 'skin', 'lens', 'magsafe', 'tempered'];
const ACCESSORY_COMPAT_AR = /متوافق|مخصص\s+ل|(?:^|\s)ل(?:هاتف|جوال|ايفون|آيفون|سامسونج|جالاكسي)/;
const ACCESSORY_COMPAT_EN = /\bcompatible\b|\bfor\s+(?:iphone|samsung|galaxy|apple|xiaomi|huawei)\b/;
const AC_QUERY_WORDS = new Set(['مكيف', 'مكيفات', 'سبليت', 'شباك', 'كاسيت', 'دولابي', 'ac']);
function detectCanonicalCategory(raw: string): 'mobile' | 'air_conditioner' | null {
  const norm = normalizeArabic(raw).toLowerCase();
  const words = norm.split(/\s+/).filter(Boolean);
  if (
    ACCESSORY_HINTS_AR.some((h) => norm.includes(normalizeArabic(h))) ||
    ACCESSORY_HINTS_EN.some((h) => norm.includes(h)) ||
    ACCESSORY_COMPAT_AR.test(norm) || ACCESSORY_COMPAT_EN.test(norm)
  ) return null;
  const isAC = words.some((w) => AC_QUERY_WORDS.has(w)) || /split\s*ac|air\s*condition/.test(norm);
  if (isAC) return 'air_conditioner';
  return 'mobile';
}
void detectCanonicalCategory; // superseded by the multi-category mirror below (ADR-138)

// Mirror of the CURRENT route function. Kept faithful on purpose: a stale mirror that
// passes while production diverges is worse than no test at all.
const CATEGORY_QUERY_TERMS: Array<{ cats: string[]; terms: string[] }> = [
  { cats: ['dishwasher'], terms: ['غساله صحون', 'جلايه', 'dishwasher', 'صحون', 'اطباق'] },
  { cats: ['air_conditioner'], terms: ['مكيف', 'مكيفات', 'سبليت', 'شباك', 'كاسيت', 'دولابي', 'split ac', 'air condition'] },
  { cats: ['washing_machine'], terms: ['غساله', 'غسالات', 'washer', 'washing machine', 'نشافه', 'dryer'] },
  { cats: ['refrigerator'], terms: ['ثلاجه', 'ثلاجات', 'refrigerator', 'fridge', 'فريزر', 'freezer'] },
  { cats: ['tv', 'monitor'], terms: ['تلفزيون', 'تلفاز', 'شاشه', 'شاشات', 'tv', 'television', 'monitor', 'display'] },
  { cats: ['laptop'], terms: ['لابتوب', 'laptop', 'notebook', 'macbook', 'ماك بوك', 'حاسوب', 'كمبيوتر', 'chromebook'] },
  { cats: ['tablet'], terms: ['ايباد', 'ipad', 'تابلت', 'tablet', 'تاب'] },
  { cats: ['smartwatch'], terms: ['ساعه', 'ساعات', 'smartwatch', 'واتش', 'apple watch', 'جالكسي واتش'] },
  { cats: ['audio'], terms: ['سماعه', 'سماعات', 'headphone', 'headphones', 'earbud', 'earbuds', 'مكبر صوت', 'speaker', 'soundbar', 'ايربودز', 'airpods'] },
  { cats: ['printer'], terms: ['طابعه', 'طابعات', 'printer'] },
  { cats: ['vacuum'], terms: ['مكنسه', 'vacuum'] },
  { cats: ['microwave'], terms: ['ميكروويف', 'مايكروويف', 'microwave'] },
  { cats: ['camera'], terms: ['كاميرا', 'camera'] },
  { cats: ['mobile'], terms: ['جوال', 'جوالات', 'هاتف', 'هواتف', 'ايفون', 'iphone', 'phone', 'smartphone', 'mobile', 'جالكسي', 'galaxy', 'بكسل', 'pixel'] },
];
function detectCanonicalCategories(raw: string): string[] | null {
  const norm = normalizeArabic(raw).toLowerCase();
  if (
    ACCESSORY_HINTS_AR.some((h) => norm.includes(normalizeArabic(h))) ||
    ACCESSORY_HINTS_EN.some((h) => norm.includes(h)) ||
    ACCESSORY_COMPAT_AR.test(norm) || ACCESSORY_COMPAT_EN.test(norm)
  ) return null;
  const words = norm.split(/\s+/).filter(Boolean);
  if (words.some((w) => AC_QUERY_WORDS.has(w))) return ['air_conditioner'];
  for (const entry of CATEGORY_QUERY_TERMS) {
    if (entry.terms.some((t) => norm.includes(normalizeArabic(t)))) return entry.cats;
  }
  return ['mobile'];
}
const uiCategory = (c: string) => (c === 'mobile' ? 'smartphone' : c);

describe('category-aware canonical routing', () => {
  it('mobile queries → mobile canonical path (iPhone stays visible)', () => {
    expect(detectCanonicalCategories('ايفون 15')).toEqual(['mobile']);
    expect(detectCanonicalCategories('iphone 16')).toEqual(['mobile']);
    expect(detectCanonicalCategories('جالكسي s25')).toEqual(['mobile']);
  });
  it('AC queries → air_conditioner canonical path (GREE/LG AC visible)', () => {
    expect(detectCanonicalCategories('مكيف جري')).toEqual(['air_conditioner']);
    expect(detectCanonicalCategories('مكيف سبليت')).toEqual(['air_conditioner']);
    expect(detectCanonicalCategories('gree ac')).toEqual(['air_conditioner']);
    expect(detectCanonicalCategories('lg split ac')).toEqual(['air_conditioner']);
    expect(detectCanonicalCategories('split air conditioner')).toEqual(['air_conditioner']);
  });
  // ADR-138 — these all resolved to ['mobile'] before, so their comparable inventory
  // (65 TVs, 55 tablets, 48 washers, 28 laptops …) was unreachable from search.
  it('reaches the categories that were previously hidden', () => {
    expect(detectCanonicalCategories('تلفزيون 65 بوصة')).toEqual(['tv', 'monitor']);
    expect(detectCanonicalCategories('lg tv')).toEqual(['tv', 'monitor']);
    expect(detectCanonicalCategories('لابتوب')).toEqual(['laptop']);
    expect(detectCanonicalCategories('macbook')).toEqual(['laptop']);
    expect(detectCanonicalCategories('ايباد')).toEqual(['tablet']);
    expect(detectCanonicalCategories('غسالة سامسونج')).toEqual(['washing_machine']);
    expect(detectCanonicalCategories('ثلاجة')).toEqual(['refrigerator']);
    expect(detectCanonicalCategories('طابعة')).toEqual(['printer']);
    expect(detectCanonicalCategories('ميكروويف')).toEqual(['microwave']);
  });
  it('prefers the more specific phrase (dishwasher is not a washing machine)', () => {
    expect(detectCanonicalCategories('غسالة صحون')).toEqual(['dishwasher']);
    expect(detectCanonicalCategories('غسالة')).toEqual(['washing_machine']);
  });
  it('accessory queries → NO canonical Smart Pick (no AC/mobile contamination)', () => {
    expect(detectCanonicalCategories('كفر ايفون')).toBeNull();
    expect(detectCanonicalCategories('iphone case')).toBeNull();
    expect(detectCanonicalCategories('شاحن')).toBeNull();
    expect(detectCanonicalCategories('holder for iphone')).toBeNull();
  });
  it('unknown query uses safe fallback (mobile; returns [] when no canonical matches)', () => {
    expect(detectCanonicalCategories('random xyz')).toEqual(['mobile']);
  });
  it('UI category bridge maps mobile→smartphone, everything else passes through', () => {
    expect(uiCategory('mobile')).toBe('smartphone');
    expect(uiCategory('air_conditioner')).toBe('air_conditioner');
    expect(uiCategory('tv')).toBe('tv');
  });
});

describe('the search route wires category-aware routing (drift guard)', () => {
  // ADR-138: routing was hard-limited to mobile + air_conditioner, which made 323 of our
  // 459 comparable products unreachable from search. These guards now protect the WIDER
  // routing — narrowing it again is the regression to catch.
  it('routes by a set of categories, not a single hardcoded one', () => {
    expect(routeSrc).toMatch(/function detectCanonicalCategories/);
    expect(routeSrc).toMatch(/\.in\('category', categories\)/);
    expect(routeSrc).not.toMatch(/\.eq\('category', 'mobile'\)/);
  });
  it('reaches the categories that actually hold comparable inventory', () => {
    // Measured 2026-07-29 — every category below carries >=1 canonical with offers from
    // >=2 approved retailers. Dropping one silently re-hides that inventory.
    for (const cat of ['tv', 'tablet', 'washing_machine', 'monitor', 'audio', 'laptop',
      'smartwatch', 'printer', 'refrigerator', 'dishwasher', 'vacuum', 'microwave',
      'camera', 'mobile', 'air_conditioner']) {
      expect(routeSrc).toContain(`'${cat}'`);
    }
  });
  it('passes the derived categories and gates on them (skips when null)', () => {
    expect(routeSrc).toMatch(/const tpsCategories = rawQuery \? detectCanonicalCategories\(rawQuery\) : null/);
    expect(routeSrc).toMatch(/if \(rawQuery && tpsCategories\)/);
    expect(routeSrc).toMatch(/searchTPSCanonical\([^)]*tpsCategories\)/);
  });
  it('derives the UI category per canonical, since several may be searched at once', () => {
    expect(routeSrc).toMatch(/category\?: string \}\)\.category === 'mobile'/);
    expect(routeSrc).not.toMatch(/const uiCategory: ProductCategory/);
  });
});
