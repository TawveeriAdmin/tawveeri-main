// src/lib/campaigns/revenue-proof-queries.ts
// Revenue Proof dashboard (final program, Phase 2). Three explicit truth layers, never
// merged into one misleading number (Phase 2 rule):
//   A. TAWVEERI OBSERVED — campaign_exposures / usage_events(campaign_impression) /
//      campaign_clicks. Decision-grade, ours, always known.
//   B. MERCHANT REPORTED — reused from the EXISTING affiliate_reports/affiliate_conversions
//      reconciliation infrastructure (scripts/database/30-affiliate-reconciliation.sql,
//      ADR-213), filtered by campaign.tracking_id against affiliate_conversions.tracking_id_raw
//      (Tracking-ID + report-period level, the officially-supported aggregate granularity
//      for Amazon — no new schema). UNKNOWN when no report has been imported yet, NEVER 0.
//   C. BUSINESS DECISION — derived states (PENDING/CONFIRMED/etc.), never inferred from a
//      tiny sample as false certainty.
import { untypedClient } from './store';
import type { AffiliateCampaign } from './types';
import { deriveCampaignStatus } from './types';

export interface CampaignHeader {
  campaign: AffiliateCampaign;
  status: ReturnType<typeof deriveCampaignStatus>;
  effectiveTrackingId: string; // campaign.tracking_id || shared default, Amazon only
  lastExposureAt: string | null;
  lastClickAt: string | null;
}

const SHARED_AMAZON_TAG = 'tawveeri0f-21';

export async function getCampaignHeader(campaignId: string): Promise<CampaignHeader | null> {
  const supabase = untypedClient();
  const { data: campaign, error } = await supabase.from('affiliate_campaigns').select('*').eq('id', campaignId).maybeSingle();
  if (error || !campaign) return null;

  const [{ data: lastExposure }, { data: lastClick }] = await Promise.all([
    supabase.from('campaign_exposures').select('created_at').eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(1),
    supabase.from('campaign_clicks').select('created_at').eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(1),
  ]);

  return {
    campaign,
    status: deriveCampaignStatus(campaign, new Date()),
    effectiveTrackingId: campaign.merchant === 'amazon' ? (campaign.tracking_id || SHARED_AMAZON_TAG) : (campaign.tracking_id || 'noon-default'),
    lastExposureAt: lastExposure?.[0]?.created_at ?? null,
    lastClickAt: lastClick?.[0]?.created_at ?? null,
  };
}

export interface TawveeriObserved {
  cleanEligibleExposures: number;
  visibleImpressions: number;
  cleanCampaignClicks: number;
  uniqueClickingSessions: number;
  clickThroughRate: number | null; // clicks / exposures, null when exposures = 0
  testInternalExcluded: number; // is_test rows excluded from the counts above
  botExcluded: number; // subset of testInternalExcluded flagged specifically by bot-UA detection
  topSessionConcentration: number | null; // this session's share of clean clicks, 0..1
  campaignErrors: number; // reserved — V1 has no distinct error ledger; always 0, not fabricated
  /** Amazon Decision Layer V2 §1D — clicks whose tw_campaign cookie carries a paid-medium
   *  utm_medium (see PAID_UTM_MEDIA). Excluded from cleanCampaignClicks/clickThroughRate:
   *  Amazon's paid-search policy status for Tawveeri is POLICY-AMBIGUOUS (V2 compliance
   *  audit), so a paid-origin session must never be silently folded into an "organic
   *  affiliate performance" claim either way, without blocking navigation for the
   *  shopper — segmentation happens only here, in the reporting layer. */
  paidOriginExcluded: number;
}

/** utm_medium values treated as paid acquisition for segmentation purposes — matches the
 *  vocabulary already used by the existing acquisition-attribution cookie (tw_campaign),
 *  not a new taxonomy. */
