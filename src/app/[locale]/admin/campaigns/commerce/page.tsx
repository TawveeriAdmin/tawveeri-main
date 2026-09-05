// src/app/[locale]/admin/campaigns/commerce/page.tsx
// AFFILIATE COMMERCE — Amazon × Noon (founder mission, 2026-09-05, §11). Server
// component: /admin/* is already middleware-protected (requires admin role), same
// trust boundary as every other /admin page and as revenue-proof/page.tsx.
//
// This page ANSWERS the founder's own question set in under a minute: is Noon
// structurally live yet, how does it compare to Amazon, and are any commercial
// tie-breaks actually happening. It does NOT duplicate the per-campaign detail —
// that stays at /admin/campaigns/revenue-proof. This page is the merchant-vs-merchant
// rollup revenue-proof was never meant to be.
import { getPortfolioSummary, summarizeByMerchant, compareByCategory } from '@/lib/campaigns/revenue-proof-queries';
import { getTiebreakSummary } from '@/lib/campaigns/commercial-tiebreak';
import { getCategoryCoverageMatrix, type CategoryCoverageRow } from '@/lib/campaigns/category-coverage';

function fmt(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'ok' | 'pending' | 'warn' | 'neutral' }) {
  const colors = { ok: '#0a7a4d', pending: '#8a7300', warn: '#8a2f00', neutral: '#555' } as const;
  return <span style={{ fontWeight: 800, fontSize: 12, color: colors[tone], border: `1px solid ${colors[tone]}`, borderRadius: 6, padding: '2px 8px' }}>{children}</span>;
}

const WINNER_TONE: Record<string, 'ok' | 'pending' | 'warn' | 'neutral'> = {
  AMAZON: 'ok', NOON: 'ok', NO_EVIDENCE: 'neutral', NOT_COMPARABLE: 'pending',
};

const STATE_TONE: Record<CategoryCoverageRow['proposedState'], 'ok' | 'pending' | 'warn' | 'neutral'> = {
  ACTIVE_CAPABLE: 'ok', INITIAL_COHORT: 'ok', ELIGIBLE: 'pending', HOLD: 'pending', INSUFFICIENT_EVIDENCE: 'neutral',
};

