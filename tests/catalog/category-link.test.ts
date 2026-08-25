// tests/catalog/category-link.test.ts
// Category-facet-pages analytics mission (2026-08-25). Pure round-trip: a category/facet
// page's product-card link (withCategoryAttribution) must produce a URL the compare page's
// own read side (readCategoryAttribution) resolves back to the SAME category/facet — this is
// the entire mechanism a merchant-exit click is attributed through, so a break here silently
// blanks out category_go_click for everyone, not just one test case.
import { withCategoryAttribution, readCategoryAttribution } from '@/lib/catalog/category-link';

describe('withCategoryAttribution', () => {
  it('appends src+category for a base category page (no facet)', () => {
    const url = withCategoryAttribution('/compare/lg%7Csplit%7C18000', 'air_conditioner', null);
    expect(url).toBe('/compare/lg%7Csplit%7C18000?src=category&category=air_conditioner');
  });

  it('appends facet too when on a facet page', () => {
    const url = withCategoryAttribution('/compare/lg%7Csplit%7C18000', 'air_conditioner', '18000-btu');
    const parsed = new URL('https://x' + url);
    expect(parsed.searchParams.get('src')).toBe('category');
    expect(parsed.searchParams.get('category')).toBe('air_conditioner');
    expect(parsed.searchParams.get('facet')).toBe('18000-btu');
  });

  it('appends with & when the compare URL already carries a query string', () => {
    const url = withCategoryAttribution('/compare/x?foo=bar', 'air_conditioner', null);
    expect(url).toBe('/compare/x?foo=bar&src=category&category=air_conditioner');
  });

  it('never mutates the path — only ever adds a query string (canonical URL stays untouched)', () => {
    const url = withCategoryAttribution('/compare/lg%7Csplit', 'air_conditioner', 'lg');
    expect(url.split('?')[0]).toBe('/compare/lg%7Csplit');
  });
});

describe('readCategoryAttribution', () => {
  it('resolves a base-category link back to {category, facet: null}', () => {
    expect(readCategoryAttribution({ src: 'category', category: 'air_conditioner' })).toEqual({
      category: 'air_conditioner',
      facet: null,
    });
  });

  it('resolves a facet link back to {category, facet}', () => {
    expect(readCategoryAttribution({ src: 'category', category: 'air_conditioner', facet: '18000-btu' })).toEqual({
      category: 'air_conditioner',
      facet: '18000-btu',
    });
  });

  it('round-trips exactly through withCategoryAttribution for every facet-page case', () => {
    const url = withCategoryAttribution('/compare/x', 'air_conditioner', 'lg');
    const parsed = new URL('https://x' + url);
    const sp = Object.fromEntries(parsed.searchParams.entries());
    expect(readCategoryAttribution(sp)).toEqual({ category: 'air_conditioner', facet: 'lg' });
  });

  it('returns null when src is absent (an ordinary, non-category visit — the default case)', () => {
    expect(readCategoryAttribution({})).toBeNull();
    expect(readCategoryAttribution({ category: 'air_conditioner' })).toBeNull();
  });

  it('returns null when src is present but category is missing — never attribute to an unnamed source', () => {
    expect(readCategoryAttribution({ src: 'category' })).toBeNull();
    expect(readCategoryAttribution({ src: 'category', category: '' })).toBeNull();
  });

  it('returns null for any src other than the exact literal "category" (no silent fuzzy match)', () => {
    expect(readCategoryAttribution({ src: 'search', category: 'air_conditioner' })).toBeNull();
    expect(readCategoryAttribution({ src: 'Category', category: 'air_conditioner' })).toBeNull();
  });

  it('handles the array form Next.js can hand back for a repeated query param', () => {
    expect(readCategoryAttribution({ src: ['category', 'category'], category: ['air_conditioner'] })).toEqual({
      category: 'air_conditioner',
      facet: null,
    });
  });
});
