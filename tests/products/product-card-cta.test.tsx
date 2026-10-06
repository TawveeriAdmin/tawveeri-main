/**
 * @jest-environment jsdom
 */
// Regression coverage for the founder's shopper price/compare/back-nav audit (2026-09-08).
//
// ROOT CAUSE: `externalProductUrl` is only ever computed for a SINGLE-store card
// (`product-card.tsx`'s `rawExternalUrl` is guarded by `!isMultiStore`), so every multi-store
// card structurally has `externalProductUrl === null`. Before this fix, the Primary CTA block
// rendered the "رابط المتجر غير متاح لهذا العرض" ("No store link available") message whenever
// `externalProductUrl` was falsy — REGARDLESS of whether a working "قارن الأسعار" (Compare)
// button was already rendered above it. Every multi-store card with `tps_compare_url` set
// (which is only ever set when the offer has ≥2 approved-retailer stores — see
// `src/app/api/search/route.ts`'s `byStore.size >= 2` gate) showed a dead-end-looking warning
// directly beneath a working action. This suite pins the corrected contract: Compare available
// → no warning; direct link available → direct CTA; neither → the honest unavailable state
// still renders (a true dead end is not hidden).
import { render, screen } from '@testing-library/react';
import { ProductCard, type ProductCardProduct } from '@/components/products/product-card';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ locale: 'ar' }),
}));

