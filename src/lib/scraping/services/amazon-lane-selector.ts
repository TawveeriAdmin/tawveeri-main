/**
 * F-004 phase 3 — Amazon price_update selection in ASIN space, with lanes.
 *
 * WHY (measured, phase 1/2 evidence in docs/DECISIONS.md):
 *  - a price_update cycle for amazon completes ~77-84 attempts (~5.4s each, no browser) and
 *    writes ~47-50 prices, but 0 of 189 writes in the first four post-fix cycles landed on
 *    an ASIN that had a qualified click, and only 28 on a comparison-visible ASIN — the
 *    stalest-first rotation over 12,321 rows spends the budget on rows nobody sees;
 *  - 12,321 rows are only 6,273 distinct ASINs (137 ASINs carry 43% of the rows), so ~48% of
 *    writes re-fetched an ASIN priced moments earlier through a sibling row;
 *  - ~25% of attempts hit rows that have failed 7+ times in a row and have no credible write
 *    in 30 days (96% of the 1,948 such rows have not succeeded in 30+ days).
 *
 * WHAT: one attempt per ASIN per cycle (the healthiest sibling row), a fixed per-cycle quota
 * split across lanes, and a dead-letter for rows that are demonstrably dead.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO (fenced by the founder):
 *  - it never writes one price onto several sibling rows (some ASINs sit under different
 *    product_ids — an identity decision). It picks ONE row; the caller writes ONLY that row.
 *  - it does not change what `last_checked_at` means, the 300 batch, the 480s ceiling, the
 *    inter-request delay, or any other store's selection.
 *
 * FRESHNESS SIGNALS used for ordering are the last credible price write (`updated_at`) and
 * the TPS observation time — never `last_checked_at` as a freshness claim (it is stamped by
 * price_update success AND failure, discovery, and quarantine). `last_checked_at` is used
 * only for what it really is: the attempt/rotation cursor.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllPaginated } from '@/lib/database/paginated-fetch';

export type AmazonLane = 'l1' | 'l2' | 'l3' | 'tail' | 'probe';
const LANES: AmazonLane[] = ['l1', 'l2', 'l3', 'tail', 'probe'];

/** Per-cycle attempt quotas. Sum = 80, the measured per-cycle throughput (77-84) — the ceiling
 *  itself is untouched; these only decide WHO gets the attempts the ceiling already allows. */
export const AMAZON_LANE_QUOTAS: Record<AmazonLane, number> = { l1: 6, l2: 40, l3: 20, tail: 13, probe: 1 };
/** Dead-letter: consecutive failures AND no credible price write for this long. */
export const DEAD_MISSES = 7;
export const DEAD_WRITE_AGE_DAYS = 30;
/** Income-lane ASIN retirement: this many failures in a row with no credible write => stop
 *  spending lane slots on it (it becomes a probe-only ASIN until a page capture explains it). */
export const L1_RETIRE_MISSES = 3;
/** Named by the founder: first in L1, bounded by L1_RETIRE_MISSES. */
export const L1_PRIORITY_ASINS = ['B0GNJSXNC8'];
export const L1_CLICK_WINDOW_DAYS = 60;

const DAY_MS = 86_400_000;

export interface AmazonStoreRow {
  id: string;
  product_id: string;
  store_id: string | number;
  product_url: string;
  current_price: number;
  availability: string | null;
  last_checked_at: string | null;
  updated_at: string | null;
  consecutive_misses: number | null;
  scrape_status: string | null;
}

export interface AmazonTpsOffer {
  identity_key: string;
  url: string | null;
  observed_at: string | null;
}

export interface AmazonLaneInputs {
  rows: AmazonStoreRow[];
  /** Amazon's `valid` offers in tps_current_offers. */
  tpsAmazon: AmazonTpsOffer[];
  /** identity_keys that ALSO have a `valid` offer at another store (=> comparison-visible). */
  otherStoreIdentityKeys: Set<string>;
  /** ASINs with a qualified (first-party, non-test) outbound click in the click window. */
  l1Asins: Set<string>;
}

