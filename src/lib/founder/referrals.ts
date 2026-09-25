// src/lib/founder/referrals.ts — stores, referrals and partner outcomes, as SEPARATE proof stages:
//   recorded click (usage_events go_click) → matched /go row (I⋈O) → merchant-reported arrival
//   (not available from /go) → partner-reported order → commission pending/confirmed/cancelled/paid.
import { createServerClient } from '@/lib/database';
import { getProviderByStoreId, listProviders } from '@/lib/providers/registry';
import { resolveApprovedSlug } from '@/lib/retailers/approved-retailers';
import type { MetricWindow } from './windows';

type AnyClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

interface FunnelRow { store_name: string | null; utm_source: string; utm_campaign: string; raw_rows: number; rows_with_session: number; linked_interactions: number; linked_sessions: number; products: number }
interface GoClickRow { store: string; events: number; sessions: number }

export interface StoreStage {
  slug: string; nameAr: string; affiliate: boolean;
  recordedClicks: number; recordedClickBrowsers: number;
  rawRows: number; rowsWithSession: number; linkedInteractions: number; linkedBrowsers: number; products: number;
  arrivalAr: 'غير متاح من /go'; partnerOrders: number | null; partnerCommissionSar: number | null;
  channels: Array<{ channel: string; campaign: string; linked: number; raw: number }>;
}

export interface ReferralsData {
  ok: boolean; reason?: string;
  stores: StoreStage[];
  byChannel: Array<{ channel: string; linked: number; linkedBrowsers: number; raw: number }>;
  totals: { rawRows: number; rowsWithSession: number; linkedInteractions: number; recordedClicks: number };
}

// outbound_clicks.store_name mixes numeric ids ("4"), slugs and Arabic/English display names
// (ADR-135's column instability). Resolve through BOTH existing authorities: the approved-retailer
// name map (display strings → slug) and the provider registry (numeric id → provider), then look
// the provider up by slug — getProviderByStoreId() only understands numeric ids.
function storeKey(name: string | null): { slug: string; nameAr: string; affiliate: boolean } {
  const byId = getProviderByStoreId(name ?? '');
  const slug = byId?.slug ?? resolveApprovedSlug(name) ?? (name ? name.trim().toLowerCase() : 'unknown');
  const provider = byId ?? listProviders().find((p) => p.slug === slug) ?? null;
  return { slug, nameAr: provider ? (provider.displayNameAr || provider.displayName) : (name ?? 'غير معروف'), affiliate: !!provider?.affiliate };
}

export async function fetchReferrals(w: MetricWindow): Promise<ReferralsData> {
  const empty: ReferralsData = { ok: false, stores: [], byChannel: [], totals: { rawRows: 0, rowsWithSession: 0, linkedInteractions: 0, recordedClicks: 0 } };
  try {
    const supabase = createServerClient() as unknown as AnyClient;
    const args = { p_start: w.start.toISOString(), p_end: w.end.toISOString() };
    const [funnel, clicks] = await Promise.all([supabase.rpc('founder_store_funnel', args), supabase.rpc('founder_store_go_clicks', args)]);
    if (funnel.error) return { ...empty, reason: funnel.error.message };
    if (clicks.error) return { ...empty, reason: clicks.error.message };
    const stores = new Map<string, StoreStage>();
    const ensure = (name: string | null) => {
      const k = storeKey(name);
      let s = stores.get(k.slug);
      if (!s) {
        s = { ...k, recordedClicks: 0, recordedClickBrowsers: 0, rawRows: 0, rowsWithSession: 0, linkedInteractions: 0, linkedBrowsers: 0, products: 0, arrivalAr: 'غير متاح من /go', partnerOrders: null, partnerCommissionSar: null, channels: [] };
        stores.set(k.slug, s);
      }
      return s;
    };
    const channelAgg = new Map<string, { linked: number; linkedBrowsers: number; raw: number }>();
    const totals = { rawRows: 0, rowsWithSession: 0, linkedInteractions: 0, recordedClicks: 0 };
    for (const r of (funnel.data ?? []) as FunnelRow[]) {
      const s = ensure(r.store_name);
      s.rawRows += n(r.raw_rows); s.rowsWithSession += n(r.rows_with_session); s.linkedInteractions += n(r.linked_interactions); s.linkedBrowsers += n(r.linked_sessions);
      s.products = Math.max(s.products, n(r.products));
      s.channels.push({ channel: r.utm_source, campaign: r.utm_campaign, linked: n(r.linked_interactions), raw: n(r.raw_rows) });
      totals.rawRows += n(r.raw_rows); totals.rowsWithSession += n(r.rows_with_session); totals.linkedInteractions += n(r.linked_interactions);
      const c = channelAgg.get(r.utm_source) ?? { linked: 0, linkedBrowsers: 0, raw: 0 };
      c.linked += n(r.linked_interactions); c.linkedBrowsers += n(r.linked_sessions); c.raw += n(r.raw_rows);
      channelAgg.set(r.utm_source, c);
    }
    for (const r of (clicks.data ?? []) as GoClickRow[]) {
      const s = ensure(r.store);
      s.recordedClicks += n(r.events); s.recordedClickBrowsers += n(r.sessions); totals.recordedClicks += n(r.events);
    }
    for (const s of stores.values()) s.channels.sort((a, b) => b.linked - a.linked || b.raw - a.raw);
    return {
      ok: true,
      stores: [...stores.values()].sort((a, b) => b.linkedInteractions - a.linkedInteractions || b.recordedClicks - a.recordedClicks || b.rawRows - a.rawRows),
      byChannel: [...channelAgg.entries()].map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.linked - a.linked),
      totals,
    };
  } catch (e) { return { ...empty, reason: e instanceof Error ? e.message : 'unknown' }; }
}
