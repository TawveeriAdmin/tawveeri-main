/**
 * Pure merge logic for the INCREMENTAL listing-facts sync (ADR-392).
 *
 * `tps_listing_price_facts` used to be rebuilt from the FULL `raw_observations`
 * history every hour (cursor reset to 0 on every run). This module lets the
 * builder fold ONLY the observations newer than a persisted watermark into the
 * facts rows that already exist, with the same deterministic verdict as before.
 *
 * Invariants:
 *  - observed_min / observed_max / claimed_was / first_seen are monotone
 *    (min/max/greatest/least), so re-applying the same batch is a no-op;
 *  - current_price / name / url follow the latest observation that carried a price;
 *  - distinct_days is exact: a day is new when it is later than the previous
 *    last_seen day, or when it is not in the tracked `observed_days` set.
 *    Rows written before `observed_days` existed have no set; for them only
 *    days strictly after `last_seen` can be counted — a same-day re-observation
 *    was already counted by the full build that wrote the row.
 *
 * No I/O here — the builder owns the SQL, tests cover the arithmetic.
 */
import { discountVerdictFromFacts, type DiscountIntegrity } from "./price-intelligence";

/** One row of tps_listing_price_facts as the builder reads it back. */
export interface ListingFactsRow {
  listing_key: string;
  store_id: number;
  url: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  current_price: number;
  observed_min: number;
  observed_max: number;
  claimed_was: number | null;
  distinct_days: number;
  first_seen: Date;
  last_seen: Date;
  /** ISO days (YYYY-MM-DD) already counted, or null for rows written before ADR-392. */
  observed_days: string[] | null;
}

/** One raw observation, already projected to the few columns the facts need. */
export interface ListingObservation {
  id: number;
  listing: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  price: number | null;
  was: number | null;
  at: Date;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Aggregate a batch of NEW observations for ONE listing into a fresh partial row. */
export function aggregateObservations(
  listingKey: string,
  storeId: number,
  obs: ListingObservation[],
): ListingFactsRow | null {
  let row: ListingFactsRow | null = null;
  for (const o of obs) {
    if (!row) {
      row = {
        listing_key: listingKey, store_id: storeId, url: o.listing, name: o.name, brand: o.brand,
        category: o.category, current_price: NaN, observed_min: Infinity, observed_max: -Infinity,
        claimed_was: null, distinct_days: 0, first_seen: o.at, last_seen: o.at, observed_days: [],
      };
    }
    row = mergeObservation(row, o);
  }
  return row;
}

/** Fold one observation into a row (new or existing). Pure; returns a new object. */
export function mergeObservation(row: ListingFactsRow, o: ListingObservation): ListingFactsRow {
  const day = isoDay(o.at);
  // Legacy rows (written before the day set existed) start their set seeded with the
  // last counted day, so a same-day re-observation is never counted twice and any
  // later day is counted exactly once.
  const days = row.observed_days ? [...row.observed_days] : (row.distinct_days > 0 ? [isoDay(row.last_seen)] : []);
  let distinct = row.distinct_days;
  if (!days.includes(day)) { days.push(day); distinct += 1; }
  const out: ListingFactsRow = {
    ...row,
    observed_days: days,
    distinct_days: distinct,
    first_seen: o.at < row.first_seen ? o.at : row.first_seen,
    last_seen: o.at > row.last_seen ? o.at : row.last_seen,
  };
  if (o.price != null && Number.isFinite(o.price)) {
    out.observed_min = Math.min(row.observed_min, o.price);
    out.observed_max = Math.max(row.observed_max, o.price);
    // The latest observation WITH a price wins the displayed current price.
    if (o.at >= row.last_seen || !Number.isFinite(row.current_price)) {
      out.current_price = o.price;
      out.name = o.name ?? row.name;
      out.brand = o.brand ?? row.brand;
      out.category = o.category ?? row.category;
      out.url = o.listing;
    }
  }
  if (o.was != null && Number.isFinite(o.was) && (out.claimed_was == null || o.was > out.claimed_was)) {
    out.claimed_was = o.was;
  }
  return out;
}

/** Merge a batch aggregate into the row already stored (or return the batch when none). */
export function mergeIntoExisting(existing: ListingFactsRow | null, batch: ListingFactsRow): ListingFactsRow {
  if (!existing) return batch;
  // Replay the batch's evidence onto the stored row. The batch already has a
  // per-observation history folded in, so replay it as its synthetic observations:
  // min/max/was/first/last are monotone and days are a set, so this is exact.
  const seeded = existing.observed_days
    ? [...existing.observed_days]
    : (existing.distinct_days > 0 ? [isoDay(existing.last_seen)] : []);
  let row: ListingFactsRow = { ...existing, observed_days: seeded };
  for (const d of batch.observed_days ?? []) {
    if (!seeded.includes(d)) { seeded.push(d); row.distinct_days += 1; }
  }
  row = {
    ...row,
    observed_min: Math.min(existing.observed_min, batch.observed_min),
    observed_max: Math.max(existing.observed_max, batch.observed_max),
    claimed_was: batch.claimed_was == null ? existing.claimed_was
      : existing.claimed_was == null ? batch.claimed_was : Math.max(existing.claimed_was, batch.claimed_was),
    first_seen: batch.first_seen < existing.first_seen ? batch.first_seen : existing.first_seen,
    last_seen: batch.last_seen > existing.last_seen ? batch.last_seen : existing.last_seen,
  };
  if (Number.isFinite(batch.current_price) && (batch.last_seen >= existing.last_seen || !Number.isFinite(existing.current_price))) {
    row.current_price = batch.current_price;
    row.name = batch.name ?? existing.name;
    row.brand = batch.brand ?? existing.brand;
    row.category = batch.category ?? existing.category;
    row.url = batch.url;
  }
  return row;
}

/** Verdict for a merged row; null when the row still has no observed price. */
export function verdictFor(row: ListingFactsRow): DiscountIntegrity | null {
  if (!Number.isFinite(row.current_price) || !Number.isFinite(row.observed_max)) return null;
  return discountVerdictFromFacts({
    distinctDays: row.distinct_days, current: row.current_price,
    observedMin: row.observed_min, observedMax: row.observed_max, claimedWas: row.claimed_was,
  });
}
