// src/app/[locale]/admin/campaigns/revenue-proof/page.tsx
// REVENUE PROOF — Affiliate Campaigns (final program, Phase 2). Server component:
// /admin/* is already middleware-protected (requires admin role), so no separate
// auth check is needed here — same trust boundary as every other /admin page.
// Three explicit, never-merged truth layers (A/B/C) per the mission's own rule.
import { untypedClient } from '@/lib/campaigns/store';
import {
  getCampaignHeader, getTawveeriObserved, getMerchantReportedAmazon, getPortfolioSummary, getDifferentiationBreakdown,
  deriveBusinessDecisionState, computeOperatingCostCoverage,
} from '@/lib/campaigns/revenue-proof-queries';

function fmt(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'ok' | 'pending' | 'warn' }) {
  const colors = { ok: '#0a7a4d', pending: '#8a7300', warn: '#8a2f00' } as const;
  return <span style={{ fontWeight: 800, fontSize: 12, color: colors[tone], border: `1px solid ${colors[tone]}`, borderRadius: 6, padding: '2px 8px' }}>{children}</span>;
}

async function getDistinctCommissionDates(trackingId: string): Promise<number> {
  const supabase = untypedClient();
  const { data } = await supabase.from('affiliate_conversions').select('order_date, commission_amount').eq('tracking_id_raw', trackingId);
  const dates = new Set((data ?? []).filter((r: any) => (r.commission_amount ?? 0) > 0 && r.order_date).map((r: any) => r.order_date));
  return dates.size;
}

