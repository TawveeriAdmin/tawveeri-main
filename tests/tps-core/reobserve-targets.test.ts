// tests/tps-core/reobserve-targets.test.ts — `reobserve` failed every run from 2026-10-01 to 2026-10-10 with «canceling statement due to statement timeout»:
// its target query scanned all of price_history and ran a correlated max() over normalized_product_observations. The selection now reads only the hot
// current-state table and ranks by what a fetch buys (restore a comparison > keep one alive > revive a dead group).
import { TARGET_SQL, pickTargets, CLAIM_WINDOW_HOURS, KEEP_FROM_HOURS, type ReobserveRow } from '../../scripts/tps-core/reobserve-targets';

const row = (slug: string, rank: 1 | 2 | 3, over: Partial<ReobserveRow> = {}): ReobserveRow => ({
  cid: `c-${slug}-${rank}-${Math.random()}`, slug, raw_url: `https://${slug}.example/p`, raw_name: 'x', last_observed: null, tps_identity_key: 'k', last_price: 100, rank, ...over,
});

describe('TARGET_SQL', () => {
  it('never reads history: no price_history, no normalized_product_observations, no raw_observations', () => {
    expect(TARGET_SQL).not.toMatch(/price_history|normalized_product_observations|raw_observations/i);
    expect(TARGET_SQL).toMatch(/from tps_current_offers/i);
  });
  it('binds exactly three parameters ($1 store ids, $2 claim window hours, $3 keep-from hours)', () => {
    const params = new Set((TARGET_SQL.match(/\$\d+/g) ?? []));
    expect([...params].sort()).toEqual(['$1', '$2', '$3']);
  });
  it('excludes identity-signalled, superseded and non-valid offers, and ranks restore (1) before keep (2) before revive (3)', () => {
    expect(TARGET_SQL).toMatch(/tps_offer_identity_signals/);
    expect(TARGET_SQL).toMatch(/sg\.canonical_product_id is null/);
    expect(TARGET_SQL).toMatch(/_superseded_by_identity/);
    expect(TARGET_SQL).toMatch(/co\.status = 'valid'/);
    expect(TARGET_SQL).toMatch(/order by rank,/);
  });
  it('the window constants match the claim window every surface uses', () => {
    expect(CLAIM_WINDOW_HOURS).toBe(168);
    expect(KEEP_FROM_HOURS).toBeLessThan(CLAIM_WINDOW_HOURS);
  });
});

describe('pickTargets', () => {
  it('keeps rank order, honours the total limit and the per-store cap, and skips a pair with no URL', () => {
    const rows = [row('extra', 1), row('extra', 1), row('extra', 1), row('noon', 1), row('noon', 1, { raw_url: null }), row('amazon', 2)];
    const { picked, perStore, noUrl } = pickTargets(rows, { limit: 10, perStore: 2 });
    expect(picked.map((r) => r.slug)).toEqual(['extra', 'extra', 'noon', 'amazon']);
    expect(perStore.get('extra')).toBe(2);
    expect(noUrl).toBe(1);
  });
  it('per-store overrides cap a cost-sensitive store below the default', () => {
    const rows = Array.from({ length: 6 }, () => row('noon', 1));
    expect(pickTargets(rows, { limit: 10, perStore: 5, perStoreCaps: { noon: 2 } }).picked).toHaveLength(2);
  });
  it('rank 3 (revive: two fetches for one comparison) is used only when asked for', () => {
    const rows = [row('extra', 3), row('extra', 1)];
    expect(pickTargets(rows, { limit: 10, perStore: 5 }).picked.map((r) => r.rank)).toEqual([1]);
    expect(pickTargets(rows, { limit: 10, perStore: 5, includeRank3: true }).picked.map((r) => r.rank)).toEqual([3, 1]);
  });
  it('honours onlyStores and never picks the same (canonical, store) twice', () => {
    const dup = row('extra', 1, { cid: 'same' });
    const rows = [dup, { ...dup }, row('noon', 1)];
    const { picked } = pickTargets(rows, { limit: 10, perStore: 5, onlyStores: ['extra'] });
    expect(picked).toHaveLength(1);
  });
});
