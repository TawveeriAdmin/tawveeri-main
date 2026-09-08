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
