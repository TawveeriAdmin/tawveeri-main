// ADR-405 — agent endpoints read observations through the identity verdicts: an unconfirmed (review/reject) store is neither
// named as corroboration nor the source of the /go link; flags off ⇒ untouched.
import { dropUnconfirmedObservations } from '@/lib/identity/drop-unconfirmed-observations';
import { loadStorefrontIdentitySignals } from '@/lib/catalog/storefront-identity-gate';

jest.mock('@/lib/catalog/storefront-identity-gate', () => ({ loadStorefrontIdentitySignals: jest.fn() }));
const load = loadStorefrontIdentitySignals as jest.Mock;
const idx = (e: Record<string, 'review' | 'reject'>) => new Map(Object.entries(e));
const obs = (id: string, canonical_product_id: string, store_id: unknown) => ({ id, canonical_product_id, store_id });

beforeEach(() => { load.mockReset(); load.mockResolvedValue(new Map()); });

describe('dropUnconfirmedObservations', () => {
  const rows = [obs('o1', 'c1', '3'), obs('o2', 'c1', 'extra'), obs('o3', 'c1', 'المنع'), obs('o4', 'c2', '3')];
  it('empty verdict index: the very same array comes back', async () => {
    expect(await dropUnconfirmedObservations({}, rows)).toBe(rows);
  });
  it('no observations: no verdict lookup at all', async () => {
    expect(await dropUnconfirmedObservations({}, [])).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });
  it('drops a (canonical, store) the verifier marked, whether the store is a numeric id or a slug — and only for THAT canonical', async () => {
    load.mockResolvedValue(idx({ 'c1|3': 'reject', 'c1|extra': 'review' }));
    const kept = await dropUnconfirmedObservations({}, rows);
    expect(kept.map((o) => o.id)).toEqual(['o3', 'o4']); // c1/store 3 and c1/extra gone; c2/store 3 stays
  });
  it('matches a verdict keyed by slug when the observation carries a numeric store id', async () => {
    load.mockResolvedValue(idx({ 'c1|noon': 'review' }));
    const kept = await dropUnconfirmedObservations({}, [obs('a', 'c1', '3'), obs('b', 'c1', '4')]);
    expect(kept.map((o) => o.id)).toEqual(['b']); // store 3 resolves to the slug "noon"
  });
  it('an observation with no store identity is kept (nothing to match a verdict against)', async () => {
    load.mockResolvedValue(idx({ 'c1|3': 'reject' }));
    expect((await dropUnconfirmedObservations({}, [obs('x', 'c1', null)])).map((o) => o.id)).toEqual(['x']);
  });
  it('looks the verdicts up once, for the distinct canonicals', async () => {
    await dropUnconfirmedObservations({}, rows);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0][1].sort()).toEqual(['c1', 'c2']);
  });
});
