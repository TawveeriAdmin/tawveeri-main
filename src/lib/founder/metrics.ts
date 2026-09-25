// src/lib/founder/metrics.ts — reads the SQL metric pack (founder_window_metrics) and turns it into
// register-bound MetricValue objects. Tri-state: a failed read is UNAVAILABLE with a reason, never 0.
import { createServerClient } from '@/lib/database';
import { DEFINITION_VERSION, metricDef, type MetricUnit } from './registry';
import { previousEqualWindow, type MetricWindow } from './windows';

export type CoverageState = 'complete' | 'partial' | 'coverage_missing' | 'unavailable';

export interface MetricValue {
  id: string;
  version: string;
  window: { kind: string; start: string; end: string; partial: boolean; labelAr: string };
  numerator: number | null;
  denominator: number | null;
  unit: MetricUnit;
  coverage: CoverageState;
  computedAt: string;
  lastEventAt: string | null;
  reason?: string;
}

export interface WindowPack {
  window_start: string; window_end: string;
  observed_browsers: number; visits_30m: number; new_browsers: number; returning_browsers: number; intent_browsers: number;
  search_sessions: number; search_events: number; positive_result_sessions: number;
  comparison_click_sessions: number; comparison_click_events: number; comparison_auto_events: number;
  product_after_search_sessions: number; product_view_events: number; product_view_sessions: number;
  go_click_events: number; go_click_sessions: number; explicit_interactions: number;
  linked_interactions: number; linked_sessions: number; linked_after_search_sessions: number;
  raw_outbound_rows: number; raw_outbound_without_session: number; raw_outbound_products: number;
  test_browsers: number; admin_browsers: number; bot_ua_events_excluded: number;
  no_answer_events: number; error_events: number;
  last_usage_event_at: string | null; last_outbound_at: string | null; last_interaction_at: string | null;
  channels: Array<{ channel: string; browsers: number }>;
  entry_types: Array<{ event_type: string; browsers: number }>;
}

export type PackResult = { ok: true; pack: WindowPack; computedAt: string } | { ok: false; reason: string; computedAt: string };

type AnyClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export async function fetchWindowPack(w: MetricWindow): Promise<PackResult> {
  const computedAt = new Date().toISOString();
  try {
    const supabase = createServerClient() as unknown as AnyClient;
    const { data, error } = await supabase.rpc('founder_window_metrics', { p_start: w.start.toISOString(), p_end: w.end.toISOString() });
    if (error) return { ok: false, reason: error.message, computedAt };
    if (!data || typeof data !== 'object') return { ok: false, reason: 'empty pack', computedAt };
    return { ok: true, pack: data as WindowPack, computedAt };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'unknown error', computedAt };
  }
}

export interface DailyPoint { day: string; browsers: number; visits30m: number; searchSessions: number; positiveResultSessions: number; productViewEvents: number; goClickEvents: number; linkedInteractions: number; rawOutboundRows: number }

export async function fetchDailySeries(w: MetricWindow): Promise<{ ok: true; days: DailyPoint[] } | { ok: false; reason: string }> {
  try {
    const supabase = createServerClient() as unknown as AnyClient;
    const { data, error } = await supabase.rpc('founder_daily_series', { p_start: w.start.toISOString(), p_end: w.end.toISOString() });
    if (error) return { ok: false, reason: error.message };
    const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
    return { ok: true, days: ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      day: String(r.day).slice(0, 10), browsers: n(r.browsers), visits30m: n(r.visits_30m), searchSessions: n(r.search_sessions), positiveResultSessions: n(r.positive_result_sessions),
      productViewEvents: n(r.product_view_events), goClickEvents: n(r.go_click_events), linkedInteractions: n(r.linked_interactions), rawOutboundRows: n(r.raw_outbound_rows),
    })) };
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'unknown' }; }
}

export async function fetchWindowWithPrevious(w: MetricWindow): Promise<{ current: PackResult; previous: PackResult; previousWindow: MetricWindow }> {
  const previousWindow = previousEqualWindow(w);
  const [current, previous] = await Promise.all([fetchWindowPack(w), fetchWindowPack(previousWindow)]);
  return { current, previous, previousWindow };
}

const windowMeta = (w: MetricWindow) => ({ kind: w.kind, start: w.start.toISOString(), end: w.end.toISOString(), partial: w.partial, labelAr: w.labelAr });

export function metricFromPack(id: string, result: PackResult, w: MetricWindow): MetricValue {
  const def = metricDef(id);
  const base = { id, version: DEFINITION_VERSION, window: windowMeta(w), unit: def.unit, computedAt: result.computedAt };
  if (!result.ok) return { ...base, numerator: null, denominator: null, coverage: 'unavailable', lastEventAt: null, reason: result.reason };
  const p = result.pack as unknown as Record<string, unknown>;
  const num = def.packKey ? p[def.packKey] : null;
  const den = def.denominatorKey ? p[def.denominatorKey] : null;
  const lastEvent = def.source.includes('outbound') && !def.source.includes('usage')
    ? result.pack.last_outbound_at
    : def.source.includes('first_party') ? result.pack.last_interaction_at : result.pack.last_usage_event_at;
  return {
    ...base,
    numerator: typeof num === 'number' ? num : num == null ? null : Number(num),
    denominator: typeof den === 'number' ? den : den == null ? null : Number(den),
    coverage: w.partial ? 'partial' : 'complete',
    lastEventAt: lastEvent ?? null,
  };
}

export function unavailableMetric(id: string, w: MetricWindow, reason: string, coverage: CoverageState = 'unavailable'): MetricValue {
  const def = metricDef(id);
  return { id, version: DEFINITION_VERSION, window: windowMeta(w), unit: def.unit, numerator: null, denominator: null, coverage, computedAt: new Date().toISOString(), lastEventAt: null, reason };
}

export function measuredMetric(id: string, w: MetricWindow, numerator: number | null, denominator: number | null = null, coverage: CoverageState = 'complete', reason?: string): MetricValue {
  const def = metricDef(id);
  return { id, version: DEFINITION_VERSION, window: windowMeta(w), unit: def.unit, numerator, denominator, coverage, computedAt: new Date().toISOString(), lastEventAt: null, ...(reason ? { reason } : {}) };
}

/** Ratio text «45/53 = 84.9%» or «لا توجد عينة» — never a division by zero, never an infinite growth. */
export function ratioText(num: number | null, den: number | null): string {
  if (num == null) return 'غير متاح';
  if (den == null) return String(num);
  if (den === 0) return `${num}/0 — لا توجد عينة`;
  return `${num}/${den} = ${((num / den) * 100).toFixed(1)}%`;
}

export interface Delta { absolute: number; previous: number; pctText: string }

/** Absolute change first (small denominators), percentage only when the previous value is > 0. */
export function deltaText(current: number | null, previous: number | null): Delta | null {
  if (current == null || previous == null) return null;
  const absolute = current - previous;
  const pctText = previous > 0 ? `${absolute >= 0 ? '+' : '−'}${Math.abs((absolute / previous) * 100).toFixed(1)}%` : (current > 0 ? 'من صفر' : '—');
  return { absolute, previous, pctText };
}
