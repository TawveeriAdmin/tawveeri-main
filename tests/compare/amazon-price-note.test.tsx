/**
 * ADR-399 (F-007) — beside every displayed Amazon price: observation time in Riyadh time (+03)
 * and «قابل للتغيير»; the Associates disclosure on the surface itself. Only Amazon; ranking untouched.
 */
import fs from 'fs';
import path from 'path';
import { formatRiyadhObservation, isAmazonStore, AMAZON_ASSOCIATES_DISCLOSURE } from '../../src/components/compare/amazon-price-note';

describe('formatRiyadhObservation', () => {
  it('renders the observation in Riyadh time (+03) with Latin digits, in both locales', () => {
    // 18:42Z == 21:42 Riyadh
    expect(formatRiyadhObservation('2026-10-01T18:42:00Z', true)).toBe('1 أكتوبر 2026، 21:42');
    expect(formatRiyadhObservation('2026-10-01T18:42:00Z', false)).toBe('1 October 2026, 21:42');
    expect(formatRiyadhObservation('2026-09-30T22:30:00Z', true)).toBe('1 أكتوبر 2026، 01:30'); // crosses midnight in +03
  });
  it('returns null for missing or unusable input (no claim is made)', () => {
    expect(formatRiyadhObservation(null, true)).toBeNull();
    expect(formatRiyadhObservation('not-a-date', true)).toBeNull();
  });
});

describe('isAmazonStore', () => {
  it('recognises the slug and the approved display names, nothing else', () => {
    expect(isAmazonStore('amazon')).toBe(true);
    expect(isAmazonStore('أمازون')).toBe(true);
    expect(isAmazonStore('Amazon.sa')).toBe(true);
    expect(isAmazonStore('extra')).toBe(false);
    expect(isAmazonStore('إكسترا')).toBe(false);
    expect(isAmazonStore(null)).toBe(false);
  });
});

describe('surfaces — static wiring', () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
  it('the compare page shows the note beside Amazon prices (row + featured) and the disclosure once; ranking code untouched', () => {
    const src = read('src/app/[locale]/(public)/compare/[key]/page.tsx');
    expect(src).toContain("isAmazonStore(offer.store_slug) && <AmazonPriceNote observedAt={offer.observed_at}");
    expect(src).toContain("isAmazonStore(featured.store_slug) && <AmazonPriceNote observedAt={featured.observed_at}");
    expect(src).toContain('offers.some((o) => isAmazonStore(o.store_slug)) && <AmazonAssociatesDisclosure');
    expect(src).toMatch(/const featured = offers\.find\(\(o\) => o\.store_name === summary\.cheapest_store\)/); // unchanged selection rule
  });
  it('the product best-price card and the search pick card carry the same note for Amazon only', () => {
    expect(read('src/components/products/best-price-card.tsx')).toContain('isAmazonStore(store.slug ?? store.name_en)');
    expect(read('src/components/search/smart-pick-card.tsx')).toContain('isAmazonStore(pick.store_name)');
  });
  it('uses the exact Associates disclosure sentence', () => {
    expect(AMAZON_ASSOCIATES_DISCLOSURE.en).toBe('As an Amazon Associate we earn from qualifying purchases.');
  });
});
