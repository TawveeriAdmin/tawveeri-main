// tests/identity/identity-signals.test.ts — ADR-403 identity gate: one identity truth for every surface.
import { computeIdentitySignals, loadIdentitySignals, isUnsignaled, verdictFor, EMPTY_SIGNAL_INDEX, resetIdentitySignalCache } from '../../src/lib/identity/identity-signals';
import { assembleCanonicals } from '../../scripts/tps-core/build-identity-signals';

const L = (storeId: number, title: string, model: string | null = null) => ({ storeId, title, model });
const canon = (category: string, key: string | null, listings: ReturnType<typeof L>[]) => ({ id: 'c1', key, category, listings });

const ORIGINAL = { v2: process.env.TPS_IDENTITY_V2, gate: process.env.TPS_IDENTITY_GATE };
afterEach(() => { for (const [k, v] of [['TPS_IDENTITY_V2', ORIGINAL.v2], ['TPS_IDENTITY_GATE', ORIGINAL.gate]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

describe('computeIdentitySignals (pure)', () => {
  it('a refurbished listing under a new-item key is rejected; the new listings leave no signal', () => {
    const s = computeIdentitySignals(canon('mobile', 'apple|iPhone|11|Standard|128', [
      L(2, 'Apple (Refurbished) iPhone 11 (128GB) - White'), L(4, 'Apple iPhone 11 128GB Purple'), L(5, 'ابل ايفون 11، 128 جيجا')]));
    expect(s.map((x) => [x.store_id, x.verdict])).toEqual([[2, 'reject']]);
  });

  it('a region-tagged listing is a review row, never a reject', () => {
    const s = computeIdentitySignals(canon('mobile', 'apple|iPhone|17 Pro Max|Standard|256', [
      L(2, 'Apple iPhone 17 Pro Max 256GB (International Version)'), L(4, 'Apple iPhone 17 Pro Max, 5G, 256GB, Silver')]));
    expect(s.map((x) => [x.store_id, x.verdict])).toEqual([[2, 'review']]);
  });

  it('a 1-vs-1 conflict with nothing to decide it leaves BOTH listings as review (abstain, never a coin flip)', () => {
    const s = computeIdentitySignals(canon('mobile', 'samsung|Galaxy A|A06|Standard|128', [
      L(2, 'Samsung Galaxy A06 5G, Dual SIM, 4GB RAM, 128GB'), L(4, 'Samsung Galaxy A06, 4G, 128GB, 4GB RAM')]));
    expect(s.map((x) => x.verdict)).toEqual(['review', 'review']);
  });

  it('the source-declared model codes decide where titles state none (eXtra codeless title vs Almanea code)', () => {
    const none = computeIdentitySignals(canon('washing_machine', 'samsung|front_load|21|washer', [
      L(4, 'Samsung Front Load Washer 21KG Hygiene Steam WIFI 1100 rpm Black', 'WF21T6500GV'), L(5, 'غسالة سامسونج 21 ك فتحة امامية اسود WF21T6500GV', 'WF21T6500GV')]));
    expect(none).toEqual([]);
    const oneSide = computeIdentitySignals(canon('washing_machine', 'samsung|front_load|21|washer', [
      L(4, 'Samsung Front Load Washer 21KG Hygiene Steam WIFI 1100 rpm Black'), L(5, 'غسالة سامسونج 21 ك فتحة امامية اسود WF21T6500GV', 'WF21T6500GV')]));
    expect(oneSide.map((x) => [x.store_id, x.verdict])).toEqual([[4, 'review']]);
  });

  it('the key MODEL code anchors the group: the listing whose own code contradicts it is the one that leaves', () => {
    const s = computeIdentitySignals(canon('washing_machine', 'bosch|MODEL:WGA144ZRSA', [
      L(2, 'Bosch Washing Machine WGA144ZRSA, Series 4, Front Load 9 kg'), L(3, 'Bosch Series 4 Washing Machine 9 kg WGA254ZRSA')]));
    expect(s.map((x) => [x.store_id, x.verdict])).toEqual([[3, 'reject']]);
  });

  it('fewer than two stores → nothing to verify; one listing per store (first wins)', () => {
    expect(computeIdentitySignals(canon('mobile', 'k', [L(2, 'Apple iPhone 11 (Refurbished)')]))).toEqual([]);
    expect(computeIdentitySignals(canon('mobile', 'k', [L(2, 'Apple iPhone 11 128GB'), L(2, 'Apple iPhone 11 128GB (Refurbished)')]))).toEqual([]);
  });

  it('deterministic and input-order independent', () => {
    const a = [L(2, 'Samsung Galaxy A06 5G, 4GB RAM, 128GB'), L(4, 'Samsung Galaxy A06, 4G, 128GB, 4GB RAM'), L(5, 'سامسونج جالاكسي A06 LTE 4 جيجابايت 128 جيجابايت')];
    const k = (xs: typeof a) => computeIdentitySignals(canon('mobile', 'samsung|Galaxy A|A06|Standard|128', xs)).map((x) => `${x.store_id}:${x.verdict}`).sort();
    expect(k(a)).toEqual(k([...a].reverse()));
  });
});

describe('assembleCanonicals', () => {
  it('attaches each listing to its canonical and resolves the declared model through the raw id', () => {
    const out = assembleCanonicals([{ id: 'c1', key: 'k', category: 'tv' }, { id: 'c2', key: null, category: 'tv' }],
      [{ cid: 'c1', storeId: 4, title: 'A', rawId: 10 }, { cid: 'c1', storeId: 5, title: 'B', rawId: null }, { cid: 'zz', storeId: 4, title: 'orphan', rawId: 1 }],
      new Map([[10, 'UA55DU8000UXSA']]));
    expect(out[0].listings).toEqual([{ storeId: 4, title: 'A', model: 'UA55DU8000UXSA' }, { storeId: 5, title: 'B', model: null }]);
    expect(out[1].listings).toEqual([]);
  });
});

describe('loadIdentitySignals / isUnsignaled — flag-gated readers', () => {
  beforeEach(() => resetIdentitySignalCache());
  const fakeDb = (rows: unknown[], spy: jest.Mock) => ({
    from: (t: string) => ({ select: () => ({ in: () => ({ order: () => ({ order: () => ({ range: (from: number) => { spy(t, from); return Promise.resolve({ data: from === 0 ? rows : [], error: null }); } }) }) }) }) }),
  });

  it('flags unset → empty index and NO table read (every caller is what it was)', async () => {
    delete process.env.TPS_IDENTITY_V2; delete process.env.TPS_IDENTITY_GATE;
    const spy = jest.fn();
    const idx = await loadIdentitySignals(fakeDb([], spy), [{ id: 'c1', category: 'mobile' }]);
    expect(idx).toBe(EMPTY_SIGNAL_INDEX); expect(spy).not.toHaveBeenCalled();
    expect(isUnsignaled(idx, 'c1', 4)).toBe(true);
  });

  it('gate on for mobile only → only mobile canonicals are read; verdicts addressable by store id AND slug', async () => {
    process.env.TPS_IDENTITY_GATE = 'mobile';
    const spy = jest.fn();
    const idx = await loadIdentitySignals(fakeDb([{ canonical_product_id: 'c1', store_id: 2, store_slug: 'amazon', verdict: 'reject' }], spy), [{ id: 'c1', category: 'mobile' }, { id: 'c2', category: 'tv' }]);
    expect(spy).toHaveBeenCalledWith('tps_offer_identity_signals', 0);
    expect(verdictFor(idx, 'c1', 2)).toBe('reject'); expect(verdictFor(idx, 'c1', 'amazon')).toBe('reject');
    expect(isUnsignaled(idx, 'c1', 4)).toBe(true); expect(isUnsignaled(idx, 'c2', 2)).toBe(true);
  });

  it('a read failure fails OPEN (customer surface stays up) and is loud', async () => {
    process.env.TPS_IDENTITY_GATE = '1';
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = { from: () => ({ select: () => ({ in: () => ({ order: () => ({ order: () => ({ range: () => Promise.resolve({ data: null, error: { message: 'relation does not exist' } }) }) }) }) }) }) };
    const idx = await loadIdentitySignals(broken, [{ id: 'c1', category: 'mobile' }]);
    expect(idx.size).toBe(0); expect(err).toHaveBeenCalled(); err.mockRestore();
  });
});