export interface AmazonLaneOptions {
  nowMs: number;
  /** A group is eligible only if none of its rows was attempted after this instant. */
  cutoffMs: number;
  /** Hard cap on the returned list (the existing 300 batch). */
  maxProducts: number;
}

export interface LaneCounters { selected: number; attempted: number; written: number; failed: number }

export interface AmazonLanePlan {
  /** Execution order. One row per ASIN. */
  rows: AmazonStoreRow[];
  laneByRowId: Map<string, { lane: AmazonLane; asin: string | null }>;
  summary: Record<string, unknown>;
}

export function asinOf(url: string | null | undefined): string | null {
  const m = (url ?? '').match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?&#]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

export const emptyLaneCounters = (): Record<AmazonLane, LaneCounters> =>
  ({ l1: zero(), l2: zero(), l3: zero(), tail: zero(), probe: zero() });
const zero = (): LaneCounters => ({ selected: 0, attempted: 0, written: 0, failed: 0 });

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};
const misses = (r: AmazonStoreRow): number => r.consecutive_misses ?? 0;

/** A credible price write within the dead-letter window (updated_at only advances on one). */
function hasRecentWrite(r: AmazonStoreRow, nowMs: number): boolean {
  const t = ms(r.updated_at);
  return t !== null && nowMs - t <= DEAD_WRITE_AGE_DAYS * DAY_MS;
}

/** Both conditions, never the counter alone: discovery zeroes consecutive_misses. */
export function isDeadRow(r: AmazonStoreRow, nowMs: number): boolean {
  return misses(r) >= DEAD_MISSES && !hasRecentWrite(r, nowMs);
}

