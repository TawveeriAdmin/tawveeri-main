// ADR-405 — loader: flags off ⇒ no query at all; flags on ⇒ categories read, then the same signals reader every surface uses.
import { loadStorefrontIdentitySignals } from '@/lib/catalog/storefront-identity-gate';
import { loadIdentitySignals } from '@/lib/identity/identity-signals';

jest.mock('@/lib/identity/identity-signals', () => ({
  ...jest.requireActual('@/lib/identity/identity-signals'),
  loadIdentitySignals: jest.fn(),
}));
const loadIdentity = loadIdentitySignals as jest.Mock;

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; loadIdentity.mockReset(); });

function db(rows: unknown, fail = false) {
  const calls: string[] = [];
  return {
    calls,
    from: (t: string) => ({ select: () => ({ in: () => { calls.push(t); return fail ? Promise.reject(new Error('boom')) : Promise.resolve({ data: rows }); } }) }),
  };
}

describe('loadStorefrontIdentitySignals', () => {
  it('flags unset: empty index and NO database access', async () => {
    delete process.env.TPS_IDENTITY_GATE; delete process.env.TPS_IDENTITY_V2;
    const d = db([]);
    const r = await loadStorefrontIdentitySignals(d, ['c1']);
    expect(r.size).toBe(0); expect(d.calls).toEqual([]); expect(loadIdentity).not.toHaveBeenCalled();
  });
  it('no canonical ids: nothing to read', async () => {
    process.env.TPS_IDENTITY_GATE = 'tv';
    const d = db([]);
    expect((await loadStorefrontIdentitySignals(d, [])).size).toBe(0); expect(d.calls).toEqual([]);
  });
  it("gate on: reads the canonicals' categories, then delegates to the shared signals reader", async () => {
    process.env.TPS_IDENTITY_GATE = 'tv,vacuum';
    const idx = new Map([['c1|2', 'review']]); loadIdentity.mockResolvedValue(idx);
    const d = db([{ id: 'c1', category: 'tv' }]);
    expect(await loadStorefrontIdentitySignals(d, ['c1', 'c1'])).toBe(idx);
    expect(d.calls).toEqual(['canonical_products']);
    expect(loadIdentity).toHaveBeenCalledWith(d, [{ id: 'c1', category: 'tv' }]);
  });
  it('a read failure fails OPEN (empty index), loudly', async () => {
    process.env.TPS_IDENTITY_GATE = 'tv';
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await loadStorefrontIdentitySignals(db(null, true), ['c1'])).size).toBe(0);
    expect(err).toHaveBeenCalled(); err.mockRestore();
  });
});
