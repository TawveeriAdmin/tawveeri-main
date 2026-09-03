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

import { createServerClient, fetchAllPaginated } from '@/lib/database';
import {
  APPROVED_STORE_IDS,
  COMPARISON_DISPLAY_EXCLUDED,
  resolveApprovedSlug,
} from '@/lib/retailers/approved-retailers';
import { getDecisionGradeOutboundStats } from './decision-grade-queries';

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
    outboundExits: Metric; // REAL outbound_clicks ledger rows — raw volume, NOT all attributable to a browsing session (see outboundExitsAttributed)
    // 2026-09-03 founder mission finding: a live, growing, unattributed redirect flood
    // (docs/report/SEPTEMBER-2026-EXECUTION-BASELINE.md §A.3, ADR-282) means most ledger
    // rows in an active window can carry no session_id at all — outboundExits alone reads
    // as customer demand when it may be almost entirely non-customer traffic. This is the
    // subset of outboundExits that DOES carry a session_id (stamped by /go from tw_sid) —
    // the only slice attributable to an actual browsing session, however small.
    //
    // LEGACY, NOT DECISION-GRADE (ADR-286): a session_id is a correlation signal from a
    // cookie, not proof a specific redirect was a deliberate click — kept only as a weaker,
    // always-available fallback for periods before decisionGrade below has real data (e.g.
    // pre-cutover, or before migrations 45/46 are applied). Prefer decisionGrade for any
    // founder-facing claim about real customer interaction volume.
    outboundExitsAttributed: Metric;
  };
  /** ADR-286 (third pass) — the actual decision-grade contract. Every count here required a
   *  real onClick to fire client-side (src/lib/analytics/interaction.ts) — never merely a
   *  rendered page, a valid render-token, a session cookie, or a browser-looking UA. Gracefully
   *  UNKNOWN (not zero) until migrations 45/46 are applied — see decision-grade-queries.ts. */
  decisionGrade7d: {
    firstPartyInteractions: Metric;
    merchantNavigationsCorrelated: Metric;
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

  // ADR-285: a bare `.limit(20000)` on a raw row fetch (as this query used to be) silently
  // truncates at PostgREST's db-max-rows=1000 once real volume crosses it — exactly the
  // defect measured in command-center-queries.ts's outbound-click count. Real 7-day session
  // volume here is currently well under 1000 but grows on the same traffic this file already
  // tracks elsewhere via safe exact head-counts, so this is fixed pre-emptively via explicit
  // pagination rather than waiting for it to silently go wrong. Failure stays non-fatal to the
  // rest of the page (this module's `Metric`/UNKNOWN convention), unlike a thrown pagination
  // error, which is why it is isolated in its own settled promise instead of joining the
  // head-count `Promise.all` below directly.
  const sessions7dSettled = fetchAllPaginated<{ session_id: string | null }>((from, to) =>
    supabase
      .from('usage_events')
      .select('session_id')
      .eq('is_test', false)
      .gte('created_at', iso7d)
      .order('id', { ascending: true })
      .range(from, to)
  ).then(
    (rows) => ({ ok: true as const, rows }),
    (error: unknown) => ({ ok: false as const, error })
  );

  // ADR-286 (third pass): isolated in its own settled promise, same rationale as
  // sessions7dSettled above — this queries a table (first_party_interactions) that does not
  // exist in production until migration 46 ships, and must not throw the whole page down with it.
  const decisionGrade7dSettled = getDecisionGradeOutboundStats(new Date(iso7d), new Date()).then(
    (stats) => ({ ok: true as const, stats }),
    (error: unknown) => ({ ok: false as const, error })
  );

  const [
    [
      storesCount,
      runs24h,
      failedRuns24h,
      lastEvent,
      projectionCount,
      comparableCount,
      fresh72h,
      listingsCount,
      searches7d,
      noAnswer7d,
      exits7d,
      exitsAttributed7d,
      exitsBaseline,
      taggedBaseline,
      conversions,
      usersCount,
      reviewQueue,
      freshPerStore,
    ],
    sessions7dResult,
    decisionGrade7dResult,
  ] = await Promise.all([
    Promise.all([
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
        .not('session_id', 'is', null)
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
    ]),
    sessions7dSettled,
    decisionGrade7dSettled,
  ]);

  // Distinct sessions computed in JS (PostgREST cannot count distinct).
  const sessions7d: Metric = sessions7dResult.ok
    ? {
        value: new Set(
          sessions7dResult.rows.map((r) => r.session_id).filter((s): s is string => Boolean(s))
        ).size,
      }
    : {
        value: null,
        reason: sessions7dResult.error instanceof Error ? sessions7dResult.error.message : String(sessions7dResult.error),
      };

  const decisionGrade7d = decisionGrade7dResult.ok
    ? decisionGrade7dResult.stats
    : {
        firstPartyInteractions: {
          value: null,
          reason: decisionGrade7dResult.error instanceof Error ? decisionGrade7dResult.error.message : String(decisionGrade7dResult.error),
        },
        merchantNavigationsCorrelated: {
          value: null,
          reason: decisionGrade7dResult.error instanceof Error ? decisionGrade7dResult.error.message : String(decisionGrade7dResult.error),
        },
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
      outboundExitsAttributed: metric(exitsAttributed7d.count, exitsAttributed7d.error),
    },
    decisionGrade7d,
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
  // 2026-09-03 founder mission finding: measured via npm run tps:sanity against production the
  // same day — a growing share of outbound_clicks rows carry no session_id (210 → 982 → 1888
  // such rows/day since 2026-08-31, still climbing as of this check). ROOT CAUSE NOT YET
  // CONFIRMED — see docs/report/SEPTEMBER-2026-EXECUTION-BASELINE.md §A.3/N.1 and the
  // 2026-09-03 containment investigation. Deliberately neutral wording: this counts what is
  // PROVEN (session-attributed vs not) and does not characterize the unattributed share as
  // bots, fraud, or "not customer traffic" — that determination is not yet established.
  // Never blocks or alters any redirect — detection/disclosure only.
  const rawExits = data.consumer7d.outboundExits.value;
  const attributedExits = data.consumer7d.outboundExitsAttributed.value;
  if (rawExits !== null && attributedExits !== null && rawExits >= 30 && attributedExits / rawExits < 0.2) {
    att.push({
      severity: 'critical',
      titleAr: `[خام] ${rawExits} خروج متجر مسجل — [منسوب] ${attributedExits} فقط مرتبط بمعرّف جلسة توفيري؛ والبقية غير منسوبة وقيد التحقيق`,
      titleEn: `[RAW] ${rawExits} raw retailer redirects — [ATTRIBUTED] ${attributedExits} carried a Tawveeri session ID; the remainder is unattributed and under investigation`,
      href: '/admin/command-center',
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
