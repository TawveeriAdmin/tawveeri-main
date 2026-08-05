// Founder Commerce Command Center — data layer (ADR-213).
// Reuses the exact funnel/KPI definitions already validated in scripts/tps-analysis/usage-report.ts
// (npm run tps:usage), just with period filtering added, computed live for /admin/command-center.
// REAL-only for every headline number; TEST volume always computed alongside, never blended in.
// Metric definitions: docs/METRIC_DEFINITIONS.md. Data-quality rules: docs/DATA_QUALITY_CONTRACT.md.
import { createServerClient } from '@/lib/database';

export type Period = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

// Saudi Arabia does not observe DST — a fixed UTC+3 offset is correct year-round.
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

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

function previousRange({ start, end }: DateRange): { start: Date; end: Date } {
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
}

const EVENT_COLUMNS = 'event_type, session_id, is_test, source, category, query_text, canonical_id, created_at, meta';
// outbound_clicks predates the numbered-migration schema files and isn't declared anywhere in the
// repo — confirmed via read-only information_schema introspection: its timestamp column is
// `clicked_at`, not `created_at`. Verify against production before assuming a column name here.
const OUTBOUND_COLUMNS = 'is_test, canonical_product_id, affiliate_program, store_name, clicked_at';

// Bounded: current REAL+TEST volume is a few thousand rows/month. If this ever needs to scale past
// the row cap, aggregate server-side via a SQL view instead of raising the limit — see ADR-213.
const ROW_CAP = 20_000;

// usage_events/outbound_clicks are added via raw migration SQL and aren't in the generated
// Database types (same reason src/app/go/[offerId]/route.ts and src/app/api/events/route.ts
// don't type them) — cast at the call site rather than widening the shared client type.
async function fetchUsageEvents(start: Date, end: Date): Promise<UsageEventRow[]> {
  const supabase = createServerClient() as unknown as { from: (table: string) => any };
  const { data, error } = await supabase
    .from('usage_events')
    .select(EVENT_COLUMNS)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .limit(ROW_CAP);
  if (error) throw error;
  return (data ?? []) as UsageEventRow[];
}

