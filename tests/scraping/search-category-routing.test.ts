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
const uiCategory = (c: 'mobile' | 'air_conditioner') => (c === 'mobile' ? 'smartphone' : c);

describe('category-aware canonical routing', () => {
  it('mobile queries → mobile canonical path (iPhone stays visible)', () => {
    expect(detectCanonicalCategory('ايفون 15')).toBe('mobile');
    expect(detectCanonicalCategory('iphone 16')).toBe('mobile');
    expect(detectCanonicalCategory('جالكسي s25')).toBe('mobile');
  });
  it('AC queries → air_conditioner canonical path (GREE/LG AC visible)', () => {
    expect(detectCanonicalCategory('مكيف جري')).toBe('air_conditioner');
    expect(detectCanonicalCategory('مكيف سبليت')).toBe('air_conditioner');
    expect(detectCanonicalCategory('gree ac')).toBe('air_conditioner');
    expect(detectCanonicalCategory('lg split ac')).toBe('air_conditioner');
    expect(detectCanonicalCategory('split air conditioner')).toBe('air_conditioner');
  });
  it('accessory queries → NO canonical Smart Pick (no AC/mobile contamination)', () => {
    expect(detectCanonicalCategory('كفر ايفون')).toBeNull();
    expect(detectCanonicalCategory('iphone case')).toBeNull();
    expect(detectCanonicalCategory('شاحن')).toBeNull();
    expect(detectCanonicalCategory('holder for iphone')).toBeNull();
  });
  it('unknown query uses safe fallback (mobile; returns [] when no canonical matches)', () => {
    expect(detectCanonicalCategory('لابتوب')).toBe('mobile');
    expect(detectCanonicalCategory('random xyz')).toBe('mobile');
  });
  it('never returns both categories — one category per query', () => {
    for (const q of ['ايفون 15', 'مكيف جري', 'كفر', 'samsung', 'lg ac']) {
      const c = detectCanonicalCategory(q);
      expect([null, 'mobile', 'air_conditioner']).toContain(c);
    }
  });
  it('UI category bridge maps mobile→smartphone, air_conditioner→air_conditioner', () => {
    expect(uiCategory('mobile')).toBe('smartphone');
    expect(uiCategory('air_conditioner')).toBe('air_conditioner');
  });
});

describe('the search route wires category-aware routing (drift guard)', () => {
  it('defines detectCanonicalCategory and no longer hardcodes only mobile', () => {
    expect(routeSrc).toMatch(/function detectCanonicalCategory/);
    expect(routeSrc).toMatch(/\.eq\('category', category\)/);
    expect(routeSrc).not.toMatch(/\.eq\('category', 'mobile'\)/);
  });
  it('passes the derived category and gates on it (skips when null)', () => {
    expect(routeSrc).toMatch(/const tpsCategory = rawQuery \? detectCanonicalCategory\(rawQuery\) : null/);
    expect(routeSrc).toMatch(/if \(rawQuery && tpsCategory\)/);
    expect(routeSrc).toMatch(/searchTPSCanonical\([^)]*tpsCategory\)/);
  });
  it('uses the category-aware UI bridge (not a hardcoded smartphone)', () => {
    expect(routeSrc).toMatch(/const uiCategory: ProductCategory = category === 'mobile'/);
    expect(routeSrc).toMatch(/category: uiCategory,/);
  });
});
