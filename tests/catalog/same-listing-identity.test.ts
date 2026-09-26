// tests/catalog/same-listing-identity.test.ts — ADR-389 §4.
// The product page may take the knowledge layer's Arabic title/image ONLY for a canonical
// proven to be the SAME merchant listing (listing-URL equality), never by name similarity.
import { pickSameListingCanonical, hasArabicLetters } from '@/lib/catalog/same-listing-identity';
import { applyListingIdentity } from '@/app/[locale]/(product)/products/[slug]/product-detail-client';

const EXTRA = 'https://www.extra.com/en-sa/large-appliances-/air-conditioner/split-air-conditioner/samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold/p/100226575';
const canonical = { id: 'eea9c4f2', tps_identity_key: 'samsung|split|NO_SERIES|18000|Standard|NO_MODE', name_ar: 'مكيف سبليت سامسونج، 18000 وحدة، عادي', name_en: 'Samsung Split AC 18000 BTU Standard', image_url: 'https://media.extra.com/s/aurora/100226575_800/x', brand: 'samsung' };

describe('pickSameListingCanonical', () => {
  it('matches on the normalized listing URL (tracking suffix ignored) and returns the canonical', () => {
    const out = pickSameListingCanonical([EXTRA], [{ identity_key: canonical.tps_identity_key, url: `${EXTRA}?utm_source=x`, store_id: 4 }], [canonical]);
    expect(out?.canonical_id).toBe('eea9c4f2');
    expect(out?.name_ar).toMatch(/سامسونج/);
  });
  it('a different listing at the same store, or a similar name, never matches', () => {
    expect(pickSameListingCanonical([EXTRA], [{ identity_key: canonical.tps_identity_key, url: EXTRA.replace('100226575', '100226576'), store_id: 4 }], [canonical])).toBeNull();
    expect(pickSameListingCanonical([EXTRA], [], [canonical])).toBeNull();
    expect(pickSameListingCanonical([], [{ identity_key: canonical.tps_identity_key, url: EXTRA, store_id: 4 }], [canonical])).toBeNull();
  });
  it('an offer whose key has no active canonical yields nothing (no guess)', () => {
    expect(pickSameListingCanonical([EXTRA], [{ identity_key: 'other|key', url: EXTRA, store_id: 4 }], [canonical])).toBeNull();
  });
});

describe('applyListingIdentity', () => {
  const row = { name_ar: 'Samsung Split AC 18000 BTU Rotary Compressor Heat and Cold', name_en: 'Samsung Split AC, 18000 BTU,Rotary Compressor,Heat and Cold', image_urls: [] as string[] | null };
  const listing = { name_ar: canonical.name_ar, name_en: canonical.name_en, image_url: canonical.image_url, tps_identity_key: canonical.tps_identity_key };

  it('uses the documented Arabic title and the listing image when the row has neither, keeping the merchant title', () => {
    const out = applyListingIdentity(row, listing);
    expect(out.name_ar).toBe(canonical.name_ar);
    expect(out.image_urls).toEqual([canonical.image_url]);
    expect(out.merchant_title).toBe(row.name_ar);
    expect(out.name_en).toBe(row.name_en); // codes/wording of the merchant title untouched
  });
  it('never overrides an Arabic title or an existing image', () => {
    const arabicRow = { ...row, name_ar: 'مكيف سامسونج 18000 وحدة', image_urls: ['https://img/mine.png'] };
    expect(applyListingIdentity(arabicRow, listing)).toBe(arabicRow);
  });
  it('no listing → untouched', () => {
    expect(applyListingIdentity(row, null)).toBe(row);
  });
  it('hasArabicLetters', () => {
    expect(hasArabicLetters('Samsung Split AC')).toBe(false);
    expect(hasArabicLetters('مكيف')).toBe(true);
    expect(hasArabicLetters(null)).toBe(false);
  });
});
