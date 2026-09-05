// Founder Commerce Command Center — data layer (ADR-213).
// Reuses the exact funnel/KPI definitions already validated in scripts/tps-analysis/usage-report.ts
// (npm run tps:usage), just with period filtering added, computed live for /admin/command-center.
// REAL-only for every headline number; TEST volume always computed alongside, never blended in.
// Metric definitions: docs/METRIC_DEFINITIONS.md. Data-quality rules: docs/DATA_QUALITY_CONTRACT.md.
import { createServerClient, fetchAllPaginated } from '@/lib/database';
import { getAffiliateConfig } from '@/lib/transactions/affiliate-config';
import { parseShoppingTask } from '@/lib/agent/task-parser';
import { getDecisionGradeOutboundStats } from './decision-grade-queries';

export type Period = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

// Saudi Arabia does not observe DST — a fixed UTC+3 offset is correct year-round.
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

// ADR-216 — Founder Commercial Intelligence: the official commercial baseline. Traffic before
// this instant is founder/family/Cowork/controlled-verification activity, not representative
// customer behavior (founder-confirmed). Historical rows are NEVER deleted or reclassified —
// this only changes what the DEFAULT founder view includes. An explicit `includeHistorical`
// flag on getCommandCenterData() surfaces everything, clearly labeled, for anyone who wants it.
export const COMMERCIAL_BASELINE = new Date('2026-08-06T00:00:00+03:00');

function riyadhMidnightUtc(daysAgo: number): Date {
  const riyadhNow = new Date(Date.now() + RIYADH_OFFSET_MS);
  riyadhNow.setUTCHours(0, 0, 0, 0);
  riyadhNow.setUTCDate(riyadhNow.getUTCDate() - daysAgo);
  return new Date(riyadhNow.getTime() - RIYADH_OFFSET_MS);
}

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export function resolvePeriod(period: Period, customStart?: string, customEnd?: string): DateRange {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: riyadhMidnightUtc(0), end: now, label: 'today' };
    case 'yesterday':
      return { start: riyadhMidnightUtc(1), end: riyadhMidnightUtc(0), label: 'yesterday' };
    case '7d':
      return { start: new Date(now.getTime() - 7 * 86_400_000), end: now, label: '7d' };
    case 'custom': {
      const start = customStart ? new Date(`${customStart}T00:00:00+03:00`) : new Date(now.getTime() - 30 * 86_400_000);
      const end = customEnd ? new Date(`${customEnd}T23:59:59+03:00`) : now;
      return { start, end, label: 'custom' };
    }
    case '30d':
    default:
      return { start: new Date(now.getTime() - 30 * 86_400_000), end: now, label: '30d' };
  }
}

export function previousRange({ start, end }: DateRange): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - durationMs), end: start };
}

export interface UsageEventRow {
  event_type: string;
  session_id: string | null;
  is_test: boolean;
  source: string | null;
  category: string | null;
  query_text: string | null;
  canonical_id: string | null;
  created_at: string;
  meta: Record<string, unknown> | null;
}

export interface OutboundClickRow {
  is_test: boolean;
  canonical_product_id: string | null;
  affiliate_program: string | null;
  store_name: string | null;
  clicked_at: string;
  // ADR-244: /go now stamps session + campaign (tw_sid / tw_campaign cookies) and the
  // storefront-offer linkage directly onto the ledger row. NULL on rows written before
  // the cutover — historical rows stay UNKNOWN, never backfilled or guessed. Optional
  // because pre-cutover fixtures/rows legitimately lack them.
  session_id?: string | null;
  campaign?: Record<string, unknown> | null;
  source?: string | null;
}

const EVENT_COLUMNS = 'event_type, session_id, is_test, source, category, query_text, canonical_id, created_at, meta';
// outbound_clicks predates the numbered-migration schema files and isn't declared anywhere in the
// repo — confirmed via read-only information_schema introspection: its timestamp column is
// `clicked_at`, not `created_at`. Verify against production before assuming a column name here.
const OUTBOUND_COLUMNS = 'is_test, canonical_product_id, affiliate_program, store_name, clicked_at, session_id, campaign, source';

// ADR-285: a bare `.limit()` here silently truncated at PostgREST's db-max-rows=1000 the
// moment real volume passed it — measured on production, "confirmed retailer redirects"
// read 1000 against a real 3,102+ for the founder's reported window. Paginate explicitly via
// `fetchAllPaginated()` (ADR-172's fix, generalized) so a query never quietly returns fewer
// rows than actually match. `maxRows` is a generous safety ceiling, not the operative limit —
// pagination is what prevents truncation now, not this number.
const SAFETY_MAX_ROWS = 100_000;

// usage_events/outbound_clicks are added via raw migration SQL and aren't in the generated
// Database types (same reason src/app/go/[offerId]/route.ts and src/app/api/events/route.ts
// don't type them) — cast at the call site rather than widening the shared client type.
export async function fetchUsageEvents(start: Date, end: Date): Promise<UsageEventRow[]> {
  const supabase = createServerClient() as unknown as { from: (table: string) => any };
  return fetchAllPaginated<UsageEventRow>(
    (from, to) =>
      supabase
        .from('usage_events')
        .select(EVENT_COLUMNS)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('id', { ascending: true })
        .range(from, to),
    { maxRows: SAFETY_MAX_ROWS }
  );
}

export async function fetchOutboundClicks(start: Date, end: Date): Promise<OutboundClickRow[]> {
  const supabase = createServerClient() as unknown as { from: (table: string) => any };
  return fetchAllPaginated<OutboundClickRow>(
    (from, to) =>
      supabase
        .from('outbound_clicks')
        .select(OUTBOUND_COLUMNS)
        .gte('clicked_at', start.toISOString())
        .lt('clicked_at', end.toISOString())
        .order('id', { ascending: true })
        .range(from, to),
    { maxRows: SAFETY_MAX_ROWS }
  );
}

export interface Funnel {
  search: number;
  results: number;
  productView: number;
  comparisonView: number;
  evidenceView: number;
  outbound: number;
  noAnswer: number;
  errors: number;
  sessions: number;
}

const SEARCH_TYPES = new Set(['search', 'advisor_query']);
const RESULTS_TYPES = new Set(['results', 'advisor_result']);
const CLUSTERED_TYPES = new Set(['search', 'advisor_query', 'results', 'advisor_result', 'no_answer', 'error']);

// ADR-214: the unified /search page fires BOTH a storefront `search` event AND, when the query
// routes to the advisor (routeQuery in search-client.tsx), an `advisor_query` event for the SAME
// user action — two synchronous, un-awaited track() calls in the same function, not two searches.
// Same pattern on the results side (`results`/`advisor_result`/`no_answer`/`error`). Verified in
// production (read-only, 2026-08-05): 147/314 real `search` events and 30/161 real `results` events
// are such same-action echoes of each other, stable across 1-60s correlation windows tested — not a
// timing coincidence. This clusters same-(session,query_text) events within ACTION_WINDOW_MS into one
// action so the funnel counts INTENT once, not per event row. A later, genuinely new search for the
// same text (gap > the window) still counts as its own action.
const ACTION_WINDOW_MS = 3_000;

/**
 * ANSWERED-ELSEWHERE WINDOW (ADR-260) — see `wasAnsweredElsewhere` below for the full
 * finding. Short version: `no_answer` means "the storefront grid returned nothing", but
 * the unified surface also runs the advisor for the same action, and for need-shaped
 * sentences the advisor is what answers. 77 of 127 REAL no_answer events on production
 * were contradicted by a `results`/`advisor_result` for the same session+query seconds
 * later. Chosen from the measured gap distribution (69 ≤3s, 77 ≤10s, then a day-scale tail
 * of unrelated repeat visits) — wider than ACTION_WINDOW_MS because the advisor is a slower
 * asynchronous call, not the synchronous double-fire that window exists to collapse.
 */
