// Commercial Opportunity view — data layer (ADR-216). Pure derivation over the SAME aggregates
// the Command Center already computes — no new queries, no new cost. Every opportunity carries
// its evidence, date range, and sample size, and is labeled EARLY SIGNAL below a defensible
// threshold, matching the existing tps:usage launch-gate convention (min ~30 confirmed events).
import type { CommandCenterData } from './command-center-queries';
import type { CategoryNeedSignal } from './need-signals';
import type { EmergingLanguageCluster } from './emerging-language';

const EARLY_SIGNAL_THRESHOLD = 30;

export type OpportunityKind =
  | 'no_agreement_retailer' | 'high_demand_low_coverage'
  | 'demand_momentum' | 'emerging_language';

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

// ── Need-based opportunities (integrated review, 2026-08-30) ───────────────
// Deliberately a SEPARATE, synchronous function rather than folded into
// computeOpportunities() above: need-signals.ts and emerging-language.ts
// both require raw usage_events (need-signals also makes one live
// answerability read), which CommandCenterData does not carry — the caller
// (founder-intelligence.ts) computes them once and passes the results in
// here, keeping this function itself pure derivation, zero new queries,
// same discipline as computeOpportunities(). computeOpportunities() itself
// is untouched — nothing that already calls it changes behavior.

/** A category's momentum is reported as an opportunity only when it is
 *  large, growing, evidenced by more than one session, and Tawveeri can
 *  actually answer it — a growing but unanswerable category is NOT a
 *  demand_momentum opportunity, it IS a high_demand_low_coverage one
 *  (computed above); the two are mutually exclusive by construction so a
 *  founder never sees the same evidence twice under different labels. */
const MOMENTUM_THRESHOLD_PCT = 50;
const MIN_SESSIONS_FOR_MOMENTUM = 3; // concentration guard's companion — never fewer than this many distinct sessions

export function computeNeedBasedOpportunities(
  needSignals: CategoryNeedSignal[],
  emergingClusters: EmergingLanguageCluster[]
): Opportunity[] {
  const opportunities: Opportunity[] = [];

  for (const s of needSignals) {
    if (s.belowConfidenceFloor) continue;
    if (s.answerability !== 'yes') continue; // that story belongs to high_demand_low_coverage, not here
    if (s.momentumPct === null || s.momentumPct < MOMENTUM_THRESHOLD_PCT) continue;
    if (s.topSessionShare > 0.7) continue; // one heavy session driving an apparent trend is not a market signal
    opportunities.push({
      kind: 'demand_momentum',
      titleAr: `طلب فئة "${s.category}" في ازدياد ملحوظ`,
      titleEn: `Demand for "${s.category}" is accelerating`,
      evidenceAr: `${s.volume} حدث طلب في الفترة الأخيرة مقابل ${s.baselineVolume} في الفترة السابقة (+${s.momentumPct.toFixed(0)}%). أعلى حصة جلسة واحدة: ${(s.topSessionShare * 100).toFixed(0)}%. توفيري يغطي هذه الفئة (${s.answerabilityReason}).`,
      evidenceEn: `${s.volume} demand events this period vs. ${s.baselineVolume} in the prior period (+${s.momentumPct.toFixed(0)}%). Top single-session share: ${(s.topSessionShare * 100).toFixed(0)}%. Tawveeri covers this category (${s.answerabilityReason}).`,
      sampleSize: s.volume,
      earlySignal: s.volume < EARLY_SIGNAL_THRESHOLD,
      recommendedActionAr: 'فرصة محتوى/تسويق — الطلب حقيقي ومتزايد وتوفيري قادر على الإجابة عليه.',
      recommendedActionEn: 'Content/marketing opportunity — real, growing demand that Tawveeri can already answer.',
    });
  }

  for (const c of emergingClusters) {
    if (c.belowClusterFloor) continue;
    if (c.distinctSessions < MIN_SESSIONS_FOR_MOMENTUM) continue; // one person retyping the same query is not an emerging pattern
    opportunities.push({
      kind: 'emerging_language',
      titleAr: `نمط بحث جديد لم يتعرف عليه توفيري بعد`,
      titleEn: `A new search pattern Tawveeri does not yet understand`,
      evidenceAr: `${c.count} عملية بحث حقيقية عبر ${c.distinctSessions} جلسة مختلفة لم يتعرف عليها المحلل الحالي. أمثلة: ${c.sampleQueries.slice(0, 3).join(' / ')}`,
      evidenceEn: `${c.count} real searches across ${c.distinctSessions} distinct sessions the current parser does not recognize. Examples: ${c.sampleQueries.slice(0, 3).join(' / ')}`,
      sampleSize: c.count,
      earlySignal: c.count < EARLY_SIGNAL_THRESHOLD,
      recommendedActionAr: 'يستحق مراجعة بشرية — قد يكون اسمًا جديدًا لمنتج أو تهجئة غير معروفة أو فئة غير مدعومة.',
      recommendedActionEn: 'Worth a human look — could be a new product name, an unknown spelling, or an unsupported category.',
    });
  }

  return opportunities;
}