export default async function RevenueProofPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ campaign?: string }>;
}) {
  await params;
  const { campaign: campaignIdParam } = await searchParams;

  const supabase = untypedClient();
  const { data: allCampaigns } = await supabase.from('affiliate_campaigns').select('id, title_en, merchant, created_at').order('created_at', { ascending: false });
  const campaignId = campaignIdParam || allCampaigns?.[0]?.id;

  if (!campaignId) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900 }}>Revenue Proof — Affiliate Campaigns</h1>
        <p>No campaigns exist yet. Create one in <a href="../">Affiliate Campaigns</a>.</p>
      </div>
    );
  }

  const header = await getCampaignHeader(campaignId);
  if (!header) return <div style={{ padding: 24 }}>Campaign not found.</div>;

  const portfolio = await getPortfolioSummary();
  const RECON_TONE: Record<string, 'ok' | 'pending' | 'warn'> = {
    CONFIRMED: 'ok', PARTIAL: 'pending', NOT_YET_AVAILABLE: 'pending', UNKNOWN: 'warn',
  };

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const allTime = new Date('2020-01-01');

  const [observed30d, observedAllTime, merchant, distinctDates, differentiation] = await Promise.all([
    getTawveeriObserved(campaignId, { start: thirtyDaysAgo, end: now }),
    getTawveeriObserved(campaignId, { start: allTime, end: now }),
    getMerchantReportedAmazon(header.effectiveTrackingId),
    getDistinctCommissionDates(header.effectiveTrackingId),
    getDifferentiationBreakdown(campaignId, { start: allTime, end: now }),
  ]);

  const trailing30dCommission = merchant.status === 'known' ? merchant.commissionSar : null;
  const costCoverage = computeOperatingCostCoverage(trailing30dCommission);
  const decision = deriveBusinessDecisionState({
    observed: observedAllTime,
    merchant,
    distinctCommissionDates: distinctDates,
    coveragePct: costCoverage.coveragePct,
    consecutiveCoveredMonths: 0, // V1: no historical month-over-month store yet — never fabricated
  });

  const c = header.campaign;

  return (
    <div style={{ padding: 24, maxWidth: 900, fontFamily: 'sans-serif', fontSize: 14, lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Revenue Proof — Affiliate Campaigns</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>Three separate truth layers. Never combined into one number.</p>

      {/* Amazon Decision Layer V2 §8 / Noon Wave 1 — portfolio-wide summary across every
          live/scheduled campaign of ANY merchant, additive to (never replacing) the
          per-campaign detail below. See /admin/campaigns/commerce for the dedicated
          Amazon × Noon side-by-side comparison view. */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Portfolio — All Campaigns <span style={{ fontWeight: 400, fontSize: 12 }}>(clicks/exposures: trailing 30 days)</span></h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '4px 8px' }}>Merchant</th>
                <th style={{ padding: '4px 8px' }}>Category</th>
                <th style={{ padding: '4px 8px' }}>Tracking ID</th>
                <th style={{ padding: '4px 8px' }}>Exposures</th>
                <th style={{ padding: '4px 8px' }}>Clicks</th>
                <th style={{ padding: '4px 8px' }}>Merchant status</th>
                <th style={{ padding: '4px 8px' }}>Ordered items</th>
                <th style={{ padding: '4px 8px' }}>Commission (SAR)</th>
                <th style={{ padding: '4px 8px' }}>Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((row) => (
                <tr key={row.campaignId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '4px 8px', textTransform: 'capitalize' }}>{row.merchant}</td>
                  <td style={{ padding: '4px 8px' }}><a href={`?campaign=${row.campaignId}`}>{row.category}</a></td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>{row.trackingId}</td>
                  <td style={{ padding: '4px 8px' }}>{fmt(row.tawveeriExposures30d)}</td>
                  <td style={{ padding: '4px 8px' }}>{fmt(row.tawveeriClicks30d)}</td>
                  <td style={{ padding: '4px 8px' }}>{row.merchantStatus === 'known' ? 'imported' : 'not imported'}</td>
                  <td style={{ padding: '4px 8px' }}>{row.merchantOrderedItems === null ? '—' : fmt(row.merchantOrderedItems)}</td>
                  <td style={{ padding: '4px 8px' }}>{row.merchantCommissionSar === null ? '—' : fmt(row.merchantCommissionSar, 2)}</td>
                  <td style={{ padding: '4px 8px' }}><Badge tone={RECON_TONE[row.reconciliation]}>{row.reconciliation.replace(/_/g, ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 10, fontSize: 11, color: '#888' }}>
          NOT YET AVAILABLE = no Amazon Associates report imported for that Tracking ID yet — never treated as zero revenue.
        </p>
      </section>

      {allCampaigns && allCampaigns.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          {allCampaigns.map((cc: any) => (
            <a key={cc.id} href={`?campaign=${cc.id}`} style={{ marginInlineEnd: 12, fontWeight: cc.id === campaignId ? 900 : 400 }}>
              {cc.title_en} ({cc.merchant})
            </a>
          ))}
        </div>
      )}

      {/* Phase 2A — Campaign Master Header */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Campaign</h2>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr><td>Merchant</td><td>{c.merchant}</td></tr>
            <tr><td>Campaign ID</td><td>{c.id}</td></tr>
            <tr><td>Category</td><td>{c.categories.join(', ') || '(untargeted)'}</td></tr>
            <tr><td>Placement</td><td>{c.placement}</td></tr>
            <tr><td>Status</td><td>{header.status}</td></tr>
            <tr><td>Start (Riyadh)</td><td>{new Date(c.start_at).toLocaleString('en-SA', { timeZone: 'Asia/Riyadh' })}</td></tr>
            <tr><td>End (Riyadh)</td><td>{new Date(c.end_at).toLocaleString('en-SA', { timeZone: 'Asia/Riyadh' })}</td></tr>
            <tr><td>Amazon Tracking ID / strategy ID</td><td>{header.effectiveTrackingId}{!c.tracking_id && ' (shared default — not campaign-specific yet)'}</td></tr>
            <tr><td>Destination</td><td style={{ wordBreak: 'break-all' }}>{c.destination_url}</td></tr>
            <tr><td>Traffic type</td><td>Organic Tawveeri only (no paid acquisition in V1)</td></tr>
            <tr><td>Last Tawveeri event</td><td>{header.lastClickAt || header.lastExposureAt || 'none yet'}</td></tr>
            <tr><td>Last merchant report import</td><td>{merchant.status === 'known' ? merchant.lastImportedAt : 'UNKNOWN / REPORT NOT IMPORTED'}</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 10 }}><Badge tone="warn">INCREMENTALITY: NOT YET TESTED</Badge></p>
      </section>

      {/* Phase 2B — Tawveeri Observed */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>A. Tawveeri Observed <span style={{ fontWeight: 400, fontSize: 12 }}>(trailing 30 days)</span></h2>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr><td>Clean eligible exposures</td><td>{fmt(observed30d.cleanEligibleExposures)}</td></tr>
            <tr><td>Visible/rendered impressions</td><td>{fmt(observed30d.visibleImpressions)}</td></tr>
            <tr><td>Clean campaign clicks</td><td>{fmt(observed30d.cleanCampaignClicks)}</td></tr>
            <tr><td>Unique clicking sessions</td><td>{fmt(observed30d.uniqueClickingSessions)}</td></tr>
            <tr><td>Click-through rate</td><td>{observed30d.clickThroughRate !== null ? `${(observed30d.clickThroughRate * 100).toFixed(1)}%` : '—'}</td></tr>
            <tr><td>Test/internal excluded</td><td>{fmt(observed30d.testInternalExcluded)}</td></tr>
            <tr><td>Bot/suspicious excluded</td><td>{fmt(observed30d.botExcluded)}</td></tr>
            <tr><td>Paid-origin excluded <span style={{ fontSize: 11, color: '#888' }}>(§1D — Amazon paid-search policy is ambiguous; never mixed into organic figures)</span></td><td>{fmt(observed30d.paidOriginExcluded)}</td></tr>
            <tr><td>Top-session concentration</td><td>{observed30d.topSessionConcentration !== null ? `${(observed30d.topSessionConcentration * 100).toFixed(0)}%` : '—'}</td></tr>
            <tr><td>Campaign errors</td><td>{observed30d.campaignErrors} <span style={{ fontSize: 11, color: '#888' }}>(not separately tracked in V1)</span></td></tr>
          </tbody>
        </table>
      </section>

      {/* Amazon Decision Layer V2.1 §10 — Differentiation Metrics: does smarter routing
          outperform generic category routing? All-time, this campaign only. */}
      {header.campaign.merchant === 'amazon' && (
        <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Differentiation — Routing Mode Breakdown <span style={{ fontWeight: 400, fontSize: 12 }}>(all time)</span></h2>
          <table style={{ width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>Mode</th><th>Exposures</th><th>Clicks</th><th>CTR</th>
              </tr>
            </thead>
            <tbody>
              {differentiation.byMode.length === 0 && <tr><td colSpan={4} style={{ color: '#888' }}>No exposures recorded yet.</td></tr>}
              {differentiation.byMode.map((s) => (
                <tr key={s.mode}>
                  <td>{s.mode}</td>
                  <td>{fmt(s.exposures)}</td>
                  <td>{fmt(s.clicks)}</td>
                  <td>{s.ctr !== null ? `${(s.ctr * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
            Category-only routing: {differentiation.categoryOnlyPct !== null ? `${differentiation.categoryOnlyPct.toFixed(0)}%` : '—'} of exposures
            {' '}(the lower this is, the more often exact_product/model_search added real differentiation over a plain category link).
          </p>
          {differentiation.reasonCodeCounts.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700 }}>Reason codes (fallback reasons / rejected unsafe matches / identity outcomes):</p>
              <ul style={{ fontSize: 12, color: '#666', paddingInlineStart: 18 }}>
                {differentiation.reasonCodeCounts.map((r) => (
                  <li key={r.reasonCode}>{r.reasonCode} — {r.count}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Phase 2C — Merchant Reported */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>B. Merchant Reported <span style={{ fontWeight: 400, fontSize: 12 }}>(Tracking ID: {header.effectiveTrackingId})</span></h2>
        {merchant.status === 'unknown' ? (
          <p><Badge tone="pending">UNKNOWN / REPORT NOT IMPORTED</Badge> — no Amazon Associates report has been imported for this Tracking ID yet. This is NOT zero.</p>
        ) : (
          <table style={{ width: '100%' }}>
            <tbody>
              <tr><td>Network-reported clicks</td><td>{merchant.networkReportedClicks ?? 'not provided by report'}</td></tr>
              <tr><td>Ordered items</td><td>{fmt(merchant.orderedItems)}</td></tr>
              <tr><td>Shipped / qualifying items</td><td>{fmt(merchant.shippedItems)}</td></tr>
              <tr><td>Cancelled / returned</td><td>{fmt(merchant.cancelledOrReturned)}</td></tr>
              <tr><td>Qualifying revenue (SAR)</td><td>{fmt(merchant.qualifyingRevenueSar, 2)}</td></tr>
              <tr><td>Earned commission (SAR)</td><td style={{ fontWeight: 900 }}>{fmt(merchant.commissionSar, 2)}</td></tr>
              <tr><td>Report period</td><td>{merchant.reportPeriodStart ?? '—'} → {merchant.reportPeriodEnd ?? '—'}</td></tr>
              <tr><td>Last imported</td><td>{merchant.lastImportedAt ?? '—'}</td></tr>
            </tbody>
          </table>
        )}
      </section>

      {/* Phase 2D — Business Decision */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>C. Business Decision</h2>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr><td>Mechanics proof</td><td><Badge tone={decision.mechanicsProof === 'CONFIRMED' ? 'ok' : 'pending'}>{decision.mechanicsProof}</Badge></td></tr>
            <tr><td>Revenue proof</td><td><Badge tone={decision.revenueProof === 'CONFIRMED' ? 'ok' : 'pending'}>{decision.revenueProof}</Badge></td></tr>
            <tr><td>Repeatability signal</td><td><Badge tone={decision.repeatabilitySignal === 'CONFIRMED' ? 'ok' : 'pending'}>{decision.repeatabilitySignal}</Badge></td></tr>
            <tr><td>Repeatable monetization</td><td><Badge tone={decision.repeatableMonetization === 'CONFIRMED' ? 'ok' : 'pending'}>{decision.repeatableMonetization}</Badge></td></tr>
            <tr><td>Sustainability</td><td><Badge tone={decision.sustainability === 'COVERED' ? 'ok' : 'pending'}>{decision.sustainability}</Badge></td></tr>
            <tr><td>Incrementality</td><td><Badge tone="warn">{decision.incrementality}</Badge></td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
          Commission / clean click: {merchant.status === 'known' && observedAllTime.cleanCampaignClicks > 0 ? fmt(merchant.commissionSar / observedAllTime.cleanCampaignClicks, 2) : '—'} SAR ·
          {' '}Commission / 100 exposures: {merchant.status === 'known' && observedAllTime.cleanEligibleExposures > 0 ? fmt((merchant.commissionSar / observedAllTime.cleanEligibleExposures) * 100, 2) : '—'} SAR
        </p>
      </section>

      {/* Phase 2E — Operating Cost Coverage */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Operating Cost Coverage</h2>
        {!costCoverage.configured ? (
          <p><Badge tone="pending">NOT CONFIGURED</Badge> — set TAWVEERI_MONTHLY_CASH_COST_SAR to enable.</p>
        ) : (
          <table style={{ width: '100%' }}>
            <tbody>
              <tr><td>Recurring monthly cash cost (SAR)</td><td>{fmt(costCoverage.monthlyCostSar, 2)}</td></tr>
              <tr><td>Trailing 30d earned commission (SAR)</td><td>{fmt(costCoverage.trailing30dEarnedCommissionSar, 2)}</td></tr>
              <tr><td>Coverage %</td><td style={{ fontWeight: 900 }}>{costCoverage.coveragePct !== null ? `${costCoverage.coveragePct.toFixed(1)}%` : '—'}</td></tr>
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 11, color: '#888', marginTop: 6 }}>Earned commission (accrual) — not cash paid; network payout timing differs.</p>
      </section>

      {/* Phase 2F — Guardrails */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Guardrails <Badge tone="warn">OBSERVATIONAL — NOT CAUSAL</Badge></h2>
        <p style={{ fontSize: 12, color: '#888' }}>
          Did the campaign generate additional Amazon intent, or redirect users who would have
          clicked organically anyway? This dashboard cannot answer that (Incrementality: NOT YET
          TESTED) — see the existing Command Center for overall search answer-rate and organic
          Amazon exit trends; no before/after causal claim is made here.
        </p>
      </section>
    </div>
  );
}