/** Healthiest sibling first: fewest misses, then not-failed, then most recent credible write. */
function compareHealth(a: AmazonStoreRow, b: AmazonStoreRow): number {
  const dm = misses(a) - misses(b);
  if (dm !== 0) return dm;
  const fa = a.scrape_status === 'failed' ? 1 : 0;
  const fb = b.scrape_status === 'failed' ? 1 : 0;
  if (fa !== fb) return fa - fb;
  const ua = ms(a.updated_at) ?? -Infinity;
  const ub = ms(b.updated_at) ?? -Infinity;
  if (ua !== ub) return ub - ua;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

interface Group {
  key: string;
  asin: string | null;
  rows: AmazonStoreRow[];
  live: AmazonStoreRow[];
  best: AmazonStoreRow | null;
  /** most recent attempt stamp over ALL siblings (the rotation cursor, not a freshness claim) */
  lastAttemptMs: number | null;
  /** last honest price observation: TPS observed_at, else latest credible write; null = never */
  staleMs: number | null;
  lane: AmazonLane | 'graveyard' | null;
}

const nullsFirst = (a: number | null, b: number | null): number =>
  (a ?? -Infinity) === (b ?? -Infinity) ? 0 : (a ?? -Infinity) < (b ?? -Infinity) ? -1 : 1;

export function planAmazonLanes(input: AmazonLaneInputs, opts: AmazonLaneOptions): AmazonLanePlan {
  const { nowMs, cutoffMs, maxProducts } = opts;

  // ── ASIN-level facts from TPS ──────────────────────────────────────────────
  const tpsObserved = new Map<string, number>();
  const tpsAsins = new Set<string>();
  const visibleAsins = new Set<string>();
  for (const o of input.tpsAmazon) {
    const a = asinOf(o.url);
    if (!a) continue;
    tpsAsins.add(a);
    const t = ms(o.observed_at);
    if (t !== null) tpsObserved.set(a, Math.max(tpsObserved.get(a) ?? -Infinity, t));
    if (input.otherStoreIdentityKeys.has(o.identity_key)) visibleAsins.add(a);
  }

  // ── one group per ASIN (rows without a parsable ASIN stand alone) ──────────
  const byKey = new Map<string, AmazonStoreRow[]>();
  for (const r of input.rows) {
    const a = asinOf(r.product_url);
    const k = a ?? `row:${r.id}`;
    const list = byKey.get(k);
    if (list) list.push(r); else byKey.set(k, [r]);
  }

  const groups: Group[] = [];
  let deadRowsExcluded = 0;
  for (const [key, rows] of byKey) {
    const asin = key.startsWith('row:') ? null : key;
    const live = rows.filter((r) => !isDeadRow(r, nowMs));
    deadRowsExcluded += rows.length - live.length;
    const attempts = rows.map((r) => ms(r.last_checked_at)).filter((x): x is number => x !== null);
    const writes = rows.map((r) => ms(r.updated_at)).filter((x): x is number => x !== null);
    const staleFromTps = asin ? tpsObserved.get(asin) ?? null : null;
    groups.push({
      key, asin, rows, live,
      best: [...(live.length ? live : rows)].sort(compareHealth)[0] ?? null,
      lastAttemptMs: attempts.length ? Math.max(...attempts) : null,
      staleMs: staleFromTps ?? (writes.length ? Math.max(...writes) : null),
      lane: null,
    });
  }

  // ── lane assignment ────────────────────────────────────────────────────────
  let l1Retired = 0;
  for (const g of groups) {
    const inL1 = !!g.asin && input.l1Asins.has(g.asin);
    const noCredibleWrite = g.rows.every((r) => !hasRecentWrite(r, nowMs));
    const maxMisses = Math.max(...g.rows.map(misses));
    if (inL1 && maxMisses >= L1_RETIRE_MISSES && noCredibleWrite) { g.lane = 'graveyard'; l1Retired++; continue; }
    if (g.live.length === 0) { g.lane = 'graveyard'; continue; }
    g.lane = inL1 ? 'l1'
      : g.asin && visibleAsins.has(g.asin) ? 'l2'
      : g.asin && tpsAsins.has(g.asin) ? 'l3'
      : 'tail';
  }

  const eligible = (g: Group) => g.lastAttemptMs === null || g.lastAttemptMs < cutoffMs;
  const pick = (g: Group): AmazonStoreRow => (g.live.length ? [...g.live].sort(compareHealth)[0] : g.best) as AmazonStoreRow;

  // ── per-lane ordering ──────────────────────────────────────────────────────
  const byLane: Record<AmazonLane, Group[]> = { l1: [], l2: [], l3: [], tail: [], probe: [] };
  for (const g of groups) {
    if (!eligible(g)) continue;
    if (g.lane === 'graveyard') byLane.probe.push(g);
    else if (g.lane) byLane[g.lane].push(g);
  }
  const tieKey = (a: Group, b: Group) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const byStaleness = (a: Group, b: Group) => nullsFirst(a.staleMs, b.staleMs) || nullsFirst(a.lastAttemptMs, b.lastAttemptMs) || tieKey(a, b);
  const byCursor = (a: Group, b: Group) => nullsFirst(a.lastAttemptMs, b.lastAttemptMs) || tieKey(a, b);
  const priority = (g: Group) => { const i = g.asin ? L1_PRIORITY_ASINS.indexOf(g.asin) : -1; return i < 0 ? 1e9 : i; };
  byLane.l1.sort((a, b) => priority(a) - priority(b) || byStaleness(a, b));
  byLane.l2.sort(byStaleness);
  byLane.l3.sort(byStaleness);
  byLane.tail.sort(byCursor);
  byLane.probe.sort(byCursor);

  // ── allocate the quota block; unused slots flow down the lanes ──────────────
  const block = LANES.reduce((s, l) => s + AMAZON_LANE_QUOTAS[l], 0);
  const takes: Record<AmazonLane, number> = { l1: 0, l2: 0, l3: 0, tail: 0, probe: 0 };
  for (const l of LANES) takes[l] = Math.min(AMAZON_LANE_QUOTAS[l], byLane[l].length);
  let leftover = block - LANES.reduce((s, l) => s + takes[l], 0);
  for (const l of ['l2', 'l3', 'tail', 'l1'] as AmazonLane[]) {
    if (leftover <= 0) break;
    const add = Math.min(leftover, byLane[l].length - takes[l]);
    takes[l] += add;
    leftover -= add;
  }

  // ── deterministic weighted interleave (largest deficit first, lane priority on ties) ─
  const total = LANES.reduce((s, l) => s + takes[l], 0);
  const emitted: Record<AmazonLane, number> = { l1: 0, l2: 0, l3: 0, tail: 0, probe: 0 };
  const ordered: Array<{ g: Group; lane: AmazonLane }> = [];
  for (let i = 1; i <= total; i++) {
    let best: AmazonLane | null = null;
    let bestDeficit = -Infinity;
    for (const l of LANES) {
      if (emitted[l] >= takes[l]) continue;
      const deficit = (takes[l] * i) / total - emitted[l];
      if (deficit > bestDeficit + 1e-9) { bestDeficit = deficit; best = l; }
    }
    if (!best) break;
    ordered.push({ g: byLane[best][emitted[best]], lane: best });
    emitted[best]++;
  }
  // The single graveyard probe runs FIRST: a cycle that ends at 77-79 attempts would otherwise
  // never reach a slot placed last, and a probe that never runs cannot detect a recovery.
  const probeAt = ordered.findIndex((o) => o.lane === 'probe');
  if (probeAt > 0) ordered.unshift(ordered.splice(probeAt, 1)[0]);
  // overflow beyond the quota block (only used if a cycle outruns ~80 attempts)
  for (const l of ['l1', 'l2', 'l3', 'tail'] as AmazonLane[]) {
    for (let i = emitted[l]; i < byLane[l].length && ordered.length < maxProducts; i++) ordered.push({ g: byLane[l][i], lane: l });
  }
  const capped = ordered.slice(0, maxProducts);

  const rows: AmazonStoreRow[] = [];
  const laneByRowId = new Map<string, { lane: AmazonLane; asin: string | null }>();
  const counts = emptyLaneCounters();
  for (const { g, lane } of capped) {
    const row = pick(g);
    rows.push(row);
    laneByRowId.set(row.id, { lane, asin: g.asin });
    counts[lane].selected++;
  }

  const members = (l: AmazonLane) => groups.filter((g) => g.lane === l).length;
  return {
    rows,
    laneByRowId,
    summary: {
      asin_groups: groups.length,
      rows_total: input.rows.length,
      dead_rows_excluded: deadRowsExcluded,
      graveyard_asins: groups.filter((g) => g.lane === 'graveyard').length,
      l1_retired: l1Retired,
      l1_priority_present: L1_PRIORITY_ASINS.filter((a) => byLane.l1.some((g) => g.asin === a)),
      lane_members: { l1: members('l1'), l2: members('l2'), l3: members('l3'), tail: members('tail') },
      lane_eligible: { l1: byLane.l1.length, l2: byLane.l2.length, l3: byLane.l3.length, tail: byLane.tail.length, probe: byLane.probe.length },
      quota_block_taken: takes,
      selected: rows.length,
    },
  };
}

// ── loader ────────────────────────────────────────────────────────────────────
// Every "give me everything" read goes through fetchAllPaginated with a deterministic
// order (ADR-172/285: PostgREST silently truncates a bare row limit at db-max-rows=1000, and
// amazon has 12,321 rows / 1,249 valid TPS offers). Any failure THROWS so the caller falls
// back to the previous selection instead of running on a truncated or partial input.

const CLICK_STORE_NAMES = new Set(['2', 'amazon', 'amazon.sa', 'أمازون', 'أمازون السعودية']);

export async function loadAmazonLaneInputs(
  supabase: SupabaseClient,
  amazonStoreId: number,
  nowMs: number,
): Promise<AmazonLaneInputs> {
  const rows = await fetchAllPaginated<AmazonStoreRow>((from, to) =>
    supabase
      .from('product_stores')
      .select('id, product_id, store_id, product_url, current_price, availability, last_checked_at, updated_at, consecutive_misses, scrape_status')
      .eq('store_id', amazonStoreId)
      .order('id', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: AmazonStoreRow[] | null; error: { message: string } | null }>);

  const tpsAmazon = await fetchAllPaginated<AmazonTpsOffer & { category: string; store_id: number }>((from, to) =>
    supabase
      .from('tps_current_offers')
      .select('category, identity_key, store_id, url, observed_at')
      .eq('store_id', amazonStoreId)
      .eq('status', 'valid')
      .order('category', { ascending: true })
      .order('identity_key', { ascending: true })
      .order('store_id', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: (AmazonTpsOffer & { category: string; store_id: number })[] | null; error: { message: string } | null }>);

  const others = await fetchAllPaginated<{ category: string; identity_key: string; store_id: number }>((from, to) =>
    supabase
      .from('tps_current_offers')
      .select('category, identity_key, store_id')
      .neq('store_id', amazonStoreId)
      .eq('status', 'valid')
      .order('category', { ascending: true })
      .order('identity_key', { ascending: true })
      .order('store_id', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: { category: string; identity_key: string; store_id: number }[] | null; error: { message: string } | null }>);

  const interactions = await fetchAllPaginated<{ interaction_id: string }>((from, to) =>
    supabase
      .from('first_party_interactions')
      .select('interaction_id')
      .or('is_test.is.null,is_test.eq.false')
      .neq('provenance', 'internal_test')
      .order('interaction_id', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: { interaction_id: string }[] | null; error: { message: string } | null }>);
  const qualified = new Set(interactions.map((i) => i.interaction_id));

  const since = new Date(nowMs - L1_CLICK_WINDOW_DAYS * DAY_MS).toISOString();
  const clicks = await fetchAllPaginated<{ id: string; interaction_id: string | null; destination_url: string | null; store_name: string | null }>((from, to) =>
    supabase
      .from('outbound_clicks')
      .select('id, interaction_id, destination_url, store_name')
      .not('interaction_id', 'is', null)
      .or('is_test.is.null,is_test.eq.false')
      .gte('clicked_at', since)
      .order('id', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: { id: string; interaction_id: string | null; destination_url: string | null; store_name: string | null }[] | null; error: { message: string } | null }>);

  const l1Asins = new Set<string>();
  for (const c of clicks) {
    if (!c.interaction_id || !qualified.has(c.interaction_id)) continue;
    const amazon = /amazon\.sa/i.test(c.destination_url ?? '') || CLICK_STORE_NAMES.has((c.store_name ?? '').trim().toLowerCase());
    const asin = amazon ? asinOf(c.destination_url) : null;
    if (asin) l1Asins.add(asin);
  }

  return { rows, tpsAmazon, otherStoreIdentityKeys: new Set(others.map((o) => o.identity_key)), l1Asins };
}

export interface AmazonSelection extends AmazonLanePlan {
  /** the same rows, shaped for the orchestrator's price loop */
  loopRows: Array<AmazonStoreRow & { stores: { slug: string; name_ar: string; name_en: string }; consecutive_failures: null }>;
}

export async function selectAmazonLaneRows(
  supabase: SupabaseClient,
  opts: { maxProducts: number; cutoffMs: number; nowMs?: number },
): Promise<AmazonSelection> {
  const nowMs = opts.nowMs ?? Date.now();
  const { data: store, error } = await supabase
    .from('stores')
    .select('id, slug, name_ar, name_en')
    .eq('slug', 'amazon')
    .single();
  if (error || !store) throw new Error(`amazon store lookup failed: ${error?.message ?? 'not found'}`);
  const inputs = await loadAmazonLaneInputs(supabase, Number((store as { id: number }).id), nowMs);
  if (inputs.rows.length === 0) throw new Error('amazon product_stores returned zero rows — refusing to plan lanes on empty input');
  const plan = planAmazonLanes(inputs, { nowMs, cutoffMs: opts.cutoffMs, maxProducts: opts.maxProducts });
  const s = store as { slug: string; name_ar: string; name_en: string };
  return {
    ...plan,
    loopRows: plan.rows.map((r) => ({ ...r, stores: { slug: s.slug, name_ar: s.name_ar, name_en: s.name_en }, consecutive_failures: null })),
  };
}
