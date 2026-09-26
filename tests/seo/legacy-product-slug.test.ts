// tests/seo/legacy-product-slug.test.ts — ADR-387.
// An old title-derived product URL 308s to the real slug ONLY on an exact, unique derivation
// match — never a similarity guess, never the homepage.
import { legacyTitleSlug, pickLegacySlugMatch } from '@/lib/seo/product-data';

jest.mock('@/lib/database', () => ({ createServerClient: () => ({}) }));

describe('legacyTitleSlug', () => {
  it('reproduces the exact shape the old cards/tray emitted for the live Samsung case', () => {
    expect(legacyTitleSlug('Samsung Split AC, 18000 BTU,Rotary Compressor,Heat and Cold'))
      .toBe('samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold');
  });
});

describe('pickLegacySlugMatch', () => {
  const requested = 'samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold';
  const real = { slug: 'samsung-split-ac-18000-bturotary-compressorheat-and-cold', name_en: 'Samsung Split AC, 18000 BTU,Rotary Compressor,Heat and Cold' };

  it('returns the one product whose title re-derives to the requested legacy slug', () => {
    expect(pickLegacySlugMatch(requested, [real, { slug: 'other', name_en: 'Samsung Split AC 24000 BTU' }])).toBe(real.slug);
  });
  it('returns null when several distinct products re-derive to it (ambiguous → honest 404)', () => {
    expect(pickLegacySlugMatch(requested, [real, { slug: 'dup-2', name_en: 'Samsung Split AC 18000 BTU Rotary Compressor Heat and Cold' }])).toBeNull();
  });
  it('returns null when nothing matches exactly (a LIKE candidate is not a match)', () => {
    expect(pickLegacySlugMatch(requested, [{ slug: 'samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold-x', name_en: 'Samsung Split AC 18000 BTU Rotary Compressor Heat and Cold X' }])).toBeNull();
  });
  it('never redirects a slug to itself', () => {
    expect(pickLegacySlugMatch('a-b', [{ slug: 'a-b', name_en: 'A B' }])).toBeNull();
  });
});