const PAID_UTM_MEDIA = new Set(['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'ads']);

/** Pure — true when an acquisition_campaign JSON value indicates paid-origin traffic. */
export function isPaidOriginAcquisition(acquisitionCampaign: Record<string, unknown> | null | undefined): boolean {
  if (!acquisitionCampaign) return false;
  const medium = String(acquisitionCampaign.utm_medium ?? '').toLowerCase();
  return PAID_UTM_MEDIA.has(medium);
}

/** Phase 2B. Reads campaign_exposures (ours, server-decided) + campaign_clicks
 *  (authoritative). Deliberately does NOT use usage_events as the denominator —
 *  usage_events carries the historical duplicate-event risk class documented in
 *  docs/report/SEPTEMBER-2026-EXECUTION-BASELINE.md §A.1; campaign_impression there
 *  is exposed separately as `visibleImpressions` for reference only, never as the
 *  authoritative funnel base. */
export async function getTawveeriObserved(
  campaignId: string,
  range: { start: Date; end: Date },
): Promise<TawveeriObserved> {
  const supabase = untypedClient();
  const startIso = range.start.toISOString();
  const endIso = range.end.toISOString();

  const [exposuresRes, testExposuresRes, clicksRes, testClicksRes, impressionsRes] = await Promise.all([
    supabase.from('campaign_exposures').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('is_test', false).gte('created_at', startIso).lte('created_at', endIso),
    supabase.from('campaign_exposures').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('is_test', true).gte('created_at', startIso).lte('created_at', endIso),
    supabase.from('campaign_clicks').select('session_id, acquisition_campaign').eq('campaign_id', campaignId).eq('is_test', false).gte('created_at', startIso).lte('created_at', endIso),
    supabase.from('campaign_clicks').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('is_test', true).gte('created_at', startIso).lte('created_at', endIso),
    supabase.from('usage_events').select('id', { count: 'exact', head: true }).eq('event_type', 'campaign_impression').eq('is_test', false).gte('created_at', startIso).lte('created_at', endIso),
  ]);

  const cleanEligibleExposures = exposuresRes.count ?? 0;
  const testExcludedExposures = testExposuresRes.count ?? 0;
  const allClickRows: { session_id: string | null; acquisition_campaign: Record<string, unknown> | null }[] = clicksRes.data ?? [];
  // §1D paid-search segmentation: a paid-origin click is excluded from the "clean"
  // organic count entirely, never silently folded into affiliate-performance claims.
  const paidOriginExcluded = allClickRows.filter((r) => isPaidOriginAcquisition(r.acquisition_campaign)).length;
  const clickRows = allClickRows.filter((r) => !isPaidOriginAcquisition(r.acquisition_campaign));
  const cleanCampaignClicks = clickRows.length;
  const testExcludedClicks = testClicksRes.count ?? 0;
  const visibleImpressions = impressionsRes.count ?? 0;

  const sessionCounts = new Map<string, number>();
  let anonymousClicks = 0;
  for (const row of clickRows) {
    if (!row.session_id) { anonymousClicks += 1; continue; }
    sessionCounts.set(row.session_id, (sessionCounts.get(row.session_id) ?? 0) + 1);
  }
  const uniqueClickingSessions = sessionCounts.size + (anonymousClicks > 0 ? anonymousClicks : 0);
  const topSessionClicks = sessionCounts.size > 0 ? Math.max(...sessionCounts.values()) : 0;
  const topSessionConcentration = cleanCampaignClicks > 0 ? topSessionClicks / cleanCampaignClicks : null;

  return {
    cleanEligibleExposures,
    visibleImpressions,
    cleanCampaignClicks,
    uniqueClickingSessions,
    clickThroughRate: cleanEligibleExposures > 0 ? cleanCampaignClicks / cleanEligibleExposures : null,
    testInternalExcluded: testExcludedExposures + testExcludedClicks,
    botExcluded: testExcludedClicks, // is_test folds in bot-UA detection (isKnownBotUserAgent) — no separate bucket in V1
    topSessionConcentration,
    campaignErrors: 0,
    paidOriginExcluded,
  };
}

export interface DestinationModeStat {
  mode: 'exact_product' | 'model_search' | 'category' | 'unknown';
  exposures: number;
  clicks: number;
  ctr: number | null;
}

export interface DifferentiationBreakdown {
  byMode: DestinationModeStat[];
  /** Share of exposures that fell back to plain category routing — the number the
   *  founder view needs to answer "does smarter routing outperform generic category
   *  routing," per Amazon Decision Layer V2.1 §10. Null when there are no exposures. */
  categoryOnlyPct: number | null;
  /** reason_code → count, across both exposures and clicks, most-frequent first. Surfaces
   *  fallback reasons / rejected unsafe exact matches / identity failures as real data,
   *  not just an inferred mode count. */
  reasonCodeCounts: { reasonCode: string; count: number }[];
}

/** Pure — the actual grouping/CTR/percentage math, split out from the DB read so it is
 *  directly unit-testable (same precedent as deriveBusinessDecisionState). */
export function deriveDifferentiationBreakdown(
  exposureModes: string[],
  clickModes: string[],
  reasonCodes: (string | null)[],
): DifferentiationBreakdown {
  const modes: DestinationModeStat['mode'][] = ['exact_product', 'model_search', 'category', 'unknown'];
  const countBy = (arr: string[], m: string) => arr.filter((x) => (x || 'unknown') === m).length;
  const byMode = modes.map((mode) => {
    const exposures = countBy(exposureModes, mode);
    const clicks = countBy(clickModes, mode);
    return { mode, exposures, clicks, ctr: exposures > 0 ? clicks / exposures : null };
  }).filter((s) => s.exposures > 0 || s.clicks > 0);

  const totalExposures = exposureModes.length;
  const categoryExposures = countBy(exposureModes, 'category');
  const categoryOnlyPct = totalExposures > 0 ? (categoryExposures / totalExposures) * 100 : null;

  const reasonCounts = new Map<string, number>();
  for (const r of reasonCodes) {
    if (!r) continue;
    reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
  }
  const reasonCodeCounts = Array.from(reasonCounts.entries())
    .map(([reasonCode, count]) => ({ reasonCode, count }))
    .sort((a, b) => b.count - a.count);

  return { byMode, categoryOnlyPct, reasonCodeCounts };
}

/** Amazon Decision Layer V2.1 §10 — reads campaign_exposures/campaign_clicks'
 *  destination_mode + reason_code (migrations 47/48), groups in JS (same convention as
 *  getDistinctCommissionDates in the revenue-proof page — small, campaign-scoped row
 *  counts, no need for a DB-side GROUP BY). */
export async function getDifferentiationBreakdown(
  campaignId: string,
  range: { start: Date; end: Date },
): Promise<DifferentiationBreakdown> {
  const supabase = untypedClient();
  const startIso = range.start.toISOString();
  const endIso = range.end.toISOString();
  const [exposuresRes, clicksRes] = await Promise.all([
    supabase.from('campaign_exposures').select('destination_mode, reason_code').eq('campaign_id', campaignId).eq('is_test', false).gte('created_at', startIso).lte('created_at', endIso),
    supabase.from('campaign_clicks').select('destination_mode, reason_code').eq('campaign_id', campaignId).eq('is_test', false).gte('created_at', startIso).lte('created_at', endIso),
  ]);
  const exposureRows: { destination_mode: string | null; reason_code: string | null }[] = exposuresRes.data ?? [];
  const clickRows: { destination_mode: string | null; reason_code: string | null }[] = clicksRes.data ?? [];
  return deriveDifferentiationBreakdown(
    exposureRows.map((r) => r.destination_mode || 'unknown'),
    clickRows.map((r) => r.destination_mode || 'unknown'),
    [...exposureRows.map((r) => r.reason_code), ...clickRows.map((r) => r.reason_code)],
  );
}

export type MerchantReportedAmazon =
  | { status: 'unknown' }
  | {
      status: 'known';
      trackingId: string;
      networkReportedClicks: number | null; // Amazon's own click count, if the report carries one
      orderedItems: number;
      shippedItems: number;
      cancelledOrReturned: number;
      qualifyingRevenueSar: number | null;
      commissionSar: number;
      reportPeriodStart: string | null;
      reportPeriodEnd: string | null;
      lastImportedAt: string | null;
    };

/**
 * Phase 2C. Reuses affiliate_reports/affiliate_conversions (ADR-213) UNCHANGED — no new
 * schema. Reconciles at TRACKING ID level (affiliate_conversions.tracking_id_raw), the
 * officially-supported Amazon aggregate granularity — never a fabricated Tawveeri-visitor
 * <-> Amazon-customer join. Returns {status:'unknown'} rather than zeros whenever no
 * report row exists for this tracking id — UNKNOWN ≠ ZERO is enforced structurally here,
 * not left to the caller to remember.
 */
export async function getMerchantReportedAmazon(trackingId: string): Promise<MerchantReportedAmazon> {
  const supabase = untypedClient();
  const { data: conversions, error } = await supabase
    .from('affiliate_conversions')
    .select('*, affiliate_reports(report_period_start, report_period_end, created_at)')
    .eq('tracking_id_raw', trackingId);

  if (error || !conversions || conversions.length === 0) return { status: 'unknown' };

  let ordered = 0, shipped = 0, cancelledOrReturned = 0, commission = 0, revenue = 0;
  let periodStart: string | null = null, periodEnd: string | null = null, lastImported: string | null = null;
  for (const row of conversions as Record<string, any>[]) {
    const state = String(row.state || '').toUpperCase();
    if (state === 'ORDERED' || state === 'COMMISSION_PENDING') ordered += 1;
    if (state === 'SHIPPED' || state === 'COMMISSION_CONFIRMED' || state === 'PAID') shipped += 1;
    if (state === 'CANCELLED' || state === 'RETURNED') cancelledOrReturned += 1;
    if (typeof row.commission_amount === 'number') commission += row.commission_amount;
    if (typeof row.price === 'number' && typeof row.quantity === 'number') revenue += row.price * row.quantity;
    const report = Array.isArray(row.affiliate_reports) ? row.affiliate_reports[0] : row.affiliate_reports;
    if (report?.report_period_start && (!periodStart || report.report_period_start < periodStart)) periodStart = report.report_period_start;
    if (report?.report_period_end && (!periodEnd || report.report_period_end > periodEnd)) periodEnd = report.report_period_end;
    if (report?.created_at && (!lastImported || report.created_at > lastImported)) lastImported = report.created_at;
  }

  return {
    status: 'known',
    trackingId,
    networkReportedClicks: null, // Amazon's Earnings/Orders report exports do not carry a per-row click count
    orderedItems: ordered,
    shippedItems: shipped,
    cancelledOrReturned,
    qualifyingRevenueSar: revenue > 0 ? revenue : null,
    commissionSar: commission,
    reportPeriodStart: periodStart,
    reportPeriodEnd: periodEnd,
    lastImportedAt: lastImported,
  };
}

export type ProofState = 'PENDING' | 'CONFIRMED';
export type SignalState = 'PENDING' | 'EARLY' | 'CONFIRMED';
export type SustainabilityState = 'PENDING' | 'PARTIAL' | 'COVERED';

export interface BusinessDecisionState {
  mechanicsProof: ProofState;
  revenueProof: ProofState;
  repeatabilitySignal: SignalState;
  repeatableMonetization: SignalState;
  sustainability: SustainabilityState;
  incrementality: 'NOT_YET_TESTED';
}

/**
 * Phase 2D / Phase 5 definitions, applied literally — never inferred from a tiny sample
 * as false certainty. Pure function, fully unit-testable.
 */
export function deriveBusinessDecisionState(args: {
  observed: TawveeriObserved;
  merchant: MerchantReportedAmazon;
  distinctCommissionDates: number; // count of distinct calendar dates with commission > 0, across ALL history
  coveragePct: number | null; // from computeOperatingCostCoverage, trailing 30d
  consecutiveCoveredMonths: number; // months with >=100% coverage, most recent first, unbroken
}): BusinessDecisionState {
  const { observed, merchant, distinctCommissionDates, coveragePct, consecutiveCoveredMonths } = args;

  const mechanicsProof: ProofState =
    observed.cleanEligibleExposures > 0 && observed.cleanCampaignClicks > 0 ? 'CONFIRMED' : 'PENDING';

  const revenueProof: ProofState = merchant.status === 'known' && merchant.commissionSar > 0 ? 'CONFIRMED' : 'PENDING';

  let repeatabilitySignal: SignalState = 'PENDING';
  if (revenueProof === 'CONFIRMED') repeatabilitySignal = distinctCommissionDates >= 2 ? 'CONFIRMED' : 'EARLY';

  // Repeatable monetization requires the signal PLUS the funnel still working (clicks
  // still occurring) — a single confirmed-then-silent campaign is EARLY, not CONFIRMED.
  let repeatableMonetization: SignalState = 'PENDING';
  if (repeatabilitySignal === 'CONFIRMED' && observed.cleanCampaignClicks > 0) repeatableMonetization = 'CONFIRMED';
  else if (repeatabilitySignal !== 'PENDING') repeatableMonetization = 'EARLY';

  let sustainability: SustainabilityState = 'PENDING';
  if (coveragePct !== null) {
    sustainability = consecutiveCoveredMonths >= 2 ? 'COVERED' : coveragePct > 0 ? 'PARTIAL' : 'PENDING';
  }

  return { mechanicsProof, revenueProof, repeatabilitySignal, repeatableMonetization, sustainability, incrementality: 'NOT_YET_TESTED' };
}

export type ReconciliationStatus = 'CONFIRMED' | 'PARTIAL' | 'NOT_YET_AVAILABLE' | 'UNKNOWN';

export interface PortfolioRow {
  campaignId: string;
  category: string; // categories[0] || '(untargeted)'
  trackingId: string;
  enabled: boolean;
  tawveeriClicks30d: number;
  tawveeriExposures30d: number;
  merchantStatus: MerchantReportedAmazon['status'];
  merchantOrderedItems: number | null;
  merchantCommissionSar: number | null;
  merchantReportPeriodEnd: string | null;
  reconciliation: ReconciliationStatus;
}

/** Pure — never calls an unimported report "0 revenue". Extracted so the rule itself is
 *  directly unit-testable without a live Supabase client (deriveBusinessDecisionState's
 *  own precedent). */
export function deriveReconciliationStatus(merchant: MerchantReportedAmazon): ReconciliationStatus {
  if (merchant.status === 'unknown') return 'NOT_YET_AVAILABLE';
  if ((merchant.orderedItems ?? 0) > 0 || (merchant.shippedItems ?? 0) > 0) return 'CONFIRMED';
  return 'PARTIAL';
}

/**
 * Amazon Decision Layer V2 §8 — one row per LIVE campaign, reusing getTawveeriObserved
 * and getMerchantReportedAmazon exactly as the single-campaign view does (no new query
 * logic, no new attribution join). `reconciliation` never calls an unimported report "0
 * revenue": NOT_YET_AVAILABLE when no report has been imported for that Tracking ID at
 * all, PARTIAL when a report exists but shows no ordered/shipped items yet for this
 * specific tracking id, CONFIRMED when at least one ordered/shipped item is reported.
 */
export async function getPortfolioSummary(): Promise<PortfolioRow[]> {
  const supabase = untypedClient();
  const { data: campaigns } = await supabase
    .from('affiliate_campaigns')
    .select('id, categories, tracking_id, merchant, enabled, start_at, end_at')
    .eq('merchant', 'amazon')
    .order('created_at', { ascending: true });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const rows: PortfolioRow[] = [];

  for (const c of (campaigns || []) as AffiliateCampaign[]) {
    if (deriveCampaignStatus(c, now) !== 'live' && !c.enabled) continue; // skip only truly inert rows, keep scheduled/expired-but-enabled visible
    const effectiveTrackingId = c.tracking_id || SHARED_AMAZON_TAG;
    const [observed, merchant] = await Promise.all([
      getTawveeriObserved(c.id, { start: thirtyDaysAgo, end: now }),
      getMerchantReportedAmazon(effectiveTrackingId),
    ]);

    const reconciliation = deriveReconciliationStatus(merchant);

    rows.push({
      campaignId: c.id,
      category: c.categories[0] || '(untargeted)',
      trackingId: effectiveTrackingId,
      enabled: c.enabled,
      tawveeriClicks30d: observed.cleanCampaignClicks,
      tawveeriExposures30d: observed.cleanEligibleExposures,
      merchantStatus: merchant.status,
      merchantOrderedItems: merchant.status === 'known' ? merchant.orderedItems : null,
      merchantCommissionSar: merchant.status === 'known' ? merchant.commissionSar : null,
      merchantReportPeriodEnd: merchant.status === 'known' ? merchant.reportPeriodEnd : null,
      reconciliation,
    });
  }
  return rows;
}

export interface OperatingCostCoverage {
  configured: boolean;
  monthlyCostSar: number | null;
  trailing30dEarnedCommissionSar: number | null;
  coveragePct: number | null;
}

/** Phase 2E. Cost is read from an env var (TAWVEERI_MONTHLY_CASH_COST_SAR) — same
 *  "no settings table exists yet" precedent as the campaign kill switch. Earned
 *  commission (accrual) is kept explicitly separate from any notion of cash paid
 *  (network payout timing differs), per the mission's own instruction. */
export function computeOperatingCostCoverage(trailing30dEarnedCommissionSar: number | null): OperatingCostCoverage {
  const raw = process.env.TAWVEERI_MONTHLY_CASH_COST_SAR;
  const monthlyCostSar = raw ? Number(raw) : null;
  const configured = monthlyCostSar !== null && Number.isFinite(monthlyCostSar) && monthlyCostSar > 0;
  if (!configured || trailing30dEarnedCommissionSar === null) {
    return { configured, monthlyCostSar: configured ? monthlyCostSar : null, trailing30dEarnedCommissionSar, coveragePct: null };
  }
  return {
    configured: true,
    monthlyCostSar,
    trailing30dEarnedCommissionSar,
    coveragePct: (trailing30dEarnedCommissionSar / (monthlyCostSar as number)) * 100,
  };
}
