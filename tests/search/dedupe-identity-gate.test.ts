// tests/search/dedupe-identity-gate.test.ts — canary audit 2026-10-08: the search card for samsung|MODEL:QA55Q7FAAUXSA listed Noon although the identity verifier flags
// Noon's listing (code QA55Q6FAAUXSA) `review` for that canonical, and the compare page omits it. The leak was the absorb step of deduplicateProducts: a storefront card
// enriched with the canonical's key by model code was absorbed whole. The gate is now applied there too.
import { deduplicateProducts } from '@/app/api/search/route';
import { isUnsignaled, type IdentitySignalIndex } from '@/lib/identity/identity-signals';

const entry = (store: string, price: number) => ({ store, store_name: store, current_price: price, product_url: `/go/${store}`, observed_at: new Date().toISOString(), availability: 'in_stock' });
const card = (over: Record<string, unknown>) => ({ name_ar: '', name_en: '', brand: 'samsung', category: 'tv', stores: [] as ReturnType<typeof entry>[], best_price: 0, ...over }) as never;

const KEY = 'samsung|MODEL:QA55Q7FAAUXSA';
const keeper = () => card({ tps_identity_key: KEY, product_id: 'canon-1', name_en: 'Samsung 55 Q7F', best_price: 1849, stores: [entry('amazon', 1849), entry('najm', 1882)] });
const storefront = () => card({ tps_identity_key: KEY, product_id: 'legacy-9', name_en: 'Samsung 55 Q7F (Noon + Shaker)', best_price: 1999, stores: [entry('noon', 2199), entry('shaker', 1999)] });
const signals: IdentitySignalIndex = new Map([['canon-1|noon', 'review']]);
const allow = (k: { tps_identity_key?: string | null; product_id?: string | null }, e: { store_name?: string; store?: string }) =>
  !k.tps_identity_key || !k.product_id || isUnsignaled(signals, k.product_id, e.store_name || e.store);

describe('deduplicateProducts — identity gate on the absorb step', () => {
  it('without a gate the flagged store is absorbed (the defect)', () => {
    const out = deduplicateProducts([keeper(), storefront()]) as unknown as Array<{ stores: Array<{ store: string }> }>;
    expect(out).toHaveLength(1);
    expect(out[0].stores.map((s) => s.store)).toEqual(expect.arrayContaining(['noon', 'shaker']));
  });

  it('with the gate a review/reject-flagged store of the canonical is NOT absorbed; an unflagged one still is; the duplicate card still collapses', () => {
    const out = deduplicateProducts([keeper(), storefront()], allow as never) as unknown as Array<{ stores: Array<{ store: string }>; store_count: number; _absorbed_text?: string }>;
    expect(out).toHaveLength(1);
    const stores = out[0].stores.map((s) => s.store);
    expect(stores).not.toContain('noon');
    expect(stores).toEqual(expect.arrayContaining(['amazon', 'najm', 'shaker']));
    expect(out[0].store_count).toBe(3);
    expect(out[0]._absorbed_text).toContain('Noon + Shaker');            // the duplicate's title stays searchable (relevance text only)
  });

  it('a keeper without a canonical id/key (a plain storefront card) is never gated', () => {
    const plain = card({ product_id: 'p1', name_ar: 'x', stores: [entry('amazon', 100)] });
    const dup = card({ product_id: 'p1', name_ar: 'x', stores: [entry('noon', 90)] });
    const out = deduplicateProducts([plain, dup], allow as never) as unknown as Array<{ stores: unknown[] }>;
    expect(out[0].stores).toHaveLength(2);
  });
});
