import { normalizeStoreUrl } from '@/lib/catalog/normalizeStoreUrl';

// Regression for the CONFIRMED Almanea outbound failure (7/7 HTTP 404): the Algolia index ships
// DEV URLs (m.dev-almanea.com/{rewrite}-p-{sku}); the correct LIVE product page is
// www.almanea.sa/en/product/p-{sku} (verified rendering the exact product across 10 categories).
describe('normalizeStoreUrl — Almanea dev→prod repair', () => {
  it('maps a dev-almanea URL to the live /en/product/p-{sku} form', () => {
    const dev = 'https://m.dev-almanea.com/apple-iphone-16-pro-max-256gb-5g-desert-titanium-p-170111801030065';
    expect(normalizeStoreUrl('almanea', dev)).toBe('https://www.almanea.sa/en/product/p-170111801030065');
  });

  it('extracts the 15-digit sku regardless of the slug', () => {
    const dev = 'https://m.dev-almanea.com/mtc-split-ac-18000-btu-white-mtc18cut25inv-p-110300302318010';
    expect(normalizeStoreUrl('almanea', dev)).toBe('https://www.almanea.sa/en/product/p-110300302318010');
  });

  it('is idempotent for an already-production URL (no double transform)', () => {
    const prod = 'https://www.almanea.sa/en/product/p-170111801030065';
    expect(normalizeStoreUrl('almanea', prod)).toBe(prod);
  });

  it('leaves other retailers untouched', () => {
    const jarir = 'https://www.jarir.com/sa-en/realme-12-5g-smartphones-jpm1480.html';
    expect(normalizeStoreUrl('jarir', jarir)).toBe(jarir);
  });
});