const ANSWERED_ELSEWHERE_WINDOW_MS = 10_000;

interface DedupedCounts { search: number; results: number; noAnswer: number; errors: number }

function dedupeFunnelActions(events: UsageEventRow[]): DedupedCounts {
  const groups = new Map<string, Array<{ ts: number; type: string }>>();
  for (const e of events) {
    if (!CLUSTERED_TYPES.has(e.event_type) || !e.session_id) continue;
    const key = `${e.session_id}|${e.query_text ?? ''}`;
    const arr = groups.get(key);
    const entry = { ts: new Date(e.created_at).getTime(), type: e.event_type };
    if (arr) arr.push(entry); else groups.set(key, [entry]);
  }

  let search = 0, results = 0, noAnswer = 0, errors = 0;
  for (const arr of groups.values()) {
    arr.sort((a, b) => a.ts - b.ts);
    let clusterStart = 0;
    for (let i = 1; i <= arr.length; i++) {
      const atBoundary = i === arr.length || arr[i].ts - arr[clusterStart].ts > ACTION_WINDOW_MS;
      if (!atBoundary) continue;
      const cluster = arr.slice(clusterStart, i);
      const hasSearch = cluster.some((x) => SEARCH_TYPES.has(x.type));
      const hasResults = cluster.some((x) => RESULTS_TYPES.has(x.type));
      // ADR-260: the advisor can answer AFTER this 3s cluster closes (measured: 69 of 77
      // same-action answers land ≤3s, the remaining 8 between 3s and 10s). Those 8 were
      // counted as dead ends although the shopper saw results. Look for the contradicting
      // answer across cluster boundaries, in the same group (session+query), before calling
      // any action a no-answer. Search/results counting is untouched — only this verdict.
      const hasNoAnswer = cluster.some(
        (x) =>
          x.type === 'no_answer' &&
          !arr.some((y) => RESULTS_TYPES.has(y.type) && Math.abs(y.ts - x.ts) <= ANSWERED_ELSEWHERE_WINDOW_MS),
      );
      const hasError = cluster.some((x) => x.type === 'error');
      if (hasSearch) search++;
      if (hasResults) results++;
      else if (hasNoAnswer) noAnswer++; // only a dead end if the action never reached results
      if (hasError) errors++; // off-funnel signal, tracked once per action regardless of clustering
      clusterStart = i;
    }
  }
  return { search, results, noAnswer, errors };
}

// ADR-244: funnel step 6 (Outbound) reads the EXIT LEDGER when its rows are provided —
// measured 2026-08-13: 282 REAL /go exits since the commercial baseline against ONE
// go_click client event, because most exits are plain <a> navigations from surfaces
// that never fired the client event. The ledger row is written server-side on every
// /go redirect and cannot be lost to an ad-blocker or a dropped keepalive fetch.
// Without outbound rows (legacy caller), the old go_click count is used and labeled
// accordingly by the metric dictionary.
export function buildFunnel(events: UsageEventRow[], outboundRows?: OutboundClickRow[]): Funnel {
  const sessions = new Set<string>();
  let productView = 0, comparisonView = 0, evidenceView = 0, goClicks = 0;
  for (const e of events) {
    if (e.session_id) sessions.add(e.session_id);
    if (e.event_type === 'product_view') productView++;
    else if (e.event_type === 'comparison_view') comparisonView++;
    else if (e.event_type === 'evidence_view') evidenceView++;
    else if (e.event_type === 'go_click') goClicks++;
  }
  const outbound = outboundRows ? outboundRows.length : goClicks;
  const { search, results, noAnswer, errors } = dedupeFunnelActions(events);
  return { search, results, productView, comparisonView, evidenceView, outbound, noAnswer, errors, sessions: sessions.size };
}

/**
 * SESSION-LEVEL FUNNEL — the only correct basis for a conversion RATE (ADR-259).
 *
 * THE DEFECT THIS REPLACES (measured 2026-08-18): the launch-readiness gate reported
 * "Comparison → Exit (CTR) 2003.6% PASS". A bounded conversion rate cannot exceed 100%,
 * and this one did because the ratio mixed three different units at once:
 *   numerator   `outbound` = rows in the outbound_clicks TABLE (a different dataset,
 *                            all-time, 561 rows)
 *   denominator `comparisonView` = raw comparison_view EVENT rows from usage_events
 * Two tables, two time scopes, one meaningless percentage — which then read as PASS on a
 * gate the founder was using to decide whether to send real users.
 *
 * A conversion rate answers "of the people who reached stage A, how many went on to B".
 * That requires the numerator to be a SUBSET of the denominator, so both must be counted
 * in the same unit (sessions) over the same window, and B must be counted only inside
 * sessions that reached A. Then 100% is a ceiling by construction, not by luck.
 *
 * Event COUNTS remain available on `Funnel` and are still worth reporting — they are
 * volume, not conversion. The rule is only that a count never becomes a rate's numerator
 * over a different unit's denominator.
 *
 * `search` and `results` reuse the same action-clustering the event funnel uses (an
 * `advisor_query` echo of a `search` is one intent), applied per session.
 */
export interface SessionFunnel {
  /** Sessions that produced any event at all in the window. */
  sessions: number;
  /** Sessions reaching each stage at least once. Each is a session COUNT, never events. */
  searched: number;
  gotResults: number;
  viewedProduct: number;
  viewedComparison: number;
  viewedEvidence: number;
  exited: number;
  /** Sessions where a search action ended without results (dead ends). */
  noAnswer: number;
  /** Stage intersections — the numerators a conversion rate is allowed to use. */
  searchedAndGotResults: number;
  searchedAndViewedProduct: number;
  viewedProductAndComparison: number;
  viewedComparisonAndExited: number;
  searchedAndExited: number;
}

const PRODUCT_VIEW_TYPES = new Set(['product_view']);
const COMPARISON_TYPES = new Set(['comparison_view']);
const EVIDENCE_TYPES = new Set(['evidence_view']);
const EXIT_TYPES = new Set(['go_click']);

/**
 * Build the session-level funnel. `go_click` is the exit signal here — deliberately, and
 * not the outbound_clicks table: only the usage_events stream carries a session_id, and
 * a rate needs both sides counted per session. The outbound_clicks ledger stays the
 * authority for exit VOLUME and affiliate attribution (it is the richer record); the two
 * answer different questions and must not be divided by each other.
 */