export default async function AffiliateCommercePage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  await params;
  const { days: daysParam } = await searchParams;
  const days = daysParam === '1' ? 1 : daysParam === '7' ? 7 : 30;

  const now = new Date();
  const rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const portfolio = await getPortfolioSummary();
  const byMerchant = summarizeByMerchant(portfolio);
  const byCategory = compareByCategory(portfolio);
  const tiebreaks = await getTiebreakSummary({ start: rangeStart, end: now });
  const allCategoryCoverage = await getCategoryCoverageMatrix();

  const amazon = byMerchant.find((m) => m.merchant === 'amazon')!;
  const noon = byMerchant.find((m) => m.merchant === 'noon')!;

  return (
    <div style={{ padding: 24, maxWidth: 1000, fontFamily: 'sans-serif', fontSize: 14, lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Affiliate Commerce — Amazon × Noon</h1>
      <p style={{ color: '#666', marginBottom: 12 }}>
        Portfolio totals are all-time/enabled-campaign scoped (same convention as{' '}
        <a href="../revenue-proof">Revenue Proof</a>); tie-break events below are windowed.
      </p>
      <div style={{ marginBottom: 20, fontSize: 13 }}>
        Window: {[1, 7, 30].map((d) => (
          <a key={d} href={`?days=${d}`} style={{ marginInlineEnd: 10, fontWeight: d === days ? 900 : 400 }}>{d}d</a>
        ))}
      </div>

      {/* §11B — by merchant */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>By Merchant <span style={{ fontWeight: 400, fontSize: 12 }}>(exposures/clicks: trailing 30 days, always — same base as Revenue Proof)</span></h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '4px 8px' }}>Merchant</th>
                <th style={{ padding: '4px 8px' }}>Campaigns (enabled/total)</th>
                <th style={{ padding: '4px 8px' }}>Active categories</th>
                <th style={{ padding: '4px 8px' }}>Exposures 30d</th>
                <th style={{ padding: '4px 8px' }}>Clicks 30d</th>
                <th style={{ padding: '4px 8px' }}>CTR</th>
                <th style={{ padding: '4px 8px' }}>Report imported?</th>
                <th style={{ padding: '4px 8px' }}>Orders (reported)</th>
                <th style={{ padding: '4px 8px' }}>Commission (SAR)</th>
                <th style={{ padding: '4px 8px' }}>Rev / 100 exposures</th>
              </tr>
            </thead>
            <tbody>
              {[amazon, noon].map((m) => (
                <tr key={m.merchant} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 700, textTransform: 'capitalize' }}>{m.merchant}</td>
                  <td style={{ padding: '4px 8px' }}>{m.enabledCampaignCount}/{m.campaignCount}</td>
                  <td style={{ padding: '4px 8px', fontSize: 12 }}>{m.categories.join(', ') || '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{fmt(m.eligibleExposures30d)}</td>
                  <td style={{ padding: '4px 8px' }}>{fmt(m.cleanClicks30d)}</td>
                  <td style={{ padding: '4px 8px' }}>{m.clickThroughRate !== null ? `${(m.clickThroughRate * 100).toFixed(1)}%` : '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{m.anyReportImported ? <Badge tone="ok">yes</Badge> : <Badge tone="pending">no report yet</Badge>}</td>
                  <td style={{ padding: '4px 8px' }}>{fmt(m.ordersKnown)}</td>
                  <td style={{ padding: '4px 8px' }}>{m.commissionSarKnown === null ? '—' : fmt(m.commissionSarKnown, 2)}</td>
                  <td style={{ padding: '4px 8px' }}>{m.revenuePer100Exposures === null ? '—' : fmt(m.revenuePer100Exposures, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 10, fontSize: 11, color: '#888' }}>
          "No report yet" ≠ zero revenue — see AFFILIATE_RECONCILIATION_CONTRACT.md. Noon campaign count is expected to be 0 until the founder
          creates one (blocked on clause-8.3 written brand-naming consent — see the closure ADR) and Noon's own Associates-equivalent report access remains unconfirmed.
        </p>
      </section>

      {/* §11D — commercial tie-breaks */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Commercial Tie-Breaks <span style={{ fontWeight: 400, fontSize: 12 }}>(last {days}d, real traffic only)</span></h2>
        <p style={{ marginBottom: 8 }}>
          Total events: <b>{fmt(tiebreaks.totalEvents)}</b> · Amazon selected: <b>{fmt(tiebreaks.amazonSelected)}</b> · Noon selected: <b>{fmt(tiebreaks.noonSelected)}</b> · No commercial signal: <b>{fmt(tiebreaks.noSelection)}</b>
        </p>
        {tiebreaks.totalEvents === 0 ? (
          <p style={{ color: '#888', fontSize: 13 }}>
            None yet — this requires BOTH an Amazon and a Noon campaign to independently resolve `exact_product` for the SAME canonical
            product in the same request. Noon's exact_product routing is gated behind <code>NOON_EXACT_PRODUCT_ENABLED</code> (currently off
            by default) precisely so this stays at zero until the founder opts in — never fabricated as a projected number.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                  <th>When</th><th>Category</th><th>Amazon SAR</th><th>Noon SAR</th><th>Diff</th><th>Equivalence</th><th>Selected</th><th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {tiebreaks.events.map((e, i) => (
                  <tr key={i}>
                    <td>{new Date(e.createdAt).toLocaleString('en-SA', { timeZone: 'Asia/Riyadh' })}</td>
                    <td>{e.category}</td>
                    <td>{fmt(e.amazonPriceSar, 2)}</td>
                    <td>{fmt(e.noonPriceSar, 2)}</td>
                    <td>{fmt(e.priceDiffSar, 2)}</td>
                    <td>{e.equivalenceState}</td>
                    <td style={{ textTransform: 'capitalize' }}>{e.selectedMerchant ?? '—'}</td>
                    <td>{e.reasonCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* §11E — category table (campaign-having categories only) */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>By Category — Live Campaigns</h2>
        <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Only categories with an existing affiliate_campaigns row. For every Tawveeri category regardless of campaign status, see "All-Category Coverage" below.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>Category</th><th>Amazon exposures/clicks</th><th>Amazon commission</th><th>Noon exposures/clicks</th><th>Noon commission</th><th>Winner</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((row) => (
                <tr key={row.category} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '4px 8px' }}>{row.category}</td>
                  <td style={{ padding: '4px 8px' }}>{row.amazon ? `${fmt(row.amazon.tawveeriExposures30d)} / ${fmt(row.amazon.tawveeriClicks30d)}` : '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{row.amazon?.merchantCommissionSar != null ? fmt(row.amazon.merchantCommissionSar, 2) : '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{row.noon ? `${fmt(row.noon.tawveeriExposures30d)} / ${fmt(row.noon.tawveeriClicks30d)}` : '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{row.noon?.merchantCommissionSar != null ? fmt(row.noon.merchantCommissionSar, 2) : '—'}</td>
                  <td style={{ padding: '4px 8px' }}><Badge tone={WINNER_TONE[row.winner]}>{row.winner.replace(/_/g, ' ')}</Badge></td>
                </tr>
              ))}
              {byCategory.length === 0 && <tr><td colSpan={6} style={{ color: '#888', padding: '8px' }}>No campaigns exist yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Founder correction #2 (2026-09-05): "Noon must not be architecturally limited to
          TV + laptop" — every Tawveeri category, not only categories with a live campaign. */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>All-Category Coverage <span style={{ fontWeight: 400, fontSize: 12 }}>(all {allCategoryCoverage.length} active categories, not just live campaigns)</span></h2>
        <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
          "Proposed state" is computed from real evidence — it is a proposal for founder judgment, not a decision. Only TV and laptop carry an actual founder-approved decision
          (ADR-294's initial cohort); every other row's state below is this page's own honest read of overlap/demand, and activates nothing by itself.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '4px 6px' }}>Category</th>
                <th style={{ padding: '4px 6px' }}>Active</th>
                <th style={{ padding: '4px 6px' }}>Noon offers (valid/fresh)</th>
                <th style={{ padding: '4px 6px' }}>Amazon offers</th>
                <th style={{ padding: '4px 6px' }}>Overlap</th>
                <th style={{ padding: '4px 6px' }}>Noon-only</th>
                <th style={{ padding: '4px 6px' }}>Amazon-only</th>
                <th style={{ padding: '4px 6px' }}>Demand 30d</th>
                <th style={{ padding: '4px 6px' }}>Explicit interactions 30d</th>
                <th style={{ padding: '4px 6px' }}>Cheaper (Noon/Amazon/tie)</th>
                <th style={{ padding: '4px 6px' }}>Proposed state</th>
              </tr>
            </thead>
            <tbody>
              {allCategoryCoverage.map((r) => (
                <tr key={r.category} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '4px 6px', fontWeight: 700 }}>{r.category}</td>
                  <td style={{ padding: '4px 6px' }}>{fmt(r.activeProducts)}</td>
                  <td style={{ padding: '4px 6px' }}>{fmt(r.validNoonOffers)} / {fmt(r.freshNoonOffers)}</td>
                  <td style={{ padding: '4px 6px' }}>{fmt(r.validAmazonOffers)}</td>
                  <td style={{ padding: '4px 6px' }}>{fmt(r.overlapProducts)}</td>
                  <td style={{ padding: '4px 6px' }}>{fmt(r.noonOnlyProducts)}</td>
                  <td style={{ padding: '4px 6px' }}>{fmt(r.amazonOnlyProducts)}</td>
                  <td style={{ padding: '4px 6px' }}>{fmt(r.demand30d)}</td>
                  <td style={{ padding: '4px 6px' }}>{fmt(r.explicitInteractions30d)}</td>
                  <td style={{ padding: '4px 6px' }}>{r.overlapProducts > 0 ? `${fmt(r.noonCheaperProducts)}/${fmt(r.amazonCheaperProducts)}/${fmt(r.tiedProducts)}` : '—'}</td>
                  <td style={{ padding: '4px 6px' }}><Badge tone={STATE_TONE[r.proposedState]}>{r.proposedState.replace(/_/g, ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* §11F — data quality */}
      <section style={{ border: '1px solid #ccc', borderRadius: 10, padding: 16 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Data Quality</h2>
        <ul style={{ fontSize: 12, color: '#666', paddingInlineStart: 18 }}>
          <li><b>RAW_OPERATIONAL</b> — every `/go` outbound_clicks row, ANY merchant, regardless of interaction_provenance. This page never shows or sums this figure directly — a raw cross-merchant outbound_clicks count is dominated (92%+) by `unknown` provenance (bots, prefetches, scanners) and must never be quoted as "real clicks" for any one merchant. Never treated as a conversion by itself.</li>
          <li><b>SESSION_ATTRIBUTED</b> — campaign_exposures/campaign_clicks (this page's "Exposures"/"Clicks" columns), filtered through the traffic-eligibility contract (unknown/paid-origin excluded). Ours, decision-grade, always known.</li>
          <li><b>EXPLICIT_CUSTOMER_INTERACTION</b> — first_party_interactions (ADR-286, live in production) joined by exact interaction_id, or outbound_clicks.interaction_provenance = 'render_token_valid'. The strictest tier; currently a very small number for both merchants — not yet joined into this page's per-merchant rollup, so check first_party_interactions directly for the current count rather than assuming it tracks Exposures/Clicks above.</li>
          <li><b>NETWORK_REPORTED</b> — affiliate_conversions (imported CSV report). UNKNOWN, never 0, until a report is imported for that merchant/tracking id.</li>
        </ul>
        <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>See revenue-proof's per-campaign page for the full three-layer (A/B/C) proof on any single campaign.</p>
      </section>
    </div>
  );
}
