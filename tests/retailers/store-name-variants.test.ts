// tests/retailers/store-name-variants.test.ts — external review 2026-10-06: «WA21A8376GV» + store filter Amazon returned nothing while Amazon's offer existed.
// The filter sidebar sends SLUGS; Algolia's store_names facet and product_stores.store_name hold DISPLAY names. Retrieval must match every stored spelling.
import { storeNameVariants, resolveApprovedSlug } from '@/lib/retailers/approved-retailers';

describe('storeNameVariants', () => {
  it('a slug expands to every stored spelling of that retailer (and the slug itself)', () => {
    const v = storeNameVariants(['amazon']);
    expect(v).toEqual(expect.arrayContaining(['amazon', 'أمازون', 'أمازون السعودية']));
    expect(v.every((n) => resolveApprovedSlug(n) === 'amazon')).toBe(true);
  });
  it('an Arabic display name expands the same way, several retailers stay separate', () => {
    const v = storeNameVariants(['إكسترا', 'noon']);
    expect(v).toEqual(expect.arrayContaining(['extra', 'اكسترا', 'إكسترا', 'noon', 'نون']));
    expect(v).not.toContain('amazon');
  });
  it('an unknown identifier is kept verbatim (an honest zero downstream), never widened to other retailers', () => {
    expect(storeNameVariants(['no-such-store'])).toEqual(['no-such-store']);
    expect(storeNameVariants([])).toEqual([]);
  });
});
