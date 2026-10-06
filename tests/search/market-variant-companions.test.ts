import { lgModelCodes, attachMarketVariantCompanions } from '@/lib/search/market-variant-companions';

const entry = (store: string, price: number, url = `/go/${store}`) => ({ store, store_name: store, current_price: price, product_url: url, observed_at: new Date().toISOString(), listing_url: null });
const card = (over: Record<string, unknown>) => ({ name_ar: '', name_en: '', brand: 'lg', tps_identity_key: null, stores: [] as ReturnType<typeof entry>[], ...over }) as never;

describe('LG market-variant companions (manufacturer-documented format only)', () => {
  it('reads the LG model name and its variant from titles, not from unknown suffixes', () => {
    const m = lgModelCodes(['75 inch LG Mini-LED QNED 4K 2025 75QNED93A6A-AMAQ Black']);
    expect([...m.keys()]).toEqual(['75QNED93A6A']); expect([...m.get('75QNED93A6A')!]).toEqual(['AMAQ']);
    expect([...lgModelCodes(['LG 75QNED93A6A TV']).get('75QNED93A6A')!]).toEqual(['']);
    // an Asus-style or unknown suffix is NOT an LG market variant: the token is ignored entirely
    expect(lgModelCodes(['ASUS FA608PM-RV027W']).size).toBe(0);
    expect(lgModelCodes(['LG 65UR78006LK.AEK']).has('65UR78006LK')).toBe(true);
  });

  it('the Noon 75QNED93A6A-AMAQ card becomes a companion of the 75QNED93A6A card; the price/stores/claims of the primary are untouched', () => {
    const primary = card({ name_en: 'Lg 75QNED93A6A TV', tps_identity_key: 'lg|MODEL:75QNED93A6A', best_price: 4998.93, stores: [entry('amazon', 4998.93), entry('extra', 4999)] });
    const noon = card({ name_en: '75 inch LG Mini-LED QNED AI 75QNED93A6A-AMAQ Black', brand: 'LG', best_price: 4499, stores: [entry('noon', 4499, '/go/ps_noon')] });
    const out = attachMarketVariantCompanions([primary, noon]) as unknown as Array<{ stores: unknown[]; best_price: number; market_variant_companions?: Array<{ store: string; price: number; variant: string; model: string }> }>;
    expect(out).toHaveLength(1);
    expect(out[0].stores).toHaveLength(2); expect(out[0].best_price).toBe(4998.93);
    expect(out[0].market_variant_companions).toEqual([expect.objectContaining({ store: 'noon', price: 4499, variant: 'AMAQ', model: '75QNED93A6A' })]);
  });

  it('never touches: non-LG brands, identical variant (an identity split), unknown models, or two different models', () => {
    const a = card({ name_en: 'Asus FA608PM', brand: 'asus', stores: [entry('extra', 1)] }); const b = card({ name_en: 'Asus FA608PM-RV027W', brand: 'asus', stores: [entry('noon', 2)] });
    expect(attachMarketVariantCompanions([a, b])).toHaveLength(2);
    const x = card({ name_en: 'LG 75QNED93A6A', stores: [entry('amazon', 1)] }); const y = card({ name_en: 'LG 75QNED93A6A Black', stores: [entry('noon', 2)] });
    expect(attachMarketVariantCompanions([x, y])).toHaveLength(2);                 // same (empty) variant: not a market variant
    const p = card({ name_en: 'LG 75QNED93A6A', stores: [entry('amazon', 1)] }); const other = card({ name_en: 'LG 65QNED86A6A-AMAQ', stores: [entry('noon', 2)] });
    expect(attachMarketVariantCompanions([p, other])).toHaveLength(2);             // different model names
  });

  it('a STALE or undated companion offer is never shown (and its card is left alone)', () => {
    const primary = card({ name_en: 'LG 75QNED93A6A', tps_identity_key: 'lg|MODEL:75QNED93A6A', stores: [entry('amazon', 4998)] });
    const old = { ...entry('noon', 4499), observed_at: new Date(Date.now() - 64 * 86_400_000).toISOString() };
    const undated = { ...entry('extra', 4300), observed_at: null };
    const noon = card({ name_en: 'LG 75QNED93A6A-AMAQ', stores: [old, undated] });
    expect(attachMarketVariantCompanions([primary, noon])).toHaveLength(2);
  });

  it('a companion store already on the primary adds nothing (a store never appears twice)', () => {
    const primary = card({ name_en: 'LG 75QNED93A6A', tps_identity_key: 'lg|MODEL:75QNED93A6A', stores: [entry('noon', 4600)] });
    const noon = card({ name_en: 'LG 75QNED93A6A-AMAQ', stores: [entry('noon', 4499)] });
    expect(attachMarketVariantCompanions([primary, noon])).toHaveLength(2);
  });
});