export function buildSessionFunnel(events: UsageEventRow[]): SessionFunnel {
  type Stages = {
    searched: boolean; gotResults: boolean; noAnswer: boolean;
    product: boolean; comparison: boolean; evidence: boolean; exited: boolean;
  };
  const bySession = new Map<string, Stages>();
  const get = (id: string): Stages => {
    let s = bySession.get(id);
    if (!s) {
      s = { searched: false, gotResults: false, noAnswer: false, product: false, comparison: false, evidence: false, exited: false };
      bySession.set(id, s);
    }
    return s;
  };

  for (const e of events) {
    if (!e.session_id) continue;
    const s = get(e.session_id);
    if (SEARCH_TYPES.has(e.event_type)) s.searched = true;
    else if (RESULTS_TYPES.has(e.event_type)) s.gotResults = true;
    else if (e.event_type === 'no_answer') s.noAnswer = true;
    else if (PRODUCT_VIEW_TYPES.has(e.event_type)) s.product = true;
    else if (COMPARISON_TYPES.has(e.event_type)) s.comparison = true;
    else if (EVIDENCE_TYPES.has(e.event_type)) s.evidence = true;
    else if (EXIT_TYPES.has(e.event_type)) s.exited = true;
  }

  const f: SessionFunnel = {
    sessions: bySession.size,
    searched: 0, gotResults: 0, viewedProduct: 0, viewedComparison: 0, viewedEvidence: 0,
    exited: 0, noAnswer: 0,
    searchedAndGotResults: 0, searchedAndViewedProduct: 0, viewedProductAndComparison: 0,
    viewedComparisonAndExited: 0, searchedAndExited: 0,
  };

  for (const s of bySession.values()) {
    if (s.searched) f.searched++;
    if (s.gotResults) f.gotResults++;
    if (s.product) f.viewedProduct++;
    if (s.comparison) f.viewedComparison++;
    if (s.evidence) f.viewedEvidence++;
    if (s.exited) f.exited++;
    // A session is a dead end only if it searched and NEVER reached results — the same
    // "only a dead end if the action never reached results" rule the event funnel uses.
    if (s.searched && s.noAnswer && !s.gotResults) f.noAnswer++;
    if (s.searched && s.gotResults) f.searchedAndGotResults++;
    if (s.searched && s.product) f.searchedAndViewedProduct++;
    if (s.product && s.comparison) f.viewedProductAndComparison++;
    if (s.comparison && s.exited) f.viewedComparisonAndExited++;
    if (s.searched && s.exited) f.searchedAndExited++;
  }
  return f;
}

/** Safe ratio for session-level rates. Returns 0 on an empty denominator, never NaN. */
export function sessionRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

// Transparency signal (Data Quality Contract Rule 7/8): what share of REAL search actions came
// from the single most active session. High concentration means aggregate rates are dominated by
// one actor (heavy genuine user OR unflagged internal/founder browsing) — we don't guess which;
// we surface it so the founder can judge, rather than silently excluding or silently averaging it away.
export function topSessionSearchShare(events: UsageEventRow[]): { share: number; sessionEventCount: number; totalSearchEvents: number } {
  const perSession = new Map<string, number>();
  let total = 0;
  for (const e of events) {
    if (e.event_type !== 'search' && e.event_type !== 'advisor_query') continue;
    if (!e.session_id) continue;
    total++;
    perSession.set(e.session_id, (perSession.get(e.session_id) || 0) + 1);
  }
  let max = 0;
  for (const n of perSession.values()) max = Math.max(max, n);
  return { share: total > 0 ? max / total : 0, sessionEventCount: max, totalSearchEvents: total };
}

// ── Campaign-to-outbound attribution (ADR-214) ──────────────────────────────────────────────
// Closes the gap ADR-207 deliberately left open, WITHOUT touching /go, the Amazon tag/ascsubtag/
// ASIN path, any non-Amazon retailer, or any link-generation call site: the client's track()
// helper (src/lib/analytics/track.ts) already merges the session's captured UTM (sessionStorage,
// src/lib/analytics/campaign.ts) into EVERY event's `meta`, including `go_click` — the gap was
// never missing instrumentation, it was a missing READ-side correlation between that `go_click`
// usage_event and the corresponding `outbound_clicks` row (which carries the retailer/tag detail
// but no UTM). This is a pure, additive, read-only join over existing immutable data.
//
// Session-level only — never claims person-level attribution. Rows with no captured UTM resolve
// to UNKNOWN, never "direct" and never folded into zero (Data Quality Contract Rule 1/4).
const ATTRIBUTION_MATCH_WINDOW_MS = 10_000;

export interface CampaignAttributionRow {
  sessionId: string;
  clickedAt: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  matchedOutboundClick: boolean;
  storeName: string | null;
  affiliateProgram: string | null;
  isTest: boolean;
}

export interface CampaignAttributionSummary {
  totalGoClicks: number;
  withKnownCampaign: number;
  unknownCampaign: number;
  matchedToOutboundClicks: number;
  bySource: Array<{ source: string; count: number }>;
  rows: CampaignAttributionRow[];
}

export function computeCampaignAttribution(
  goClickEvents: UsageEventRow[],
  outboundRows: OutboundClickRow[]
): CampaignAttributionSummary {
  // ADR-244 — primary path: ledger rows that carry their own campaign (stamped by /go
  // from the tw_campaign cookie). CONFIRMED attribution, no window-join needed.
  const directRows: CampaignAttributionRow[] = outboundRows
    .filter((o) => o.session_id || o.campaign)
    .map((o) => {
      const c = (o.campaign ?? {}) as Record<string, unknown>;
      const pick = (k: string) => (typeof c[k] === 'string' ? (c[k] as string) : null);
      return {
        sessionId: o.session_id || '',
        clickedAt: o.clicked_at,
        utmSource: pick('utm_source'),
        utmMedium: pick('utm_medium'),
        utmCampaign: pick('utm_campaign'),
        utmContent: pick('utm_content'),
        matchedOutboundClick: true,
        storeName: o.store_name,
        affiliateProgram: o.affiliate_program,
        isTest: o.is_test,
      };
    });
  const directCovered = new Set(directRows.map((r) => `${r.sessionId}|${r.clickedAt}`));

  // Legacy fallback for pre-cutover rows and client-only exits: the ADR-214
  // nearest-timestamp join between go_click events and un-stamped ledger rows.
  const unstampedOutbound = outboundRows.filter((o) => !o.session_id && !o.campaign);
  const legacyRows: CampaignAttributionRow[] = goClickEvents.map((e) => {
    const meta = e.meta ?? {};
    const utmSource = typeof meta.utm_source === 'string' ? meta.utm_source : null;
    const clickTs = new Date(e.created_at).getTime();

    // Nearest-timestamp match on canonical_product_id, same is_test state, within the
    // window — against UN-STAMPED ledger rows only (stamped ones are already covered by
    // the direct path above).
    let best: OutboundClickRow | null = null;
    let bestDelta = Infinity;
    for (const o of unstampedOutbound) {
      if (o.is_test !== e.is_test) continue;
      if (!e.canonical_id || o.canonical_product_id !== e.canonical_id) continue;
      const delta = Math.abs(new Date(o.clicked_at).getTime() - clickTs);
      if (delta <= ATTRIBUTION_MATCH_WINDOW_MS && delta < bestDelta) { best = o; bestDelta = delta; }
    }

    return {
      sessionId: e.session_id || '',
      clickedAt: e.created_at,
      utmSource,
      utmMedium: typeof meta.utm_medium === 'string' ? meta.utm_medium : null,
      utmCampaign: typeof meta.utm_campaign === 'string' ? meta.utm_campaign : null,
      utmContent: typeof meta.utm_content === 'string' ? meta.utm_content : null,
      matchedOutboundClick: best !== null,
      storeName: best?.store_name ?? null,
      affiliateProgram: best?.affiliate_program ?? null,
      isTest: e.is_test,
    };
  });

  const rows = [...directRows, ...legacyRows.filter((r) => !directCovered.has(`${r.sessionId}|${r.clickedAt}`))];

  const bySourceMap = new Map<string, number>();
  let withKnownCampaign = 0, matchedToOutboundClicks = 0;
  for (const r of rows) {
    if (r.utmSource) { withKnownCampaign++; bySourceMap.set(r.utmSource, (bySourceMap.get(r.utmSource) || 0) + 1); }
    if (r.matchedOutboundClick) matchedToOutboundClicks++;
  }

  return {
    totalGoClicks: rows.length,
    withKnownCampaign,
    unknownCampaign: rows.length - withKnownCampaign,
    matchedToOutboundClicks,
    bySource: Array.from(bySourceMap.entries()).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    rows,
  };
}

