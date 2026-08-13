// Founder operating picture — governed queries (founder mission 2026-08-13).
//
// Every number on /admin/dashboard traces to a named production source through
// this module, and every query failure surfaces as UNKNOWN (value: null with a
// reason) — never as 0. The previous dashboard rendered failed queries as
// zeros (`count || 0`), hardcoded "System state: stable", computed an
// "activity rate" from two empty tables, and injected Math.random() sparklines.
//
// Metric semantics (docs/METRIC_DEFINITIONS.md governs the commercial ones):
// - value: number  → measured (0 is a TRUE measured zero)
// - value: null    → UNKNOWN / not measured; `reason` says why
// REAL-only where the source distinguishes test traffic (is_test = false).

import { createServerClient } from '@/lib/database';
import {
  APPROVED_STORE_IDS,
  COMPARISON_DISPLAY_EXCLUDED,
  resolveApprovedSlug,
} from '@/lib/retailers/approved-retailers';

export interface Metric {
  value: number | null;
  reason?: string; // set only when value is null
}

export interface AttentionItem {
  severity: 'critical' | 'warn';
  titleAr: string;
  titleEn: string;
  href?: string;
}

export interface FounderHomeData {
  system: {
    lastEventMinutesAgo: Metric; // usage_events recency — is measurement alive?
    scrapingRuns24h: Metric;
    failedRuns24h: Metric;
    freshApprovedSources24h: Metric; // approved sources with an observation < 24h
    approvedSourcesTotal: number;
  };
  retailers: {
    registeredRows: Metric; // every row in `stores`, incl. dead experiments
    approvedForIngestion: number; // code registry (APPROVED_STORE_IDS)
    customerDisplayable: number; // approved minus display-excluded
    affiliateEnabled: number; // provider registry monetization (amazon, noon)
  };
  catalog: {
    canonicalProducts: Metric; // tps_product_projection rows
    comparableProducts: Metric; // has_comparison = true (≥2 displayable retailers)
    freshCanonicals72h: Metric; // last_observed_at < 72h
    storefrontListings: Metric; // product_stores rows (legacy storefront layer)
  };
  consumer7d: {
    sessions: Metric; // REAL distinct session_id
    searches: Metric; // REAL search + advisor_query events (raw, not deduped)
    noAnswer: Metric;
    outboundExits: Metric; // REAL outbound_clicks ledger rows
  };
  commercial: {
    exitsSinceBaseline: Metric; // REAL ledger rows since COMMERCIAL_BASELINE
    affiliateTaggedExits: Metric; // REAL rows with affiliate_program != 'direct'
    affiliateConversions: Metric; // affiliate_conversions rows — 0 until a report import
    confirmedCommission: Metric; // UNAVAILABLE until reconciliation exists
  };
  users: {
    registeredAccounts: Metric; // NOT a usage metric — accounts are optional
  };
  attention: AttentionItem[];
  generatedAt: string;
}

// ADR-216: the official commercial baseline. Numbers before it are pre-launch.
const COMMERCIAL_BASELINE_ISO = '2026-08-06T00:00:00Z';
const TRACKING_STALL_MINUTES = 6 * 60;

const metric = (count: number | null, error?: { message: string } | null): Metric =>
  error ? { value: null, reason: error.message } : { value: count ?? 0 };

