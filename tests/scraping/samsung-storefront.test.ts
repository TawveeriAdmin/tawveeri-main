import { syncSamsungStorefront } from '../../scripts/tps-core/sync-samsung-storefront';

const getObjects = jest.fn();
const saveObjects = jest.fn();
const deleteObjects = jest.fn();
jest.mock('algoliasearch', () => ({ algoliasearch: () => ({
  getObjects: (...args: unknown[]) => getObjects(...args),
  saveObjects: (...args: unknown[]) => saveObjects(...args),
  deleteObjects: (...args: unknown[]) => deleteObjects(...args),
}) }));

describe('Samsung storefront current offer synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ALGOLIA_APP_ID = 'test';
    process.env.ALGOLIA_ADMIN_KEY = 'test';
    getObjects.mockResolvedValue({ results: [] });
  });
  const row = { product_id: 'one', model: 'SM-X400NZSAMEA', next_canonical_id: 'canonical',
    next_price: '86.09', next_payload: { _availability: 'in_stock', _original_price: 119 },
    next_url: 'https://www.samsung.com/sa_en/tablets/example/', next_observed_at: '2026-09-16T08:00:00Z' };
  it('preserves exact decimal/current/list prices and does not write during rehearsal', async () => {
    const pg = { query: jest.fn().mockResolvedValue({ rows: [row], rowCount: 1 }) };
    const result = await syncSamsungStorefront(pg, false);
    expect(result.updates[0]).toMatchObject({ active: true, price: 86.09, original: 119, canonical_id: 'canonical' });
    expect(pg.query).toHaveBeenCalledTimes(1);
    expect(saveObjects).not.toHaveBeenCalled();
    expect(deleteObjects).not.toHaveBeenCalled();
  });
  it('withdraws unavailable offers while retaining their physical canonical link', async () => {
    const pg = { query: jest.fn().mockResolvedValue({ rows: [{ ...row, next_payload: { _availability: 'out_of_stock' } }], rowCount: 1 }) };
    const result = await syncSamsungStorefront(pg, false);
    expect(result.updates[0]).toMatchObject({ active: false, canonical_id: 'canonical' });
    expect(result.summary.indexRemoved).toBe(1);
  });
  it('refuses shared product IDs before touching the index or database', async () => {
    const pg = { query: jest.fn().mockResolvedValue({ rows: [{ ...row, shared: true }], rowCount: 1 }) };
    await expect(syncSamsungStorefront(pg, true)).rejects.toThrow('newly shared');
    expect(getObjects).not.toHaveBeenCalled();
    expect(pg.query).toHaveBeenCalledTimes(1);
  });
});
