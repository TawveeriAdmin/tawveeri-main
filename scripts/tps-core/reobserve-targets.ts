// scripts/tps-core/reobserve-targets.ts
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// WHICH OFFERS `reobserve` SHOULD RE-FETCH — selected from the HOT current-state table, ranked by what a fetch BUYS.
//
// WHY THIS REPLACES THE OLD SELECTION (measured 2026-10-10): `reobserve` has failed every run since 2026-10-01 with
// «canceling statement due to statement timeout». Its target query scanned ALL of `price_history` (DISTINCT ON over the whole table,
// joined to canonical_products with a lower(trim()) store-name join) and then ran a correlated max() over `normalized_product_observations`
// per pair — the exact «hot path reads history» pattern ADR-252 forbids. It worked in August; the tables grew past the role's statement
// timeout. `tps_current_offers` already holds, per (identity, store), the price, the observation time, the status and the listing URL
// (100% populated), so no history is read at all.
//
// WHAT A FETCH BUYS (the commercial point). A comparison is only usable when >= 2 stores have a CURRENT eligible offer (in stock,
// observed within 168 h — the claim window every surface applies). Measured 2026-10-10 on `tps_current_offers` (valid, price > 0):
// TV has 133 comparable groups of which 65 are usable now and 49 have exactly ONE current offer + a stale sibling — refreshing that
// one stale offer restores a comparison (tablet 38, laptop 37, monitor 36, mobile 30, washer 26, audio 25, fridge 24, air-fryer 23 ...).
// So the ranking is:
//   rank 1  RESTORE  the group has >= 1 current eligible offer from ANOTHER store and this offer is stale (> 168 h) or out-of-stock-and-old
//   rank 2  KEEP     the group is already usable and this offer is in the last quarter of its window (>= 120 h) — refresh before it expires
//   rank 3  REVIVE   the group has no current eligible offer at all (two fetches for one comparison — only when the budget allows)
// Inside a group only the CHEAPEST due offer is rank 1 (one fetch restores the comparison; siblings follow in rank 2). Across groups the dearer product
// goes first (a restored comparison on a 3,000 SAR TV is worth more than on a 30 SAR kettle; the demand columns of the projection are empty), then the oldest.
//
// WHAT IS NEVER A TARGET: an offer the identity gate flags review/reject for its canonical (it cannot take part in a comparison, so a
// fetch cannot restore one); a superseded offer; a hidden retailer (lulu 23, sharafdg 24); a store with no scraper in STORE_ID.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export type TargetRank = 1 | 2 | 3;

export interface ReobserveRow {
  cid: string;
  sid?: number;
  slug: string;
  raw_url: string | null;
  raw_name: string;
  last_observed: string | null;
  tps_identity_key: string | null;
  last_price: number | null;
  rank: TargetRank;
}

/** Hours: an offer older than this no longer takes part in any comparison (evidence-engine PICK_FRESHNESS_MAX_HOURS). */
export const CLAIM_WINDOW_HOURS = 168;
/** Hours: a still-eligible offer this old is refreshed before it drops out of the window. */
export const KEEP_FROM_HOURS = 120;

/**
 * One cheap statement. `$1` = int[] of store ids that have a scraper, `$2` = claim window hours, `$3` = keep-from hours.
 * Reads only tps_current_offers, canonical_products (unique index on tps_identity_key) and the small tps_offer_identity_signals table.
 */
export const TARGET_SQL = `
with o as (
  select co.identity_key, co.store_id::int as sid, co.price::numeric as price, co.observed_at, co.url, co.name,
         cp.id as cid,
         (coalesce(co.payload->>'_availability','') = 'out_of_stock') as oos
    from tps_current_offers co
    join canonical_products cp on cp.tps_identity_key = co.identity_key and cp.is_active
    left join tps_offer_identity_signals sg on sg.canonical_product_id = cp.id and sg.store_id = co.store_id::int
   where co.status = 'valid'
     and co.price is not null and co.price > 0
     and co.store_id = any($1::int[])
     and co.payload->>'_superseded_by_identity' is null
     and sg.canonical_product_id is null
), f as (
  select o.*,
         (not oos and observed_at > now() - ($2::int * interval '1 hour')) as fresh,
         extract(epoch from (now() - observed_at)) / 3600.0 as age_h
    from o
), d as (
  -- DUE = worth a fetch now: past the claim window, or out of stock and not looked at for a day (an out-of-stock offer seen this morning is not re-fetched every run).
  select f.*, (age_h > $2::int or (oos and age_h >= 24)) as due,
         -- the CHEAPEST due offer of a group is the one worth fetching first (one fetch restores the comparison); its siblings come after
         row_number() over (partition by identity_key order by (case when (age_h > $2::int or (oos and age_h >= 24)) then 0 else 1 end), price asc) as rn_due
    from f
), g as (
  select identity_key,
         count(distinct sid) as stores,
         count(distinct sid) filter (where fresh) as fresh_stores
    from d group by identity_key
)
select d.cid, d.sid, d.url as raw_url, coalesce(d.name,'') as raw_name, d.observed_at::text as last_observed,
       d.identity_key as tps_identity_key, d.price::float8 as last_price,
       case
         when d.due and g.fresh_stores >= 1 and d.rn_due = 1 then 1
         when d.due and g.fresh_stores >= 1 then 2
         when d.fresh and g.fresh_stores >= 2 and d.age_h >= $3::int then 2
         when d.due and g.fresh_stores = 0 then 3
       end as rank
  from d join g on g.identity_key = d.identity_key
 where g.stores >= 2
   and (
         (d.due and g.fresh_stores >= 1)
      or (d.fresh and g.fresh_stores >= 2 and d.age_h >= $3::int)
      or (d.due and g.fresh_stores = 0)
       )
 order by rank, d.price desc, d.observed_at asc nulls first`;

export interface PickOptions {
  limit: number;
  /** Default per-store cap (throttle safety). */
  perStore: number;
  /** Per-store overrides (e.g. a cost-sensitive store). */
  perStoreCaps?: Record<string, number>;
  onlyStores?: string[] | null;
  /** Rank 3 needs two fetches per comparison: only used to fill what ranks 1–2 left. */
  includeRank3?: boolean;
}

/** Pure: bound the run. Targets arrive already ranked; a pair with no recoverable URL cannot be re-fetched. */
export function pickTargets<T extends ReobserveRow>(rows: T[], opts: PickOptions): { picked: T[]; perStore: Map<string, number>; noUrl: number } {
  const perStore = new Map<string, number>();
  const picked: T[] = [];
  const seen = new Set<string>();
  for (const t of rows) {
    if (opts.onlyStores && !opts.onlyStores.includes(t.slug)) continue;
    if (!t.raw_url) continue;
    if (t.rank === 3 && !opts.includeRank3) continue;
    const key = `${t.cid}|${t.slug}`;
    if (seen.has(key)) continue;
    const cap = opts.perStoreCaps?.[t.slug] ?? opts.perStore;
    const c = perStore.get(t.slug) ?? 0;
    if (c >= cap) continue;
    seen.add(key);
    perStore.set(t.slug, c + 1);
    picked.push(t);
    if (picked.length >= opts.limit) break;
  }
  return { picked, perStore, noUrl: rows.filter((t) => !t.raw_url).length };
}
