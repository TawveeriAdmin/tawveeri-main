import fs from 'fs';
import path from 'path';
import { createSwrCache, createPerIdSwrCache } from '@/lib/search/swr-cache';

describe('search-latency SWR caches (2026-10-06)', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-06T00:00:00Z')); });
  afterEach(() => { jest.useRealTimers(); });

  describe('createSwrCache', () => {
    it('serves a fresh value without calling the loader again', async () => {
      const c = createSwrCache<number>({ ttlMs: 1000, staleMs: 5000, maxEntries: 5 });
      const loader = jest.fn().mockResolvedValue(1);
      expect(await c.get('k', loader)).toBe(1);
      expect(await c.get('k', loader)).toBe(1);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('shares ONE load between concurrent callers', async () => {
      const c = createSwrCache<number>({ ttlMs: 1000, staleMs: 5000, maxEntries: 5 });
      let release!: (n: number) => void;
      const loader = jest.fn(() => new Promise<number>((r) => { release = r; }));
      const a = c.get('k', loader); const b = c.get('k', loader);
      release(7);
      expect(await a).toBe(7); expect(await b).toBe(7);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('serves a stale value immediately and refreshes once in the background', async () => {
      const c = createSwrCache<number>({ ttlMs: 1000, staleMs: 5000, maxEntries: 5 });
      await c.get('k', async () => 1);
      jest.setSystemTime(Date.now() + 2000);
      const loader = jest.fn().mockResolvedValue(2);
      expect(await c.get('k', loader)).toBe(1);          // the shopper does not wait
      await Promise.resolve(); await Promise.resolve();
      expect(await c.get('k', loader)).toBe(2);          // the next one sees the refreshed copy
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('never caches a failed load; prefers a stale copy to failing; throws when there is nothing', async () => {
      const c = createSwrCache<number>({ ttlMs: 1000, staleMs: 5000, maxEntries: 5 });
      await expect(c.get('k', async () => { throw new Error('db down'); })).rejects.toThrow('db down');
      expect(c.size()).toBe(0);
      await c.get('k', async () => 1);
      jest.setSystemTime(Date.now() + 10_000);           // expired, beyond staleMs
      expect(await c.get('k', async () => { throw new Error('db down'); })).toBe(1);
    });

    it('evicts the oldest entry beyond maxEntries', async () => {
      const c = createSwrCache<number>({ ttlMs: 1000, staleMs: 5000, maxEntries: 2 });
      await c.get('a', async () => 1); jest.setSystemTime(Date.now() + 10);
      await c.get('b', async () => 2); jest.setSystemTime(Date.now() + 10);
      await c.get('c', async () => 3);
      expect(c.size()).toBe(2);
    });
  });

  describe('createPerIdSwrCache', () => {
    const fetcher = () => jest.fn(async (ids: string[]) => new Map(ids.filter((i) => i !== 'none').map((i) => [i, [`${i}-row1`, `${i}-row2`]] as [string, string[]])));

    it('fetches only missing ids, keeps request order, and remembers ids that have no rows', async () => {
      const c = createPerIdSwrCache<string>({ ttlMs: 1000, staleMs: 5000, maxEntries: 100 });
      const f = fetcher();
      expect(await c.getMany(['a', 'b'], f)).toEqual(['a-row1', 'a-row2', 'b-row1', 'b-row2']);
      expect(await c.getMany(['b', 'c', 'none'], f)).toEqual(['b-row1', 'b-row2', 'c-row1', 'c-row2']);
      expect(f.mock.calls[1][0]).toEqual(['c', 'none']);                 // only the new ids
      await c.getMany(['none'], f);
      expect(f).toHaveBeenCalledTimes(2);                                // «no rows» is a cached answer, not a miss
    });

    it('does not cache a failed fetch and surfaces the failure when there is no stale copy', async () => {
      const c = createPerIdSwrCache<string>({ ttlMs: 1000, staleMs: 5000, maxEntries: 100 });
      await expect(c.getMany(['a'], async () => { throw new Error('boom'); })).rejects.toThrow('boom');
      expect(c.size()).toBe(0);
      expect(await c.getMany(['a'], fetcher())).toEqual(['a-row1', 'a-row2']);
    });

    it('serves a stale id at once and refreshes it in the background', async () => {
      const c = createPerIdSwrCache<string>({ ttlMs: 1000, staleMs: 5000, maxEntries: 100 });
      await c.getMany(['a'], async () => new Map([['a', ['old']]]));
      jest.setSystemTime(Date.now() + 2000);
      const f = jest.fn(async () => new Map([['a', ['new']]]));
      expect(await c.getMany(['a'], f)).toEqual(['old']);
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      expect(await c.getMany(['a'], f)).toEqual(['new']);
      expect(f).toHaveBeenCalledTimes(1);
    });
  });

  describe('wiring in the search route', () => {
    const routeSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'api', 'search', 'route.ts'), 'utf8');
    it('the four hot-path reads go through the caches, and a failed read is thrown (never cached as empty)', () => {
      expect(routeSrc).toMatch(/tpsCandidatesCache\.get\(/);
      expect(routeSrc).toMatch(/priceHistoryCache\.getMany\(/);
      expect(routeSrc).toMatch(/observationsCache\.getMany\(/);
      expect(routeSrc).toMatch(/currentOffersCache\.getMany\(/);
      expect(routeSrc).toMatch(/signalTableCache\.get\('delist'/);
      expect(routeSrc).toMatch(/signalTableCache\.get\('implausible'/);
      expect(routeSrc).toMatch(/throw new Error\(`normalized_product_observations: /);
    });
    it('an exit survives the gap between the 2-minute current-offers cache and the longer observation cache (same listing URL, never store alone)', () => {
      expect(routeSrc).toMatch(/observationIdByListing\.set\(`\$\{key\}\|url\|\$\{r\.url\}`, r\.id\)/);
      expect(routeSrc).toMatch(/observationIdByListing\.get\(`\$\{canonicalId\}\|\$\{slug\}\|url\|\$\{co\.url\}`\)/);
      expect(routeSrc).toMatch(/\.select\('identity_key, store_id, raw_obs_id, price, observed_at, url, payload'\)/);
    });
    it('the current-price cache has the shortest TTL', () => {
      expect(routeSrc).toMatch(/currentOffersCache = createPerIdSwrCache<TpsCurrentOfferRow>\(\{ ttlMs: 2 \* 60_000/);
    });
    it('the warm-up reuses searchTPSCanonical and can be switched off', () => {
      expect(routeSrc).toMatch(/searchTPSCanonical\(\[' '\], createServerClient\(\), cats, null\)/);
      expect(routeSrc).toMatch(/detectCanonicalCategories\(q\)/);
      expect(routeSrc).toMatch(/SEARCH_WARM_CACHES === '0'/);
    });
  });
});
