// src/lib/founder/amazon-eligibility.ts — ADR-398 (point ب): the road to Amazon's official API,
// measured the only honest way: human exits we can prove, orders the partner reported, and the
// trailing-30-day shipped count against the Creators API threshold (10 qualifying sales).
//
// Tri-state like every founder metric: an unreadable source is UNAVAILABLE with a reason, never 0.
// Partner-reported numbers come ONLY from imported Associates reports (affiliate_conversions);
// no report covering the window => "unknown", never "zero".
import { createServerClient } from '@/lib/database';
import { fetchAllPaginated } from '@/lib/database/paginated-fetch';
import { DEFINITION_VERSION } from './registry';
import type { MetricValue } from './metrics';
import type { MetricWindow } from './windows';

export const CREATORS_API_THRESHOLD = 10;
const AMAZON_STORE_NAMES = new Set(['2', 'amazon', 'أمازون', 'أمازون السعودية', 'amazon.sa']);

export interface AmazonEligibility {
  cards: MetricValue[];
  trailing30: { start: string; end: string; shippedItems: number | null; orderedItems: number | null; reportCovers: boolean; progress: number | null };
  humanExits: { qualified: number; tagged: number; untagged: number; rawRows: number };
  reason: string | null;
}

type Row = Record<string, unknown>;
type Client = { from: (t: string) => any };

const metric = (id: string, w: MetricWindow, numerator: number | null, unit: MetricValue['unit'], denominator: number | null = null, reason?: string, lastEventAt: string | null = null): MetricValue => ({
  id, version: DEFINITION_VERSION,
  window: { kind: w.kind, start: w.start.toISOString(), end: w.end.toISOString(), partial: w.partial, labelAr: w.labelAr },
  numerator, denominator, unit, coverage: numerator == null ? 'unavailable' : 'complete', computedAt: new Date().toISOString(), lastEventAt, ...(reason ? { reason } : {}),
});

/** Pure: the trailing-30-day picture from imported conversions (order_date inside, shipped = ship_date set). */
export function trailing30FromConversions(rows: Array<{ source: string | null; order_date: string | null; ship_date: string | null; quantity: number | null; state: string | null }>, reportCovers: boolean, now = new Date()) {
  const end = now; const start = new Date(now.getTime() - 30 * 86_400_000);
  const inWindow = rows.filter((r) => (r.source ?? '').startsWith('amazon') && r.order_date && new Date(r.order_date) >= start && new Date(r.order_date) <= end && (r.state ?? '') !== 'returned');
  const orderedItems = inWindow.reduce((s, r) => s + (r.quantity ?? 1), 0);
  const shippedItems = inWindow.filter((r) => !!r.ship_date).reduce((s, r) => s + (r.quantity ?? 1), 0);
  return {
    start: start.toISOString(), end: end.toISOString(),
    orderedItems: reportCovers ? orderedItems : null, shippedItems: reportCovers ? shippedItems : null,
    reportCovers, progress: reportCovers ? Math.min(1, shippedItems / CREATORS_API_THRESHOLD) : null,
  };
}

export async function fetchAmazonEligibility(w: MetricWindow, now = new Date()): Promise<AmazonEligibility> {
  const sb = createServerClient() as unknown as Client;
  try {
    const clicks = await fetchAllPaginated<Row>((from, to) =>
      sb.from('outbound_clicks').select('id, store_name, destination_url, affiliate_tag, is_test, interaction_id, clicked_at')
        .gte('clicked_at', w.start.toISOString()).lte('clicked_at', w.end.toISOString()).order('id', { ascending: true }).range(from, to));
    const amazonClicks = clicks.filter((c) => !c.is_test && (AMAZON_STORE_NAMES.has(String(c.store_name ?? '').toLowerCase()) || /amazon\.sa/i.test(String(c.destination_url ?? ''))));
    const iids = amazonClicks.map((c) => c.interaction_id).filter((x): x is string => typeof x === 'string');
    const qualifiedIds = new Set<string>();
    for (let i = 0; i < iids.length; i += 200) {
      const slice = iids.slice(i, i + 200);
      const { data, error } = await sb.from('first_party_interactions').select('interaction_id, is_test').in('interaction_id', slice);
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as Row[]) if (!r.is_test) qualifiedIds.add(String(r.interaction_id));
    }
    const qualified = amazonClicks.filter((c) => typeof c.interaction_id === 'string' && qualifiedIds.has(c.interaction_id)).length;
    const tagged = amazonClicks.filter((c) => !!c.affiliate_tag).length;
    const lastClick = amazonClicks.reduce<string | null>((m, c) => (!m || String(c.clicked_at) > m ? String(c.clicked_at) : m), null);

    const { data: reports, error: rErr } = await sb.from('affiliate_reports').select('source, report_period_start, report_period_end');
    if (rErr) throw new Error(rErr.message);
    const t30start = new Date(now.getTime() - 30 * 86_400_000);
    const reportCovers = ((reports ?? []) as Row[]).some((r) => String(r.source ?? '').startsWith('amazon') && r.report_period_end && new Date(String(r.report_period_end)) >= t30start);
    const conversions = await fetchAllPaginated<Row>((from, to) => sb.from('affiliate_conversions').select('id, source, order_date, ship_date, quantity, state').order('id', { ascending: true }).range(from, to));
    const t30 = trailing30FromConversions(conversions as never, reportCovers, now);
    const inWindowOrders = reportCovers ? (conversions as Row[]).filter((r) => String(r.source ?? '').startsWith('amazon') && r.order_date && new Date(String(r.order_date)) >= w.start && new Date(String(r.order_date)) <= w.end).reduce((s, r) => s + Number(r.quantity ?? 1), 0) : null;

    return {
      cards: [
        metric('A01', w, qualified, 'interactions', null, undefined, lastClick),
        metric('A02', w, tagged, 'rows', null, undefined, lastClick),
        metric('A03', w, inWindowOrders, 'items', null, reportCovers ? undefined : 'لا تقرير أمازون مستورد يغطي النافذة'),
        metric('A04', w, t30.shippedItems, 'items', CREATORS_API_THRESHOLD, reportCovers ? undefined : 'لا تقرير أمازون مستورد يغطي آخر 30 يومًا'),
      ],
      trailing30: t30,
      humanExits: { qualified, tagged, untagged: amazonClicks.length - tagged, rawRows: amazonClicks.length },
      reason: null,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unknown error';
    return { cards: ['A01', 'A02', 'A03', 'A04'].map((id) => metric(id, w, null, id === 'A01' ? 'interactions' : id === 'A02' ? 'rows' : 'items', null, reason)), trailing30: { start: '', end: '', shippedItems: null, orderedItems: null, reportCovers: false, progress: null }, humanExits: { qualified: 0, tagged: 0, untagged: 0, rawRows: 0 }, reason };
  }
}
