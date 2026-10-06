// src/lib/search/swr-cache.ts — in-process stale-while-revalidate caches for the search hot path (2026-10-06).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// MEASURED (production, 2026-10-06): a broad category search («غسالة», «tv») took 13–17 s, all of it in searchTPSCanonical's reads —
// `normalized_product_observations` alone cost ~11 s (it scans ~78k history rows for 400 canonicals; EXPLAIN: 66k buffers per request),
// plus candidates 2 s, price_history 2 s, current offers 1.4 s. The data those reads return changes at pipeline cadence (hourly), not
// per request, so the same bytes were being re-read for every shopper. This module holds them in memory with a short TTL, serves a
// slightly old copy while ONE background refresh runs, and never caches a failed read.
//
// Contract (what these caches may and may not do):
//   • fresh  (age ≤ ttl)            → served from memory
//   • stale  (ttl < age ≤ staleMax) → served from memory AND refreshed once in the background (no shopper waits)
//   • expired / missing             → loaded (concurrent callers share one load)
//   • a loader that throws is NEVER cached; stale data is preferred to nothing, nothing is preferred to a wrong zero
// Per-process only: Railway restarts clear it, a cold start pays the old cost once. No correctness claim depends on it — the data
// is the same rows the request used to read, at most `staleMax` old (minutes, against an hourly ingest).

export interface SwrOptions {
  ttlMs: number; staleMs: number; maxEntries: number;
  /** When it returns true the cache is skipped entirely (every call loads). Used by suites that mock the database per test. */
  bypass?: () => boolean;
}

interface Entry<T> { value: T; at: number }

/** One keyed value (a category's candidate list, a small signal table). */
export function createSwrCache<T>(opts: SwrOptions) {
  const store = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();

  const load = (key: string, loader: () => Promise<T>): Promise<T> => {
    const running = inflight.get(key);
    if (running) return running;
    const p = loader()
      .then((value) => {
        store.set(key, { value, at: Date.now() });
        if (store.size > opts.maxEntries) {
          const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at)[0];
          if (oldest) store.delete(oldest[0]);
        }
        return value;
      })
      .finally(() => { inflight.delete(key); });
    inflight.set(key, p);
    return p;
  };

  return {
    async get(key: string, loader: () => Promise<T>): Promise<T> {
      if (opts.bypass?.()) return loader();
      const hit = store.get(key);
      const age = hit ? Date.now() - hit.at : Infinity;
      if (hit && age <= opts.ttlMs) return hit.value;
      if (hit && age <= opts.staleMs) { void load(key, loader).catch(() => undefined); return hit.value; }
      try {
        return await load(key, loader);
      } catch (e) {
        if (hit) return hit.value;   // a stale copy beats failing the search
        throw e;
      }
    },
    clear() { store.clear(); inflight.clear(); },
    size() { return store.size; },
  };
}

/** Many ids → rows per id (price history, observations, current offers). Only the ids that are missing or expired are fetched. */
export function createPerIdSwrCache<T>(opts: SwrOptions) {
  const store = new Map<string, Entry<T[]>>();
  const inflight = new Map<string, Promise<void>>();

  const fetchInto = (ids: string[], fetchRows: (ids: string[]) => Promise<Map<string, T[]>>): Promise<void> => {
    const fresh = ids.filter((id) => !inflight.has(id));
    const shared = ids.filter((id) => inflight.has(id)).map((id) => inflight.get(id)!);
    let mine: Promise<void> | null = null;
    if (fresh.length) {
      mine = fetchRows(fresh)
        .then((rows) => {
          const at = Date.now();
          for (const id of fresh) store.set(id, { value: rows.get(id) ?? [], at });
          if (store.size > opts.maxEntries) {
            const surplus = store.size - opts.maxEntries;
            const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, surplus);
            for (const [k] of oldest) store.delete(k);
          }
        })
        .finally(() => { for (const id of fresh) inflight.delete(id); });
      for (const id of fresh) inflight.set(id, mine);
    }
    return Promise.all([...shared, ...(mine ? [mine] : [])]).then(() => undefined);
  };

  return {
    /** Rows for each requested id, concatenated in request order. `fetchRows` must return a Map keyed by id (absent id = no rows). */
    async getMany(ids: string[], fetchRows: (ids: string[]) => Promise<Map<string, T[]>>): Promise<T[]> {
      if (opts.bypass?.()) { const rows = await fetchRows(ids); return ids.flatMap((id) => rows.get(id) ?? []); }
      const now = Date.now();
      const missing: string[] = [];
      const refresh: string[] = [];
      for (const id of ids) {
        const e = store.get(id);
        const age = e ? now - e.at : Infinity;
        if (!e || age > opts.staleMs) missing.push(id);
        else if (age > opts.ttlMs) refresh.push(id);
      }
      if (refresh.length) void fetchInto(refresh, fetchRows).catch(() => undefined);
      if (missing.length) {
        try { await fetchInto(missing, fetchRows); }
        catch (e) {
          // Nothing for these ids was cached. Serve whatever (stale) copy exists; otherwise surface the failure to the caller.
          if (missing.every((id) => !store.has(id))) throw e;
        }
      }
      return ids.flatMap((id) => store.get(id)?.value ?? []);
    },
    clear() { store.clear(); inflight.clear(); },
    size() { return store.size; },
  };
}

/** Runs `fn` over `items` with at most `limit` in flight; results keep input order. */
export async function mapLimit<I, R>(items: I[], limit: number, fn: (item: I) => PromiseLike<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Splits `items` into arrays of at most `size`. */
export function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