async function fetchOutboundClicks(start: Date, end: Date): Promise<OutboundClickRow[]> {
  const supabase = createServerClient() as unknown as { from: (table: string) => any };
  const { data, error } = await supabase
    .from('outbound_clicks')
    .select(OUTBOUND_COLUMNS)
    .gte('clicked_at', start.toISOString())
    .lt('clicked_at', end.toISOString())
    .limit(ROW_CAP);
  if (error) throw error;
  return (data ?? []) as OutboundClickRow[];
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
      const hasNoAnswer = cluster.some((x) => x.type === 'no_answer');
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

export function buildFunnel(events: UsageEventRow[]): Funnel {
  const sessions = new Set<string>();
  let productView = 0, comparisonView = 0, evidenceView = 0, outbound = 0;
  for (const e of events) {
    if (e.session_id) sessions.add(e.session_id);
    if (e.event_type === 'product_view') productView++;
    else if (e.event_type === 'comparison_view') comparisonView++;
    else if (e.event_type === 'evidence_view') evidenceView++;
    else if (e.event_type === 'go_click') outbound++;
  }
  const { search, results, noAnswer, errors } = dedupeFunnelActions(events);
  return { search, results, productView, comparisonView, evidenceView, outbound, noAnswer, errors, sessions: sessions.size };
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
  const rows: CampaignAttributionRow[] = goClickEvents.map((e) => {
    const meta = e.meta ?? {};
    const utmSource = typeof meta.utm_source === 'string' ? meta.utm_source : null;
    const clickTs = new Date(e.created_at).getTime();

    // Nearest-timestamp match on canonical_product_id, same is_test state, within the window —
    // session_id can't be used (outbound_clicks.session_id is unpopulated, ADR-207) so this is
    // the safest available join key without touching the write path.
    let best: OutboundClickRow | null = null;
    let bestDelta = Infinity;
    for (const o of outboundRows) {
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

function topDemand(events: UsageEventRow[], limit = 12): Array<{ category: string; count: number }> {
  const map = new Map<string, number>();
  for (const e of events) {
    if (!SEARCH_TYPES.has(e.event_type) && !RESULTS_TYPES.has(e.event_type)) continue;
    const key = e.category || '(unparsed)';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

function unmetDemand(events: UsageEventRow[], limit = 10): Array<{ query: string; count: number }> {
  const map = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== 'no_answer' || !e.query_text) continue;
    map.set(e.query_text, (map.get(e.query_text) || 0) + 1);
  }
  return Array.from(map.entries()).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, limit);
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

export interface CommandCenterData {
  range: DateRange;
  real: Funnel;
  test: Funnel;
  prevReal: Funnel;
  surfaces: SurfaceRow[];
  topDemand: Array<{ category: string; count: number }>;
  unmetDemand: Array<{ query: string; count: number }>;
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
  outbound: { state: 'CONFIRMED', note: 'Exact go_click event count from usage_events.' },
  comparisonView: { state: 'CONFIRMED', note: 'Exact comparison_view event count from usage_events — no proven duplication on this step.' },
  answerRate: { state: 'ESTIMATED', note: 'Derived from deduped Search/Results — precision depends on sample size; below 100 real sessions this is a directional signal, not a verdict.' },
  campaignAttribution: { state: 'ESTIMATED', note: 'Session-level join between usage_events UTM capture and outbound_clicks by nearest timestamp — not a guaranteed exact per-click match. See docs/AFFILIATE_RECONCILIATION_CONTRACT.md and ADR-214.' },
  affiliateCommission: { state: 'UNAVAILABLE', note: 'No affiliate report imported yet — see /admin/affiliate.' },
};

function summarizeOutbound(rows: OutboundClickRow[], isTest: boolean) {
  const filtered = rows.filter((r) => r.is_test === isTest);
  return {
    clicks: filtered.length,
    distinctProducts: new Set(filtered.map((r) => r.canonical_product_id).filter(Boolean)).size,
    monetized: filtered.filter((r) => r.affiliate_program && r.affiliate_program !== 'direct').length,
  };
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

export async function getCommandCenterData(period: Period, customStart?: string, customEnd?: string): Promise<CommandCenterData> {
  const range = resolvePeriod(period, customStart, customEnd);
  const prev = previousRange(range);

  const [events, prevEvents, outboundRows, lastEvent, amazonStore] = await Promise.all([
    fetchUsageEvents(range.start, range.end),
    fetchUsageEvents(prev.start, prev.end),
    fetchOutboundClicks(range.start, range.end),
    (createServerClient() as unknown as { from: (table: string) => any })
      .from('usage_events').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    createServerClient().from('stores').select('affiliate_config').eq('slug', 'amazon').maybeSingle(),
  ]);

  const realEvents = events.filter((e) => !e.is_test);
  const testEvents = events.filter((e) => e.is_test);
  const prevRealEvents = prevEvents.filter((e) => !e.is_test);

  const real = buildFunnel(realEvents);
  const test = buildFunnel(testEvents);
  const prevReal = buildFunnel(prevRealEvents);

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
  const goClickDivergencePct = real.outbound > 0
    ? Math.abs(real.outbound - outboundReal.clicks) / real.outbound
    : null;
  const affiliateConfig = amazonStore.data?.affiliate_config as { tag?: string } | null | undefined;
  const amazonTagConfigured = Boolean(affiliateConfig?.tag);

  // REAL-only campaign attribution for the headline view — TEST go_clicks (including any
  // controlled verification journey) are computed too but never blended into the REAL summary.
  const goClickEventsReal = realEvents.filter((e) => e.event_type === 'go_click');
  const campaignAttribution = computeCampaignAttribution(goClickEventsReal, outboundRows);

  return {
    range,
    real,
    test,
    prevReal,
    surfaces: bySurface(realEvents),
    topDemand: topDemand(realEvents),
    unmetDemand: unmetDemand(realEvents),
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
  };
}