jest.mock('@/lib/simple-intl-provider', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/analytics/track', () => ({ track: jest.fn() }));
jest.mock('@/lib/analytics/interaction', () => ({ recordFirstPartyInteraction: jest.fn() }));

const UNAVAILABLE_TEXT = 'رابط المتجر غير متاح لهذا العرض';
const COMPARE_TEXT = 'قارن الأسعار';

function baseStore(overrides: Partial<ProductCardProduct['product_stores'][number]> = {}): ProductCardProduct['product_stores'][number] {
  return {
    id: 'ps-1',
    current_price: 1749,
    original_price: null,
    availability: 'in_stock',
    product_url: null,
    stores: { id: 'extra', slug: 'extra', name_ar: 'اكسترا', name_en: 'Extra', logo_url: null },
    ...overrides,
  } as ProductCardProduct['product_stores'][number];
}

function baseProduct(overrides: Partial<ProductCardProduct> = {}): ProductCardProduct {
  return {
    id: 'canon-1',
    name_ar: 'لابتوب HP',
    name_en: 'HP Laptop',
    slug: 'hp-laptop',
    category: 'laptop',
    brand: 'HP',
    model: 'X1',
    image_urls: null,
    product_stores: [baseStore()],
    tps_compare_url: null,
    ...overrides,
  } as ProductCardProduct;
}

describe('ProductCard — Primary CTA vs "store link unavailable" (founder audit 2026-09-08)', () => {
  it('multi-store card with a working Compare link shows Compare and NO "unavailable" warning', () => {
    const product = baseProduct({
      tps_compare_url: '/ar/compare/hp-laptop-x1',
      product_stores: [
        baseStore({ id: 'ps-1', current_price: 1749, stores: { id: 'extra', slug: 'extra', name_ar: 'اكسترا', name_en: 'Extra', logo_url: null } }),
        baseStore({ id: 'ps-2', current_price: 1899, stores: { id: 'noon', slug: 'noon', name_ar: 'نون', name_en: 'Noon', logo_url: null } }),
      ],
    });
    render(<ProductCard product={product} locale="ar" />);
    expect(screen.getByText(COMPARE_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE_TEXT)).not.toBeInTheDocument();
  });

  it('single-store card with a direct merchant link shows the direct CTA and no warning', () => {
    const product = baseProduct({
      tps_compare_url: null,
      product_stores: [baseStore({ product_url: 'https://www.extra.com/some-product' })],
    });
    render(<ProductCard product={product} locale="ar" />);
    expect(screen.queryByText(UNAVAILABLE_TEXT)).not.toBeInTheDocument();
  });

  it('a true dead end (no compare, no direct link) still shows the honest unavailable state', () => {
    const product = baseProduct({
      tps_compare_url: null,
      product_stores: [baseStore({ product_url: null })],
    });
    render(<ProductCard product={product} locale="ar" />);
    expect(screen.getByText(UNAVAILABLE_TEXT)).toBeInTheDocument();
  });
});

describe('ProductCard — a multi-store card with no compare page still exits through its best-price offer (external review 2026-10-06)', () => {
  const two = (urls: [string | null, string | null]) => baseProduct({
    tps_compare_url: null,
    product_stores: [
      baseStore({ id: 'ps-1', current_price: 3272, product_url: urls[0], stores: { id: 'amazon', slug: 'amazon', name_ar: 'أمازون', name_en: 'Amazon', logo_url: null } }),
      baseStore({ id: 'ps-2', current_price: 4799, product_url: urls[1], stores: { id: 'samsung_ksa', slug: 'samsung_ksa', name_ar: 'سامسونج السعودية', name_en: 'Samsung KSA', logo_url: null } }),
    ],
  });

  it('shows the button on the best-price store\'s own /go exit, and no «unavailable» message', () => {
    render(<ProductCard product={two(['/go/aaaaaaaa-0000-4000-8000-000000000001?gt=1.x', '/go/bbbbbbbb-0000-4000-8000-000000000002?gt=1.x'])} locale="ar" />);
    const link = screen.getByText('عرض في أمازون').closest('a');
    expect(link).toHaveAttribute('href', expect.stringContaining('/go/aaaaaaaa-0000-4000-8000-000000000001'));
    expect(screen.queryByText(UNAVAILABLE_TEXT)).not.toBeInTheDocument();
  });

  it('still says «unavailable» when the best-price offer genuinely has no exit (a true dead end is not hidden)', () => {
    render(<ProductCard product={two([null, null])} locale="ar" />);
    expect(screen.getByText(UNAVAILABLE_TEXT)).toBeInTheDocument();
  });

  it('Compare, when it exists, stays the only primary path (no second store button appears)', () => {
    const p = two(['/go/aaaaaaaa-0000-4000-8000-000000000001?gt=1.x', null]);
    p.tps_compare_url = '/ar/compare/x';
    render(<ProductCard product={p} locale="ar" />);
    expect(screen.getByText(COMPARE_TEXT)).toBeInTheDocument();
    expect(screen.queryByText('عرض في أمازون')).not.toBeInTheDocument();
  });
});

import { claimEligibleStoreCount, hasClaimDeal } from '@/components/products/product-card';

describe('claims need a KNOWN observation time (2026-10-06)', () => {
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const st = (id: string, price: number, observed_at: string | null, extra: Record<string, unknown> = {}) =>
    baseStore({ id, current_price: price, observed_at, stores: { id, slug: id, name_ar: id, name_en: id, logo_url: null }, ...extra } as never);

  it('unknown-age offers never count toward the best-price claim; known-fresh ones do', () => {
    expect(claimEligibleStoreCount([st('a', 10, null), st('b', 12, null)])).toBe(0);
    expect(claimEligibleStoreCount([st('a', 10, null), st('b', 12, day(1))])).toBe(1);
    expect(claimEligibleStoreCount([st('a', 10, day(1)), st('b', 12, day(2))])).toBe(2);
    expect(claimEligibleStoreCount([st('a', 10, day(1)), st('b', 12, day(9))])).toBe(1);   // 9 days old: reference only
  });

  it('a discount claim needs a fresh, known-age offer carrying it', () => {
    expect(hasClaimDeal([st('a', 80, null, { original_price: 100 })])).toBe(false);
    expect(hasClaimDeal([st('a', 80, day(1), { original_price: 100 })])).toBe(true);
    expect(hasClaimDeal([st('a', 80, day(10), { original_price: 100 })])).toBe(false);
  });

  it('a multi-store legacy card with no timestamps shows no winner badge and says «reference price»', () => {
    const p = baseProduct({
      tps_compare_url: null,
      product_stores: [st('amazon', 815, null), st('noon', 899, null)],
    });
    render(<ProductCard product={p} locale="ar" />);
    expect(screen.queryByText('🏆 أفضل سعر')).not.toBeInTheDocument();
    expect(screen.getByTestId('reference-price-note')).toBeInTheDocument();
  });
});
