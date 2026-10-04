// src/lib/identity/identity-signals.ts — ADR-403 identity gate (2026-10-04).
// ─────────────────────────────────────────────────────────────────────────────
// ONE identity truth for every surface that groups listings.
//
// The compare page resolves a canonical's listings live (`applyIdentityVerifierGate`). Every other
// surface — the serving projection (search / category cards / Algolia / agents), live search, the
// v1 TPS search API, the UCP feed, the mobile product comparison — used to re-derive "which stores
// carry this product" on its own from price_history / normalized observations, with no way to run
// the verifier per request. Instead of re-implementing the gate in each, the hourly chain computes
// the verdicts ONCE (`scripts/tps-core/build-identity-signals.ts`, same `resolveGroup` the compare
// page calls, same inputs) and persists them as `tps_offer_identity_signals` — the same pattern
// the delist and price-implausibility signals already established. Readers apply them as an
// exclusion, and only while the category's gate flag is on.
//
// Fail-open on a READ error (missing table, outage) so a customer surface never goes dark, loudly
// (console.error) so it is seen; the producing job fails closed (it throws).
// ─────────────────────────────────────────────────────────────────────────────
import { identityGateEnabled } from '../../../scripts/tps-core/identity-flags';
import { modelCodeOfKey, resolveGroup } from '../../../scripts/tps-core/identity-verifier';
import { fetchAllPaginated } from '../database/paginated-fetch';

/** Bump when the verifier's rules change in a way that can move a verdict; rows carry it for audit. */
export const IDENTITY_RULES_VERSION = 'identity-gate-2026-10-04';

export type SignalVerdict = 'review' | 'reject';

export interface SignalListing { storeId: number; title: string; model: string | null }
export interface SignalCanonical { id: string; key: string | null; category: string; listings: SignalListing[] }
export interface IdentitySignal {
  canonical_product_id: string;
  store_id: number;
  category: string;
  verdict: SignalVerdict;
  reasons: string[];
  listing_name: string;
}

/**
 * Pure: the verdicts for ONE canonical's listings (at most one per store). A canonical with fewer
 * than two stores has nothing to verify and produces no signal; a `match` produces no row.
 * Anchor is the key's own model code only — a canonical NAME is built from whichever listing
 * founded it, so it must not decide which side of a conflict leaves.
 */
export function computeIdentitySignals(c: SignalCanonical): IdentitySignal[] {
  const byStore = new Map<number, SignalListing>();
  for (const l of c.listings) if (!byStore.has(l.storeId)) byStore.set(l.storeId, l);
  const listings = [...byStore.values()].sort((a, b) => a.storeId - b.storeId);
  if (listings.length < 2) return [];
  const res = resolveGroup(
    listings.map((l) => ({ title: l.title, label: String(l.storeId), structured: l.model ? { model: l.model } : undefined })),
    c.category, null, modelCodeOfKey(c.key),
  );
  const out: IdentitySignal[] = [];
  listings.forEach((l, i) => {
    if (res[i].outcome === 'match') return;
    out.push({ canonical_product_id: c.id, store_id: l.storeId, category: c.category, verdict: res[i].outcome as SignalVerdict, reasons: res[i].reasons, listing_name: l.title.slice(0, 300) });
  });
  return out;
}

/** (canonical, store) → verdict, addressable by numeric store id or by retailer slug. */
export type IdentitySignalIndex = Map<string, SignalVerdict>;
export const EMPTY_SIGNAL_INDEX: IdentitySignalIndex = new Map();

export function verdictFor(index: IdentitySignalIndex, canonicalId: string, store: number | string | null | undefined): SignalVerdict | null {
  if (store == null || index.size === 0) return null;
  return index.get(`${canonicalId}|${store}`) ?? null;
}

/** A listing may back a comparison / price claim only when it carries NO signal at all. */
export const isUnsignaled = (index: IdentitySignalIndex, canonicalId: string, store: number | string | null | undefined): boolean => verdictFor(index, canonicalId, store) === null;

type SignalReader = {
  from(table: string): {
    select(cols: string): {
      in(col: string, vals: string[]): {
        order(col: string): { order(col: string): { range(from: number, to: number): PromiseLike<{ data: unknown; error: { message: string } | null }> } };
      };
    };
  };
};

/**
 * Load the signals for the given canonicals — only those whose category's gate flag is on. Returns an
 * empty index (no table read at all) when no category is gated, so with the flags unset every caller
 * is byte-for-byte what it was.
 */
export async function loadIdentitySignals(db: unknown, canonicals: { id: string; category?: string | null }[]): Promise<IdentitySignalIndex> {
  const ids = [...new Set(canonicals.filter((c) => c.category && identityGateEnabled(c.category)).map((c) => c.id))];
  if (!ids.length) return EMPTY_SIGNAL_INDEX;
  const index: IdentitySignalIndex = new Map();
  try {
    const reader = db as SignalReader;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      // fetchAllPaginated: a chunk can exceed PostgREST's db-max-rows cap (ADR-172/285).
      const rows = await fetchAllPaginated<{ canonical_product_id: string; store_id: number; store_slug: string | null; verdict: SignalVerdict }>((from, to) =>
        reader.from('tps_offer_identity_signals').select('canonical_product_id, store_id, store_slug, verdict').in('canonical_product_id', chunk)
          .order('canonical_product_id').order('store_id').range(from, to) as never);
      for (const r of rows) {
        index.set(`${r.canonical_product_id}|${r.store_id}`, r.verdict);
        if (r.store_slug) index.set(`${r.canonical_product_id}|${r.store_slug}`, r.verdict);
      }
    }
  } catch (e) {
    console.error('[identity-signals] read failed — serving WITHOUT the identity gate for this request:', e instanceof Error ? e.message : e);
    return EMPTY_SIGNAL_INDEX;
  }
  return index;
}
