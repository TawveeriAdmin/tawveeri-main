// Commercial Opportunity view — data layer (ADR-216). Pure derivation over the SAME aggregates
// the Command Center already computes — no new queries, no new cost. Every opportunity carries
// its evidence, date range, and sample size, and is labeled EARLY SIGNAL below a defensible
// threshold, matching the existing tps:usage launch-gate convention (min ~30 confirmed events).
import type { CommandCenterData } from './command-center-queries';

const EARLY_SIGNAL_THRESHOLD = 30;

export type OpportunityKind = 'no_agreement_retailer' | 'high_demand_low_coverage';

export interface Opportunity {
  kind: OpportunityKind;
  titleAr: string;
  titleEn: string;
  evidenceAr: string;
  evidenceEn: string;
  sampleSize: number;
  earlySignal: boolean;
  recommendedActionAr: string;
  recommendedActionEn: string;
}

export function computeOpportunities(data: CommandCenterData): Opportunity[] {
  const opportunities: Opportunity[] = [];

  // A — retailers already receiving real referrals with no known affiliate program (Provider
  // Registry: affiliate === null). Evidence-based: we don't guess whether an agreement exists
  // beyond what the code-managed registry states.
  const noAgreement = data.commercial.retailers
    .filter((r) => !r.hasAffiliateProgram && r.confirmedRedirects > 0)
    .sort((a, b) => b.confirmedRedirects - a.confirmedRedirects)
    .slice(0, 5);

  for (const r of noAgreement) {
    opportunities.push({
      kind: 'no_agreement_retailer',
      titleAr: `متجر ${r.storeSlug} يستقبل إحالات حقيقية بدون برنامج عمولة معروف`,
      titleEn: `Retailer ${r.storeSlug} is receiving real referrals with no known affiliate program`,
      evidenceAr: `${r.confirmedRedirects} تحويلة مؤكدة عبر ${r.distinctProducts} منتجاً خلال الفترة المحددة.`,
      evidenceEn: `${r.confirmedRedirects} confirmed redirects across ${r.distinctProducts} products in the selected period.`,
      sampleSize: r.confirmedRedirects,
      earlySignal: r.confirmedRedirects < EARLY_SIGNAL_THRESHOLD,
      recommendedActionAr: 'التواصل مع المتجر لطلب كود تتبع أو برنامج عمولة.',
      recommendedActionEn: 'Contact the retailer to request an affiliate/tracking code.',
    });
  }

  // B — categories with real search demand but little or no referred (confirmed-exit) coverage.
  const referredByCategory = new Map(data.commercial.referredCategoryDemand.map((c) => [c.category, c.count]));
  const weakCoverage = data.topDemand
    .filter((d) => d.category !== '(unparsed)')
    .map((d) => ({ category: d.category, searchCount: d.count, referredCount: referredByCategory.get(d.category) ?? 0 }))
    .filter((d) => d.searchCount >= 5 && d.referredCount === 0)
    .sort((a, b) => b.searchCount - a.searchCount)
    .slice(0, 5);

  for (const c of weakCoverage) {
    opportunities.push({
      kind: 'high_demand_low_coverage',
      titleAr: `طلب مرتفع على فئة "${c.category}" بدون تحويلات مؤكدة`,
      titleEn: `High demand for "${c.category}" with zero confirmed referrals`,
      evidenceAr: `${c.searchCount} عملية بحث في هذه الفئة، و0 تحويلة مؤكدة خلال نفس الفترة.`,
      evidenceEn: `${c.searchCount} searches in this category, 0 confirmed referrals in the same period.`,
      sampleSize: c.searchCount,
      earlySignal: c.searchCount < EARLY_SIGNAL_THRESHOLD,
      recommendedActionAr: 'تحسين التغطية لهذه الفئة أو التواصل مع متجر متخصص فيها.',
      recommendedActionEn: 'Improve coverage for this category, or contact a retailer specializing in it.',
    });
  }

  return opportunities;
}
