import { samsungManufacturerIdentity, samsungDeclaredModelIdentity } from '../../scripts/tps-core/samsung-manufacturer-identity';

const product = (sku: string, category = 'air-conditioners') => ({ brand: 'Samsung', sku,
  product_url: `https://www.samsung.com/sa_en/${category}/wall-mount/product-${sku.toLowerCase().replace(/\//g, '-')}/` });

describe('Samsung manufacturer model identity', () => {
  it.each(['MX-T70/ZN', 'HAF-QIN/EXP', 'HAFEX/EXP', 'SKK-ALE/SC'])('accepts the verified full manufacturer format %s', model => {
    expect(samsungManufacturerIdentity(6, product(model, 'home-appliance-accessories'))?.model).toBe(model);
  });
  it('keeps every Saudi suffix and does not collapse regional variants', () => {
    const mg = samsungManufacturerIdentity(6, product('AR18TSECCWK/MG'));
    const sa = samsungManufacturerIdentity(6, product('AR18TSECCWK/SA'));
    expect(mg).toEqual({ category: 'air_conditioner', model: 'AR18TSECCWK/MG', key: 'samsung|MODEL:AR18TSECCWK/MG' });
    expect(sa?.key).not.toBe(mg?.key);
  });
  it('separates two physical monitors with the same generic display specifications', () => {
    const first = samsungManufacturerIdentity(6, product('LS27FG532EMXUE', 'monitors'));
    const second = samsungManufacturerIdentity(6, product('LS27FG502EMXUE', 'monitors'));
    expect(first?.key).not.toBe(second?.key);
    expect(first?.category).toBe('monitor');
  });
  it.each([2, 3, 4, 5])('does not override retailer %s normalization', store => {
    expect(samsungManufacturerIdentity(store, product('AR18TSECCWK/MG'))).toBeNull();
  });
  it('requires the Saudi manufacturer URL to independently identify the supplied SKU', () => {
    const p = product('AR18TSECCWK/MG');
    expect(samsungManufacturerIdentity(6, { ...p, sku: 'AR24CSFCBWK/MG' })).toBeNull();
    expect(samsungManufacturerIdentity(6, { ...p, product_url: p.product_url.replace('www.samsung.com', 'evil-samsung.com') })).toBeNull();
    expect(samsungManufacturerIdentity(6, { ...p, product_url: p.product_url.replace('/sa_en/', '/us/') })).toBeNull();
  });
  it('recognizes an independently identified charger without turning it into a phone', () => {
    expect(samsungManufacturerIdentity(6, product('EP-T4511XBEGWW', 'mobile-accessories'))?.category).toBe('accessories');
  });
  it('joins another retailer only on a complete, independently verified declared manufacturer code', () => {
    const identity = samsungManufacturerIdentity(6, product('AR18TSECCWK/MG'))!;
    const verified = new Map([[identity.model, identity]]);
    expect(samsungDeclaredModelIdentity('samsung', { modelNumber: 'AR18TSECCWK/MG', sku: '123456789' }, verified)?.key).toBe(identity.key);
    expect(samsungDeclaredModelIdentity('samsung', { model: 'AR18TSECCWK' }, verified)).toBeNull();
    expect(samsungDeclaredModelIdentity('samsung', { model: 'AR18TSECCWK/SA' }, verified)).toBeNull();
    expect(samsungDeclaredModelIdentity('lg', { model: identity.model }, verified)).toBeNull();
    expect(samsungDeclaredModelIdentity('samsung', { image: `https://example.com/${identity.model}.jpg` }, verified)).toBeNull();
  });
});