export interface SurfaceRow {
  source: string;
  sessions: number;
  search: number;
  results: number;
  outbound: number;
}

function bySurface(events: UsageEventRow[]): SurfaceRow[] {
  const map = new Map<string, { sessions: Set<string>; search: number; results: number; outbound: number }>();
  for (const e of events) {
    const key = e.source || '(none)';
    if (!map.has(key)) map.set(key, { sessions: new Set(), search: 0, results: 0, outbound: 0 });
    const s = map.get(key)!;
    if (e.session_id) s.sessions.add(e.session_id);
    if (SEARCH_TYPES.has(e.event_type)) s.search++;
    else if (RESULTS_TYPES.has(e.event_type)) s.results++;
    else if (e.event_type === 'go_click') s.outbound++;
  }
  return Array.from(map.entries())
    .map(([source, v]) => ({ source, sessions: v.sessions.size, search: v.search, results: v.results, outbound: v.outbound }))
    .sort((a, b) => b.sessions - a.sessions);
}

// ADR-259 fixed this exact gap in the CLI tool (scripts/tps-analysis/usage-report.ts) but it
// was never ported here, so the live dashboard kept bucketing anything with no RECORDED
// category column as "(unparsed)" — even when the query text itself is trivially categorizable
// by the same deterministic parser /api/search already uses. Measured on production 2026-08-30:
// 83.7% of the real "(unparsed)" bucket in a 30-day window derives a real category this way
// (2,555 of 3,053 rows) — the true category-demand ranking was off by roughly 5-9x per category.
// Fixed at the source of truth: `parseShoppingTask` is the ONE canonical category-derivation
// function (task-parser.ts, also used by /api/search and the CLI tool) — never re-derive
// category with a second parser here or anywhere else.
export function topDemand(
  events: UsageEventRow[],
  limit = 12
): Array<{ category: string; count: number; recorded: number; derived: number }> {
  const agg = new Map<string, { recorded: number; derived: number }>();
  let uncategorized = 0;
  const bump = (key: string, kind: 'recorded' | 'derived') => {
    const cur = agg.get(key) ?? { recorded: 0, derived: 0 };
    cur[kind]++;
    agg.set(key, cur);
  };
  for (const e of events) {
    if (!SEARCH_TYPES.has(e.event_type) && !RESULTS_TYPES.has(e.event_type)) continue;
    if (e.category) { bump(e.category, 'recorded'); continue; }
    let derived: string | null = null;
    try {
      derived = e.query_text ? parseShoppingTask(e.query_text).category || null : null;
    } catch {
      derived = null; // parser failure is never fatal to a founder-facing report — stays uncategorized
    }
    if (derived) bump(derived, 'derived');
    else uncategorized++;
  }
  const rows = Array.from(agg.entries()).map(([category, v]) => ({ category, count: v.recorded + v.derived, recorded: v.recorded, derived: v.derived }));
  if (uncategorized > 0) rows.push({ category: '(unparsed)', count: uncategorized, recorded: 0, derived: 0 });
  return rows.sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * ANSWERED-ELSEWHERE CORRECTION (ADR-260).
 *
 * `no_answer` means "the STOREFRONT grid returned nothing" — it is fired from
 * search-client.tsx the moment `/api/search` comes back with total 0. But the unified
 * search surface runs TWO routes for one user action: the storefront grid AND the advisor
 * (`/api/v1/agent/decide`), and for a need-shaped sentence the advisor is the surface that
 * answers. The storefront deliberately returns an honest zero there rather than junk
 * (`categoryEnforcedZero`, "zero beats wrong"), the advisor renders six real
 * recommendations below it, and the shopper sees results.
 *
 * So a raw `no_answer` count answers "did the grid have anything", not "did the customer
 * get an answer" — and the founder's UNMET DEMAND list was reading it as the latter.
 * MEASURED on production 2026-08-18: 77 of 127 REAL no_answer events (61%) had a
 * `results`/`advisor_result` for the SAME session and query text seconds later. The #1
 * entry on "prioritize these", «مكيف لغرفة 30 متر هادئ تحت 4000» at 22 occurrences, was
 * answered 22 times out of 22 — a 100% false unmet-demand signal at the top of the list the
 * founder uses to decide what to build next.
 *
 * WINDOW, chosen from the measured distribution rather than guessed: gaps cluster at
 * ≤3s (69) and ≤10s (77), then jump to a day-scale tail (93 total, avg 21,169s) which is a
 * different visit, not the same action. Nothing new appears between 10s and 20s. 10s it is
 * — wider than ACTION_WINDOW_MS because the advisor is a slower asynchronous call, not the
 * synchronous double-fire that window exists to collapse.
 */
/**
 * True when this `no_answer` was contradicted by a real answer for the same session and
 * query moments later — i.e. the customer DID see results and this event describes only
 * one of the two routes.
 */
export function wasAnsweredElsewhere(e: UsageEventRow, events: UsageEventRow[]): boolean {
  if (!e.query_text || !e.session_id) return false;
  const t = new Date(e.created_at).getTime();
  return events.some(
    (a) =>
      RESULTS_TYPES.has(a.event_type) &&
      a.session_id === e.session_id &&
      a.query_text === e.query_text &&
      Math.abs(new Date(a.created_at).getTime() - t) <= ANSWERED_ELSEWHERE_WINDOW_MS,
  );
}

// Integrity review (2026-08-30): grouping by raw query_text let pure whitespace artifacts (one
// space vs two between words — the same query, mistyped or double-tapped) fragment what should be
// one line item into several, understating each one's real count. Verified on real production
// data (7-day window): "تابلت هونر" and "تابلت  هونر" (double space) were counted as two different
// search terms. This collapses internal whitespace runs to one space — NOT a semantic/fuzzy merge,
// just insignificant-whitespace normalization; two genuinely different queries are never affected.
function normalizeQueryWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function unmetDemand(events: UsageEventRow[], limit = 10): Array<{ query: string; count: number }> {
  const map = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== 'no_answer' || !e.query_text) continue;
    // Genuine unmet demand only: a query the customer asked and nothing answered.
    if (wasAnsweredElsewhere(e, events)) continue;
    const key = normalizeQueryWhitespace(e.query_text);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * DECISION-HELP INTENT (Product Truth & Decision Quality mission, 2026-09-05). Measures whether
 * `route-query.ts`'s `indecision_signal`/`replacement_timing_signal` routing actually reaches
 * shoppers and gets served — not just that the code path exists. Needs NO new event or column:
 * `advisor_query`'s `meta.reason` already carries `routeQuery`'s own reason string verbatim
 * (search-client.tsx's existing `track('advisor_query', { meta: { reason: route.reason } })`),
 * and `needSignals()` names each signal literally in that string
 * (`` `need signals: ${signals.join(', ')}` ``) — so this is a read of data already recorded,
 * the same discipline `unmetDemand`/`wasAnsweredElsewhere` above already use for pairing a query
 * event to its answer. "Served" reuses the identical same-session/same-query/10s-window pairing
 * ADR-260 established for exactly this purpose — never a second, differently-tuned definition of
 * "answered".
 */
export interface DecisionHelpIntentStats {
  indecisionQueries: number;
  indecisionServed: number;
  replacementTimingQueries: number;
  replacementTimingServed: number;
}

export function decisionHelpIntentStats(events: UsageEventRow[]): DecisionHelpIntentStats {
  const stats: DecisionHelpIntentStats = {
    indecisionQueries: 0, indecisionServed: 0, replacementTimingQueries: 0, replacementTimingServed: 0,
  };
  for (const e of events) {
    if (e.event_type !== 'advisor_query') continue;
    const reason = typeof e.meta?.reason === 'string' ? e.meta.reason : '';
    const isIndecision = reason.includes('indecision_signal');
    const isTiming = reason.includes('replacement_timing_signal');
    if (!isIndecision && !isTiming) continue;
    const served = wasAnsweredElsewhere(e, events);
    if (isIndecision) { stats.indecisionQueries++; if (served) stats.indecisionServed++; }
    if (isTiming) { stats.replacementTimingQueries++; if (served) stats.replacementTimingServed++; }
  }
  return stats;
}

const pct = (num: number, den: number) => (den > 0 ? num / den : 0);

// Same thresholds as scripts/tps-analysis/usage-report.ts — one governed definition, not re-picked here.
export const LAUNCH_KPI = {
  MIN_SESSIONS: 100,
  MIN_OUTBOUND: 30,
  ANSWER_RATE_MIN: 0.80,
  NOANSWER_RATE_MAX: 0.25,
  SEARCH_TO_EXIT_MIN: 0.05,
  COMPARE_TO_EXIT_MIN: 0.08,
} as const;

// ── Tawveeri Home (ADR-257 §8): the pilot is now a measured product surface. One pure
//    builder over the SAME event rows both the live dashboard and the CLI consume —
//    "Trust is one thing, computed one way." Semantics are explicit and never conflated:
//    exit CLICK ≠ RETURN ≠ SELF-MARKED complete ≠ verified commercial conversion (the
//    last does not exist in this data and is never claimed).
export interface HomeMissionStats {
  sessions: number;              // distinct sessions touching the Home surface
  starts: number;                // step: started
  plans: number;                 // step: plan (a generated plan response)
  refines: number;               // step: refined
  purchasePlanOpens: number;     // step: purchase_plan_opened
  retailerExitClicks: number;    // go_click with a home_mission* source (CLICKS, not purchases)
  returnsFromRetailer: number;   // step: returned_from_retailer
  itemsSelfMarked: number;       // step: item_marked_purchased (SELF-marked, unverified)
  retailersCompleted: number;    // step: retailer_completed (self-marked)
  missionsCompleted: number;     // step: mission_completed (self-marked)
  sharesCreated: number;         // home_share step: created
  shareOpens: number;            // home_share step: opened (recipient sessions)
  shareFeedback: number;         // home_share step: feedback
  entryCardClicks: number;       // step: entry_card_click (homepage soft-surface)
  unsupportedRequests: Array<{ term: string; count: number }>; // honest-refusal demand
}

const HOME_GO_SOURCES = new Set(['home_mission', 'home_mission_checklist', 'home_mission_retailer_cta']);

export function buildHomeMissionStats(events: UsageEventRow[]): HomeMissionStats {
  const step = (e: UsageEventRow) => String((e.meta as Record<string, unknown> | null)?.step ?? '');
  const hm = events.filter((e) => e.event_type === 'home_mission');
  const hs = events.filter((e) => e.event_type === 'home_share');
  const count = (rows: UsageEventRow[], s: string) => rows.filter((e) => step(e) === s).length;
  const sessions = new Set<string>();
  for (const e of [...hm, ...hs]) if (e.session_id) sessions.add(e.session_id);
  const unsupported = new Map<string, number>();
  for (const e of hm) {
    if (step(e) !== 'reviewed') continue;
    const raw = String((e.meta as Record<string, unknown> | null)?.unsupported ?? '');
    for (const term of raw.split('،').map((x) => x.trim()).filter(Boolean)) {
      unsupported.set(term, (unsupported.get(term) ?? 0) + 1);
    }
  }
  return {
    sessions: sessions.size,
    starts: count(hm, 'started'),
    plans: count(hm, 'plan'),
    refines: count(hm, 'refined'),
    purchasePlanOpens: count(hm, 'purchase_plan_opened'),
    retailerExitClicks: events.filter((e) => e.event_type === 'go_click' && HOME_GO_SOURCES.has(String(e.source ?? ''))).length,
    returnsFromRetailer: count(hm, 'returned_from_retailer'),
    itemsSelfMarked: count(hm, 'item_marked_purchased'),
    retailersCompleted: count(hm, 'retailer_completed'),
    missionsCompleted: count(hm, 'mission_completed'),
    sharesCreated: count(hs, 'created'),
    shareOpens: count(hs, 'opened'),
    shareFeedback: count(hs, 'feedback'),
    entryCardClicks: count(hm, 'entry_card_click'),
    unsupportedRequests: [...unsupported.entries()]
      .map(([term, n]) => ({ term, count: n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}

export interface CommandCenterData {
  homeMission: HomeMissionStats;
  range: DateRange;
  real: Funnel;
  test: Funnel;
  prevReal: Funnel;
  surfaces: SurfaceRow[];
  topDemand: Array<{ category: string; count: number; recorded: number; derived: number }>;
  unmetDemand: Array<{ query: string; count: number }>;
  decisionHelpIntent: DecisionHelpIntentStats;
  outboundReal: { clicks: number; distinctProducts: number; monetized: number };
  outboundTest: { clicks: number; distinctProducts: number; monetized: number };
  kpis: {
    answerRate: number; noAnswerRate: number; searchToProduct: number; productToCompare: number;
    compareToExit: number; searchToExit: number;
  };
  gate: { checks: Array<{ label: string; ok: boolean; value: string }>; verdict: string };
  quality: {
    lastEventAt: string | null;
    trackingStopped: boolean;
    goClickOutboundDivergencePct: number | null;
    amazonTagConfigured: boolean;
    topSessionSearchShare: number;
  };
  campaignAttribution: CampaignAttributionSummary;
  confidence: Record<string, MetricConfidence>;
  // Commercial-proof headline vocabulary (ADR-216) — what the founder/retailer report actually says.
  commercial: {
    qualifiedVisitsReferred: number;
    /** RAW server-recorded /go request/redirect rows (is_test=false) — operational volume only.
     *  Renamed usage note (ADR-286 wording fix): this proves a redirect ROW was written, never a
     *  proven customer interaction. Demoted to secondary/diagnostic display — see
     *  explicitRetailerInteractions for the founder-facing headline number. */
    confirmedRetailerRedirects: number;
    /** ADR-286 decision-grade: first_party_interactions rows requiring a real onClick to have
     *  fired (src/lib/analytics/interaction.ts) in the selected period, REAL only. This — not
     *  confirmedRetailerRedirects — is the number that actually proves an explicit interaction. */
    explicitRetailerInteractions: number;
    /** Subset of explicitRetailerInteractions exact-joined (by interaction_id) to a real
     *  outbound_clicks row — i.e. an explicit interaction that also produced a server-recorded
     *  /go merchant navigation. Never larger than explicitRetailerInteractions. */
    correlatedMerchantNavigations: number;
    referredProductInterest: number;
    referredCategoryDemand: Array<{ category: string; count: number }>;
    topSearchTerms: Array<{ query: string; count: number }>;
    topReferredProducts: ReferredProductRow[];
    retailers: RetailerReferralRow[];
  };
  baseline: {
    date: string; // ISO — COMMERCIAL_BASELINE
    currentIsPreLaunch: boolean;
    previousIsPreLaunch: boolean;
    includesHistorical: boolean;
  };
}

// Confidence states — Data Quality Contract Rule 1: missing/estimated data is never shown as an
// exact number without saying so. CONFIRMED = direct count from an immutable append-only row.
// ESTIMATED = derived via a documented heuristic (dedup clustering, nearest-timestamp join).
// UNAVAILABLE = not measurable yet with current instrumentation/imported data.
export type ConfidenceState = 'CONFIRMED' | 'ESTIMATED' | 'DELAYED' | 'INCOMPLETE' | 'UNAVAILABLE';
export interface MetricConfidence { state: ConfidenceState; note: string }

const METRIC_CONFIDENCE: Record<string, MetricConfidence> = {
  sessions: { state: 'CONFIRMED', note: 'Exact distinct session_id count from usage_events.' },
  search: { state: 'ESTIMATED', note: 'Deduped: the unified search page can fire both a storefront and an advisor event for one action (ADR-214) — collapsed to one action per query within a 3s window.' },
  results: { state: 'ESTIMATED', note: 'Same dedup as Search — see ADR-214.' },
  outbound: { state: 'CONFIRMED', note: 'Exit-ledger rows (outbound_clicks) in period — server-recorded on every /go redirect (ADR-244). Client-only exits from scraped search results are additionally visible as go_click events but are not in this count. Operational volume, not proof of customer interaction — see explicitInteractions for the decision-grade number (ADR-286).' },
  explicitInteractions: { state: 'CONFIRMED', note: 'ADR-286 decision-grade: first_party_interactions rows requiring a real onClick to have fired (src/lib/analytics/interaction.ts) in the selected period, REAL only. The correlated subset exact-joins outbound_clicks.interaction_id — a raw /go request with no matching interaction is never counted here.' },
  qualifiedVisitsReferred: { state: 'CONFIRMED', note: 'Distinct REAL sessions with ≥1 measured retailer exit — union of ledger rows carrying session_id (stamped by /go since ADR-244) and go_click events. Ledger rows from before the cutover have no session identity and are honestly excluded.' },
  comparisonView: { state: 'CONFIRMED', note: 'Exact comparison_view event count from usage_events — no proven duplication on this step.' },
  answerRate: { state: 'ESTIMATED', note: 'Derived from deduped Search/Results — precision depends on sample size; below 100 real sessions this is a directional signal, not a verdict.' },
  campaignAttribution: { state: 'ESTIMATED', note: 'Session-level join between usage_events UTM capture and outbound_clicks by nearest timestamp — not a guaranteed exact per-click match. See docs/AFFILIATE_RECONCILIATION_CONTRACT.md and ADR-214.' },
  affiliateCommission: { state: 'UNAVAILABLE', note: 'No affiliate report imported yet — see /admin/affiliate.' },
};

export function summarizeOutbound(rows: OutboundClickRow[], isTest: boolean) {
  const filtered = rows.filter((r) => r.is_test === isTest);
  return {
    clicks: filtered.length,
    distinctProducts: new Set(filtered.map((r) => r.canonical_product_id).filter(Boolean)).size,
    monetized: filtered.filter((r) => r.affiliate_program && r.affiliate_program !== 'direct').length,
  };
}

// ── Commercial-proof vocabulary (ADR-216) ───────────────────────────────────────────────────
// Founder-facing wording, deliberately conservative: a redirect is never called a sale, an
// anonymous session is never called a customer, a click attempt is never called a confirmed
// arrival. "Qualified visit" = a REAL session that reached at least one confirmed retailer
// redirect (go_click) — session-level, not person-level.
export function qualifiedReferredSessions(events: UsageEventRow[], outboundRows?: OutboundClickRow[]): number {
  // ADR-244: a qualified referred session = a REAL session with at least one MEASURED
  // retailer exit. The exit ledger (outbound_clicks.session_id, stamped by /go from the
  // tw_sid cookie) is the primary source; go_click events are unioned in so client-only
  // exits (scraped search results with no ledger row) still count. Ledger rows written
  // before the ADR-244 cutover have NULL session_id and correctly contribute nothing —
  // historical undercount is disclosed in METRIC_DEFINITIONS, never guessed.
  const s = new Set(events.filter((e) => e.event_type === 'go_click' && e.session_id).map((e) => e.session_id));
  for (const o of outboundRows ?? []) if (o.session_id) s.add(o.session_id);
  return s.size;
}

// outbound_clicks carries no category — join canonical_product_id -> canonical_products.category.
// Read-only, additive, bounded to the distinct products actually referred in the period.
async function referredCategoryDemand(rows: OutboundClickRow[]): Promise<Array<{ category: string; count: number }>> {
  const ids = Array.from(new Set(rows.map((r) => r.canonical_product_id).filter((x): x is string => Boolean(x))));
  if (ids.length === 0) return [];
  const supabase = createServerClient() as unknown as { from: (table: string) => any };
  const { data, error } = await supabase.from('canonical_products').select('id, category').in('id', ids);
  if (error || !data) return [];
  const categoryById = new Map<string, string>((data as Array<{ id: string; category: string | null }>).map((p) => [p.id, p.category || '(unparsed)']));
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.canonical_product_id) continue;
    const cat = categoryById.get(r.canonical_product_id) || '(unparsed)';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

// Exact search terms customers typed — ALL real search-type actions, not only the no-answer
// subset (that remains `unmetDemand`). Deduped at the SAME action-cluster granularity as the
// funnel (ADR-214) so a query that fired both a storefront and an advisor event isn't counted twice.
export function topSearchTerms(events: UsageEventRow[], limit = 10): Array<{ query: string; count: number }> {
  const seen = new Map<string, number>(); // key: session|query|bucket -> last cluster ts, for de-dup
  const counts = new Map<string, number>();
  const sorted = events
    .filter((e) => SEARCH_TYPES.has(e.event_type) && e.query_text && e.session_id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  for (const e of sorted) {
    const key = `${e.session_id}|${e.query_text}`;
    const ts = new Date(e.created_at).getTime();
    const lastTs = seen.get(key);
    if (lastTs !== undefined && ts - lastTs <= ACTION_WINDOW_MS) continue; // same action, already counted
    seen.set(key, ts);
    const text = normalizeQueryWhitespace(e.query_text!);
    if (!text) continue;
    counts.set(text, (counts.get(text) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

// Top products that actually drove a confirmed retailer redirect — answers "which products
// caused these exits" with real names, not just an opaque canonical_product_id count.
export interface ReferredProductRow { id: string; nameAr: string; nameEn: string; count: number }

export async function topReferredProducts(rows: OutboundClickRow[], limit = 10): Promise<ReferredProductRow[]> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.canonical_product_id) continue;
    counts.set(r.canonical_product_id, (counts.get(r.canonical_product_id) || 0) + 1);
  }
  const ids = Array.from(counts.keys());
  if (ids.length === 0) return [];
  const supabase = createServerClient() as unknown as { from: (table: string) => any };
  const { data } = await supabase.from('canonical_products').select('id, name_ar, name_en').in('id', ids);
  const names = new Map<string, { nameAr: string; nameEn: string }>(
    ((data ?? []) as Array<{ id: string; name_ar: string | null; name_en: string | null }>)
      .map((p) => [p.id, { nameAr: p.name_ar || p.id, nameEn: p.name_en || p.id }])
  );
  return Array.from(counts.entries())
    .map(([id, count]) => ({ id, count, ...(names.get(id) || { nameAr: id, nameEn: id }) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Per-retailer breakdown for the Retailer Partnership Report (ADR-216) — same commercial
// vocabulary, scoped to one store. `storeSlug` matches outbound_clicks.store_name (which stores
// the provider's store_id/slug, not a display name — resolve display name at the UI layer via
// the Provider Registry).
export interface RetailerReferralRow {
  storeSlug: string;
  qualifiedSessions: number;
  confirmedRedirects: number;
  distinctProducts: number;
  hasAffiliateProgram: boolean;
}

// Merchant-name normalization (2026-08-30 integrated review): `outbound_clicks.store_name`
// is supposed to always be the numeric store id (what /go writes, verified as the only real
// INSERT site — src/app/go/[offerId]/route.ts). For a handful of merchants it instead holds
// the literal Arabic/English display name, because the upstream `normalized_product_observations
// .store_id` column that /go reads from holds a display name for those same stores (a separate,
// out-of-scope ingestion defect — not fixed here). Grouping by raw store_name therefore silently
// splits one merchant's redirects across two untotaled buckets. This resolves any display-name-
// shaped value back to the canonical numeric id at READ time only — no historical row is rewritten,
// no ingestion behavior changes; if the upstream defect is ever fixed, this becomes a no-op.
//
// EXACT-MATCH WAS NOT ENOUGH (found auditing real production output, 2026-08-30, twice — both
// real, both distinct patterns): (1) outbound_clicks held the literal "أمازون" (bare brand) while
// stores.name_ar holds "أمازون السعودية" (brand + "Saudi Arabia") — the bare brand is a LEADING
// word of the full name. (2) outbound_clicks held "جرير" while stores.name_ar holds "مكتبة جرير"
// ("Jarir Bookstore") — the bare brand is here the TRAILING word instead. An exact-string lookup
// caught neither, so both merchants' real redirects were silently split across two unmerged
// buckets in the Retailer Partnership Report and the Command Center's retailer breakdown. Falls
// back to a whitespace-DELIMITED word match at EITHER end — never a raw substring — so two
// different stores that happen to share a short common substring are never accidentally merged.
async function resolveStoreNameKey(rawKeys: Iterable<string>): Promise<Map<string, string>> {
  const keys = new Set(rawKeys);
  const resolved = new Map<string, string>();
  for (const k of keys) resolved.set(k, k); // default: identity (already a numeric id, or genuinely unknown)
  const needsResolution = [...keys].filter((k) => !/^\d+$/.test(k) && k !== '(unknown)');
  if (needsResolution.length === 0) return resolved;
  const supabase = createServerClient() as unknown as { from: (table: string) => any };
  const { data } = await supabase.from('stores').select('id, name_ar, name_en');
  const stores = (data ?? []) as Array<{ id: number | string; name_ar: string | null; name_en: string | null }>;
  const byName = new Map<string, string>();
  for (const s of stores) {
    if (s.name_ar) byName.set(s.name_ar, String(s.id));
    if (s.name_en) byName.set(s.name_en, String(s.id));
  }
  // `shorter` is a whole word (or run of whole words) at the START or END of `longer` — a leading
  // OR trailing word-boundary match, never a mid-string substring.
  const isWordBoundaryMatch = (shorter: string, longer: string) =>
    longer === shorter || longer.startsWith(`${shorter} `) || longer.endsWith(` ${shorter}`);
  for (const k of needsResolution) {
    const exact = byName.get(k);
    if (exact) { resolved.set(k, exact); continue; }
    const wordMatch = stores.find((s) =>
      (s.name_ar && (isWordBoundaryMatch(k, s.name_ar) || isWordBoundaryMatch(s.name_ar, k))) ||
      (s.name_en && (isWordBoundaryMatch(k, s.name_en) || isWordBoundaryMatch(s.name_en, k)))
    );
    if (wordMatch) resolved.set(k, String(wordMatch.id));
  }
  return resolved;
}

export async function retailerBreakdown(realEvents: UsageEventRow[], outboundRows: OutboundClickRow[]): Promise<RetailerReferralRow[]> {
  const realOutboundRows = outboundRows.filter((r) => !r.is_test);
  const keyFor = await resolveStoreNameKey(realOutboundRows.map((r) => r.store_name || '(unknown)'));
  const bySlug = new Map<string, OutboundClickRow[]>();
  for (const r of realOutboundRows) {
    const key = keyFor.get(r.store_name || '(unknown)') ?? (r.store_name || '(unknown)');
    const arr = bySlug.get(key);
    if (arr) arr.push(r); else bySlug.set(key, [r]);
  }
  const goClickSessionsByStore = new Map<string, Set<string>>();
  // usage_events.go_click doesn't carry store reliably for every surface — qualified sessions
  // here are approximated from outbound_clicks' own session-less rows is not possible (ADR-207),
  // so "qualified sessions" per retailer counts DISTINCT outbound_clicks rows' click timestamps
  // clustered per session isn't available either; use REAL go_click events whose canonical_id
  // matches a product referred to this store as the best-available session proxy.
  const productsByStore = new Map<string, Set<string>>();
  for (const [slug, rows] of bySlug) {
    productsByStore.set(slug, new Set(rows.map((r) => r.canonical_product_id).filter((x): x is string => Boolean(x))));
  }
  for (const e of realEvents) {
    if (e.event_type !== 'go_click' || !e.session_id || !e.canonical_id) continue;
    for (const [slug, products] of productsByStore) {
      if (products.has(e.canonical_id)) {
        const set = goClickSessionsByStore.get(slug) ?? new Set<string>();
        set.add(e.session_id);
        goClickSessionsByStore.set(slug, set);
      }
    }
  }
  return Array.from(bySlug.entries()).map(([storeSlug, rows]) => ({
    storeSlug,
    qualifiedSessions: goClickSessionsByStore.get(storeSlug)?.size ?? 0,
    confirmedRedirects: rows.length,
    distinctProducts: new Set(rows.map((r) => r.canonical_product_id).filter(Boolean)).size,
    hasAffiliateProgram: rows.some((r) => r.affiliate_program && r.affiliate_program !== 'direct'),
  })).sort((a, b) => b.confirmedRedirects - a.confirmedRedirects);
}

function buildGate(real: Funnel, kpis: CommandCenterData['kpis']) {
  const checks = [
    { label: `Sessions ≥ ${LAUNCH_KPI.MIN_SESSIONS}`, ok: real.sessions >= LAUNCH_KPI.MIN_SESSIONS, value: String(real.sessions) },
    { label: `Measured exits ≥ ${LAUNCH_KPI.MIN_OUTBOUND}`, ok: real.outbound >= LAUNCH_KPI.MIN_OUTBOUND, value: String(real.outbound) },
    { label: `Answer rate ≥ ${(LAUNCH_KPI.ANSWER_RATE_MIN * 100).toFixed(0)}%`, ok: kpis.answerRate >= LAUNCH_KPI.ANSWER_RATE_MIN, value: `${(kpis.answerRate * 100).toFixed(1)}%` },
    { label: `No-answer rate ≤ ${(LAUNCH_KPI.NOANSWER_RATE_MAX * 100).toFixed(0)}%`, ok: kpis.noAnswerRate <= LAUNCH_KPI.NOANSWER_RATE_MAX, value: `${(kpis.noAnswerRate * 100).toFixed(1)}%` },
    { label: `Search→Exit ≥ ${(LAUNCH_KPI.SEARCH_TO_EXIT_MIN * 100).toFixed(0)}%`, ok: kpis.searchToExit >= LAUNCH_KPI.SEARCH_TO_EXIT_MIN, value: `${(kpis.searchToExit * 100).toFixed(1)}%` },
    { label: `Comparison→Exit ≥ ${(LAUNCH_KPI.COMPARE_TO_EXIT_MIN * 100).toFixed(0)}%`, ok: kpis.compareToExit >= LAUNCH_KPI.COMPARE_TO_EXIT_MIN, value: `${(kpis.compareToExit * 100).toFixed(1)}%` },
  ];
  let verdict: string;
  if (real.sessions === 0) verdict = 'AWAITING FIRST SESSIONS';
  else if (real.sessions < LAUNCH_KPI.MIN_SESSIONS || real.outbound < LAUNCH_KPI.MIN_OUTBOUND) verdict = 'EARLY SIGNAL — gathering sample';
  else if (checks.every((c) => c.ok)) verdict = 'PUBLIC-LAUNCH SIGNAL: GREEN';
  else verdict = `IMPROVE BEFORE LAUNCH — failing: ${checks.filter((c) => !c.ok).map((c) => c.label).join('; ')}`;
  return { checks, verdict };
}

export async function getCommandCenterData(
  period: Period,
  customStart?: string,
  customEnd?: string,
  includeHistorical: boolean = false
): Promise<CommandCenterData> {
  const range = resolvePeriod(period, customStart, customEnd);
  const prev = previousRange(range);

  // Pre-launch labeling is judged against the ORIGINAL requested window, before any clipping —
  // "today" on 2026-08-05 is entirely pre-baseline and must say so, not silently show 0.
  const currentIsPreLaunch = range.end <= COMMERCIAL_BASELINE;
  const previousIsPreLaunch = prev.end <= COMMERCIAL_BASELINE;

  // Default view clips the fetch window to the official baseline — historical rows are never
  // deleted, just excluded from the DEFAULT founder headline (ADR-216). includeHistorical=true
  // (an explicit, labeled toggle) fetches the unclipped range instead.
  const fetchRange = includeHistorical
    ? range
    : { start: new Date(Math.max(range.start.getTime(), COMMERCIAL_BASELINE.getTime())), end: range.end, label: range.label };
  const fetchPrev = includeHistorical
    ? prev
    : { start: new Date(Math.max(prev.start.getTime(), COMMERCIAL_BASELINE.getTime())), end: prev.end };

  const [events, prevEvents, outboundRows, lastEvent, decisionGrade] = await Promise.all([
    fetchUsageEvents(fetchRange.start, fetchRange.end),
    fetchUsageEvents(fetchPrev.start, fetchPrev.end),
    fetchOutboundClicks(fetchRange.start, fetchRange.end),
    (createServerClient() as unknown as { from: (table: string) => any })
      .from('usage_events').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    // ADR-286 wording fix: same selected-period window as everything else above. Never throws
    // (see decision-grade-queries.ts) — degrades to {value: null} on any error, which the
    // commercial block below coalesces to 0 rather than crashing the page.
    getDecisionGradeOutboundStats(fetchRange.start, fetchRange.end),
  ]);

  const realEvents = events.filter((e) => !e.is_test);
  const testEvents = events.filter((e) => e.is_test);
  const prevRealEvents = prevEvents.filter((e) => !e.is_test);

  // ADR-244: step 6 (Outbound) is now the exit LEDGER, split REAL/TEST like the events.
  // The previous-period funnel needs its own ledger fetch for a like-for-like Δ.
  const prevOutboundRows = await fetchOutboundClicks(fetchPrev.start, fetchPrev.end);
  const real = buildFunnel(realEvents, outboundRows.filter((r) => !r.is_test));
  const test = buildFunnel(testEvents, outboundRows.filter((r) => r.is_test));
  const prevReal = buildFunnel(prevRealEvents, prevOutboundRows.filter((r) => !r.is_test));

  const kpis = {
    answerRate: pct(real.results, real.search),
    noAnswerRate: pct(real.noAnswer, real.search),
    searchToProduct: pct(real.productView, real.search),
    productToCompare: pct(real.comparisonView, real.productView),
    compareToExit: pct(real.outbound, real.comparisonView),
    searchToExit: pct(real.outbound, real.search),
  };

  const outboundReal = summarizeOutbound(outboundRows, false);
  const outboundTest = summarizeOutbound(outboundRows, true);

  const lastEventAt = (lastEvent.data as { created_at: string } | null)?.created_at ?? null;
  const trackingStopped = lastEventAt ? Date.now() - new Date(lastEventAt).getTime() > 6 * 60 * 60 * 1000 : true;
  // ADR-244: funnel step 6 now IS the ledger, so the divergence signal compares the
  // client go_click EVENT count against ledger rows — it measures how much of the exit
  // volume the client-side pipe misses (ad-blockers, dropped keepalive, un-instrumented
  // surfaces). Measured 2026-08-13 at the fix: 1 event vs 282 ledger rows (99.6% miss).
  const goClickEventCountReal = realEvents.filter((e) => e.event_type === 'go_click').length;
  const goClickDivergencePct = outboundReal.clicks > 0
    ? Math.abs(goClickEventCountReal - outboundReal.clicks) / outboundReal.clicks
    : null;
  // Authoritative source is code, not the `stores` table — `stores.affiliate_config` (migration 20)
  // was never applied to production (ADR-212) and isn't read by the actual exit path either way.
  // DEFAULT_STORE_AFFILIATE_CONFIG (src/lib/transactions/affiliate-config.ts) mirrors the live
  // Provider Registry value (src/lib/providers/registry.ts).
  const amazonTagConfigured = Boolean(getAffiliateConfig('amazon')?.[0]?.value);

  // REAL-only campaign attribution for the headline view — TEST go_clicks (including any
  // controlled verification journey) are computed too but never blended into the REAL summary.
  const goClickEventsReal = realEvents.filter((e) => e.event_type === 'go_click');
  const campaignAttribution = computeCampaignAttribution(goClickEventsReal, outboundRows);

  const realOutboundRows = outboundRows.filter((r) => !r.is_test);
  const [categoryDemand, retailers, referredProducts] = await Promise.all([
    referredCategoryDemand(realOutboundRows),
    retailerBreakdown(realEvents, outboundRows),
    topReferredProducts(realOutboundRows),
  ]);

  return {
    range,
    real,
    test,
    prevReal,
    homeMission: buildHomeMissionStats(realEvents),
    surfaces: bySurface(realEvents),
    topDemand: topDemand(realEvents),
    unmetDemand: unmetDemand(realEvents),
    decisionHelpIntent: decisionHelpIntentStats(realEvents),
    outboundReal,
    outboundTest,
    kpis,
    gate: buildGate(real, kpis),
    quality: {
      lastEventAt,
      trackingStopped,
      goClickOutboundDivergencePct: goClickDivergencePct,
      amazonTagConfigured,
      topSessionSearchShare: topSessionSearchShare(realEvents).share,
    },
    campaignAttribution,
    confidence: METRIC_CONFIDENCE,
    commercial: {
      qualifiedVisitsReferred: qualifiedReferredSessions(realEvents, outboundRows.filter((r) => !r.is_test)),
      confirmedRetailerRedirects: outboundReal.clicks,
      explicitRetailerInteractions: decisionGrade.firstPartyInteractions.value ?? 0,
      correlatedMerchantNavigations: decisionGrade.merchantNavigationsCorrelated.value ?? 0,
      referredProductInterest: outboundReal.distinctProducts,
      referredCategoryDemand: categoryDemand,
      topSearchTerms: topSearchTerms(realEvents),
      topReferredProducts: referredProducts,
      retailers,
    },
    baseline: {
      date: COMMERCIAL_BASELINE.toISOString(),
      currentIsPreLaunch,
      previousIsPreLaunch,
      includesHistorical: includeHistorical,
    },
  };
}