export async function getFounderHomeData(): Promise<FounderHomeData> {
  // types.ts describes the legacy application schema; several of these tables
  // (tps_product_projection, usage_events, outbound_clicks, growth_content)
  // exist only in production's knowledge schema — same untyped-client pattern
  // as the other governed admin query modules (ADR-122).
  const supabase = createServerClient() as any;
  const iso24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const iso72h = new Date(Date.now() - 72 * 3600_000).toISOString();
  const iso7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const approvedIds = [...APPROVED_STORE_IDS];
  // displayable = ingestion-approved AND not display-excluded (same resolver
  // the customer-facing display gate uses — no duplicated id→slug knowledge).
  const displayableSlugs = approvedIds
    .map((id) => resolveApprovedSlug(id))
    .filter((s): s is string => s !== null && !COMPARISON_DISPLAY_EXCLUDED.has(s));

  const [
    storesCount,
    runs24h,
    failedRuns24h,
    lastEvent,
    projectionCount,
    comparableCount,
    fresh72h,
    listingsCount,
    sessions7dRows,
    searches7d,
    noAnswer7d,
    exits7d,
    exitsBaseline,
    taggedBaseline,
    conversions,
    usersCount,
    reviewQueue,
    freshPerStore,
  ] = await Promise.all([
    supabase.from('stores').select('id', { count: 'exact', head: true }),
    supabase
      .from('scraping_runs')
      .select('id', { count: 'exact', head: true })
      .gte('started_at', iso24h),
    supabase
      .from('scraping_runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('started_at', iso24h),
    supabase
      .from('usage_events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('tps_product_projection').select('id', { count: 'exact', head: true }),
    supabase
      .from('tps_product_projection')
      .select('id', { count: 'exact', head: true })
      .eq('has_comparison', true),
    supabase
      .from('tps_product_projection')
      .select('id', { count: 'exact', head: true })
      .gte('last_observed_at', iso72h),
    supabase.from('product_stores').select('id', { count: 'exact', head: true }),
    supabase
      .from('usage_events')
      .select('session_id')
      .eq('is_test', false)
      .gte('created_at', iso7d)
      .limit(20000),
    supabase
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('is_test', false)
      .in('event_type', ['search', 'advisor_query'])
      .gte('created_at', iso7d),
    supabase
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('is_test', false)
      .eq('event_type', 'no_answer')
      .gte('created_at', iso7d),
    supabase
      .from('outbound_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('is_test', false)
      .gte('clicked_at', iso7d),
    supabase
      .from('outbound_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('is_test', false)
      .gte('clicked_at', COMMERCIAL_BASELINE_ISO),
    supabase
      .from('outbound_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('is_test', false)
      .neq('affiliate_program', 'direct')
      .gte('clicked_at', COMMERCIAL_BASELINE_ISO),
    supabase.from('affiliate_conversions').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase
      .from('growth_content')
      .select('content_id', { count: 'exact', head: true })
      .eq('status', 'ready_for_review'),
    // Approved sources with a fresh price observation (<24h) — one cheap
    // head-count per approved source, keyed on canonical store_id.
    Promise.all(
      approvedIds.map((id) =>
        supabase
          .from('price_history')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', id)
          .gte('observed_at', iso24h)
          .then((r: { count: number | null; error: { message: string } | null }) => ({
            id,
            fresh: !r.error && (r.count ?? 0) > 0,
            error: r.error,
          }))
      )
    ),
  ]);

  // Distinct sessions computed in JS (PostgREST cannot count distinct).
  const sessions7d: Metric = sessions7dRows.error
    ? { value: null, reason: sessions7dRows.error.message }
    : {
        value: new Set(
          ((sessions7dRows.data ?? []) as Array<{ session_id: string }>).map(
            (r) => r.session_id
          )
        ).size,
      };

  const anyFreshError = freshPerStore.find((r: { error: unknown }) => r.error);
  const freshApproved: Metric = anyFreshError
    ? { value: null, reason: (anyFreshError.error as { message: string }).message }
    : { value: freshPerStore.filter((r: { fresh: boolean }) => r.fresh).length };

  const lastEventAt = lastEvent.data?.[0]?.created_at ?? null;
  const lastEventMinutesAgo: Metric = lastEvent.error
    ? { value: null, reason: lastEvent.error.message }
    : lastEventAt
      ? { value: Math.round((Date.now() - new Date(lastEventAt).getTime()) / 60000) }
      : { value: null, reason: 'no events recorded' };

  const data: FounderHomeData = {
    system: {
      lastEventMinutesAgo,
      scrapingRuns24h: metric(runs24h.count, runs24h.error),
      failedRuns24h: metric(failedRuns24h.count, failedRuns24h.error),
      freshApprovedSources24h: freshApproved,
      approvedSourcesTotal: approvedIds.length,
    },
    retailers: {
      registeredRows: metric(storesCount.count, storesCount.error),
      approvedForIngestion: approvedIds.length,
      customerDisplayable: displayableSlugs.length,
      affiliateEnabled: 2, // Provider Registry monetization: amazon + noon (ADR-212/230)
    },
    catalog: {
      canonicalProducts: metric(projectionCount.count, projectionCount.error),
      comparableProducts: metric(comparableCount.count, comparableCount.error),
      freshCanonicals72h: metric(fresh72h.count, fresh72h.error),
      storefrontListings: metric(listingsCount.count, listingsCount.error),
    },
    consumer7d: {
      sessions: sessions7d,
      searches: metric(searches7d.count, searches7d.error),
      noAnswer: metric(noAnswer7d.count, noAnswer7d.error),
      outboundExits: metric(exits7d.count, exits7d.error),
    },
    commercial: {
      exitsSinceBaseline: metric(exitsBaseline.count, exitsBaseline.error),
      affiliateTaggedExits: metric(taggedBaseline.count, taggedBaseline.error),
      affiliateConversions: metric(conversions.count, conversions.error),
      confirmedCommission: {
        value: null,
        reason: 'no affiliate report imported yet — commission is only ever network-reported, never inferred',
      },
    },
    users: {
      registeredAccounts: metric(usersCount.count, usersCount.error),
    },
    attention: [],
    generatedAt: new Date().toISOString(),
  };

  // ── Attention list: derived from measurements, never decorative ──
  const att = data.attention;
  if (
    data.system.lastEventMinutesAgo.value !== null &&
    data.system.lastEventMinutesAgo.value > TRACKING_STALL_MINUTES
  ) {
    att.push({
      severity: 'critical',
      titleAr: `تتبع الاستخدام متوقف — آخر حدث قبل ${Math.round(data.system.lastEventMinutesAgo.value / 60)} ساعة`,
      titleEn: `Usage tracking stalled — last event ${Math.round(data.system.lastEventMinutesAgo.value / 60)}h ago`,
    });
  }
  if (data.system.lastEventMinutesAgo.value === null) {
    att.push({
      severity: 'critical',
      titleAr: 'تعذر قراءة تتبع الاستخدام',
      titleEn: 'Usage tracking unreadable',
    });
  }
  const fresh = data.system.freshApprovedSources24h.value;
  if (fresh !== null && fresh < approvedIds.length) {
    att.push({
      severity: 'warn',
      titleAr: `${approvedIds.length - fresh} من ${approvedIds.length} مصدراً معتمداً بلا تحديث خلال 24 ساعة`,
      titleEn: `${approvedIds.length - fresh} of ${approvedIds.length} approved sources not refreshed in 24h`,
      href: '/admin/scraping/health',
    });
  }
  if ((data.system.failedRuns24h.value ?? 0) > 0) {
    att.push({
      severity: 'warn',
      titleAr: `${data.system.failedRuns24h.value} تشغيل استيعاب فاشل خلال 24 ساعة`,
      titleEn: `${data.system.failedRuns24h.value} failed ingestion runs in 24h`,
      href: '/admin/scraping/runs',
    });
  }
  if (!reviewQueue.error && (reviewQueue.count ?? 0) > 0) {
    att.push({
      severity: 'warn',
      titleAr: `${reviewQueue.count} محتوى نمو بانتظار مراجعتك`,
      titleEn: `${reviewQueue.count} growth item awaiting your review`,
      href: '/admin/growth',
    });
  }

  return data;
}
