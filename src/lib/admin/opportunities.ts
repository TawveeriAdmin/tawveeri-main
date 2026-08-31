// Commercial Opportunity view — data layer (ADR-216, extended by ADR-275). Pure derivation over
// the SAME aggregates the Command Center already computes — no new queries, no new cost. Every
// opportunity carries its evidence, date range, and sample size, and is labeled EARLY SIGNAL
// below a defensible threshold, matching the existing tps:usage launch-gate convention (min ~30
// confirmed events).
//
// EVIDENCE CONFIDENCE vs ACTION TIER (ADR-275) — structural, not the AI's call. evidenceConfidence
// answers "how solid is this sample" (a generic statistical question, one shared labeling
// function). actionTier answers "does the founder have enough of the RIGHT KIND of evidence to
// act" — and that is NOT generic: a Commercial opportunity can have high-confidence redirect
// evidence and still be capped at WATCH forever, because this codebase has no revenue/conversion
// truth source yet (METRIC_CONFIDENCE.affiliateCommission = UNAVAILABLE in
// command-center-queries.ts) — redirects are traffic evidence, not revenue evidence, no matter
// how many of them there are. A Coverage/Recoverable-Unmet opportunity's evidence (demand +
// inability to answer) IS the action trigger, so it reaches ACT at the same confidence a
// Commercial opportunity would still be stuck at WATCH. Each kind below computes its OWN
// actionTier for exactly this reason — deliberately NOT one universal gate.
import type { CommandCenterData } from './command-center-queries';
import type { CategoryNeedSignal } from './need-signals';
import type { EmergingLanguageCluster } from './emerging-language';
import { retailerDisplayName } from '@/lib/providers/registry';

const EARLY_SIGNAL_THRESHOLD = 30;

export type OpportunityKind =
  | 'no_agreement_retailer' | 'high_demand_low_coverage'
  | 'demand_momentum' | 'recoverable_unmet' | 'emerging_language';

/** How solid the SAMPLE is — a generic statistical fact, the one thing every kind shares. */
export type EvidenceConfidence = 'low' | 'medium' | 'high';
/** Whether the founder should ACT, WATCH, or treat this as INSUFFICIENT_EVIDENCE — a per-kind
 *  judgment about whether the evidence TYPE (not just its size) supports the action, computed
 *  deterministically below. AI never sets or upgrades this (founder-intelligence.ts). */
export type ActionTier = 'ACT' | 'WATCH' | 'INSUFFICIENT_EVIDENCE';

export interface Opportunity {
  kind: OpportunityKind;
  titleAr: string;
  titleEn: string;
  evidenceAr: string;
  evidenceEn: string;
  sampleSize: number;
  earlySignal: boolean;
  evidenceConfidence: EvidenceConfidence;
  actionTier: ActionTier;
  recommendedActionAr: string;
  recommendedActionEn: string;
  /** Set only for category-scoped kinds (high_demand_low_coverage, demand_momentum,
   *  recoverable_unmet) — a stable machine key for cross-kind dedup, deliberately NOT parsed back
   *  out of titleAr/titleEn (title wording is free to change without breaking dedup). */
  category?: string;
}

/** The one shared piece of the "common indicator contract": a sample size relative to
 *  kind-supplied floors becomes a confidence label. Floors are passed in per call site
 *  precisely because different indicators live at very different natural volumes (a Commercial
 *  redirect count and an Emerging-Language cluster count are not the same scale) — this function
 *  makes no eligibility or action decision of its own. */
function evidenceConfidenceFromSample(n: number, earlyFloor: number, highFloor: number): EvidenceConfidence {
  if (n < earlyFloor) return 'low';
  if (n >= highFloor) return 'high';
  return 'medium';
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
    const evidenceConfidence = evidenceConfidenceFromSample(r.confirmedRedirects, EARLY_SIGNAL_THRESHOLD, 100);
    // Commercial: no volume of redirects, however large, reaches ACT — there is no revenue/
    // conversion truth source in this codebase yet to confirm the redirect became a sale. See
    // the module header note. This is the concrete case the founder's own eXtra example names.
    const actionTier: ActionTier = evidenceConfidence === 'low' ? 'INSUFFICIENT_EVIDENCE' : 'WATCH';
    // Integrity review (2026-08-30): storeSlug is a raw id/registry slug (e.g. "4"), never a
    // founder-facing name — found showing literal "Retailer 4" instead of "eXtra" in real
    // production output. retailerDisplayName() is the same resolver daily-report.ts and the
    // Command Center page already use for this exact column.
    //
    // Found in a real end-to-end send test (2026-08-31): some registry Arabic names ALREADY
    // start with "متجر" (e.g. Al Nakheel's own displayNameAr is "متجر النخيل") — prepending the
    // generic "متجر" prefix unconditionally produced "متجر متجر النخيل" ("store store Al
    // Nakheel"). Only add the generic prefix when the resolved name doesn't already carry it.
    const nameAr = retailerDisplayName(r.storeSlug, true);
    const nameEn = retailerDisplayName(r.storeSlug, false);
    const nameArWithPrefix = nameAr.startsWith('متجر ') ? nameAr : `متجر ${nameAr}`;
    opportunities.push({
      kind: 'no_agreement_retailer',
      titleAr: `${nameArWithPrefix} يستقبل إحالات حقيقية بدون برنامج عمولة معروف`,
      titleEn: `Retailer ${nameEn} is receiving real referrals with no known affiliate program`,
      evidenceAr: `${r.confirmedRedirects} تحويلة مؤكدة عبر ${r.distinctProducts} منتجاً خلال الفترة المحددة.`,
      evidenceEn: `${r.confirmedRedirects} confirmed redirects across ${r.distinctProducts} products in the selected period.`,
      sampleSize: r.confirmedRedirects,
      earlySignal: r.confirmedRedirects < EARLY_SIGNAL_THRESHOLD,
      evidenceConfidence,
      actionTier,
      recommendedActionAr: 'التواصل مع المتجر لطلب كود تتبع أو برنامج عمولة — لا يوجد بعد دليل تحويل/إيراد مؤكد.',
      recommendedActionEn: 'Contact the retailer to request an affiliate/tracking code — no confirmed conversion/revenue evidence exists yet.',
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
    const evidenceConfidence = evidenceConfidenceFromSample(c.searchCount, EARLY_SIGNAL_THRESHOLD, 100);
    // Coverage: unlike Commercial, the evidence itself (real demand, zero referred coverage) IS
    // the action trigger — there is no separate revenue-truth gap blocking ACT here.
    const actionTier: ActionTier = evidenceConfidence === 'low' ? 'INSUFFICIENT_EVIDENCE' : 'ACT';
    opportunities.push({
      kind: 'high_demand_low_coverage',
      category: c.category,
      titleAr: `طلب مرتفع على فئة "${c.category}" بدون تحويلات مؤكدة`,
      titleEn: `High demand for "${c.category}" with zero confirmed referrals`,
      evidenceAr: `${c.searchCount} عملية بحث في هذه الفئة، و0 تحويلة مؤكدة خلال نفس الفترة.`,
      evidenceEn: `${c.searchCount} searches in this category, 0 confirmed referrals in the same period.`,
      sampleSize: c.searchCount,
      earlySignal: c.searchCount < EARLY_SIGNAL_THRESHOLD,
      evidenceConfidence,
      actionTier,
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

/** A category's momentum is reported as demand_momentum only when it is large, growing,
 *  evidenced by more than one session, and Tawveeri can actually answer it. A growing but
 *  UNANSWERABLE category is not suppressed — it is exactly the recoverable_unmet story below,
 *  with the opposite eligibility rule (weak answerability is the signal, not a disqualifier).
 *  The two remain mutually exclusive by construction (answerability='yes' vs !=‘yes’) so a
 *  founder never sees the same evidence twice under different labels. */
const MOMENTUM_THRESHOLD_PCT = 50;
const MIN_SESSIONS_FOR_MOMENTUM = 3; // concentration guard's companion — never fewer than this many distinct sessions

export function computeNeedBasedOpportunities(
  needSignals: CategoryNeedSignal[],
  emergingClusters: EmergingLanguageCluster[],
  existingOpportunities: Opportunity[] = []
): Opportunity[] {
  const opportunities: Opportunity[] = [];

  // Integrity review (2026-08-30): high_demand_low_coverage (computeOpportunities, search-term
  // granularity) and recoverable_unmet (below, category/need-signal granularity) both describe
  // "real demand, weak coverage" for a category, from two different evidence sources. Verified
  // against real production data that they do NOT currently overlap, but the architecture allows
  // it — and the founder explicitly does not want overlapping intelligence cluttering FOCUS
  // TODAY. recoverable_unmet is the richer signal (momentum/session-concentration already
  // applied), so when both would fire for the same category, only it survives.
  const alreadyCoveredCategories = new Set(
    existingOpportunities.filter((o) => o.kind === 'high_demand_low_coverage' && o.category).map((o) => o.category)
  );

  for (const s of needSignals) {
    if (s.belowConfidenceFloor) continue;
    if (s.answerability !== 'yes') continue; // that story belongs to recoverable_unmet, not here
    if (s.momentumPct === null || s.momentumPct < MOMENTUM_THRESHOLD_PCT) continue;
    if (s.topSessionShare > 0.7) continue; // one heavy session driving an apparent trend is not a market signal
    const evidenceConfidence = evidenceConfidenceFromSample(s.volume, EARLY_SIGNAL_THRESHOLD, 100);
    // Demand/Content: ACT requires BOTH a solid sample AND real session diversity — a stricter
    // concentration bar than the 0.7 eligibility gate above, because "act on this" (spend content/
    // marketing effort) should require more than "not obviously one person."
    const actionTier: ActionTier = evidenceConfidence === 'low' ? 'INSUFFICIENT_EVIDENCE'
      : (evidenceConfidence === 'high' && s.topSessionShare <= 0.4) ? 'ACT' : 'WATCH';
    opportunities.push({
      kind: 'demand_momentum',
      category: s.category,
      titleAr: `طلب فئة "${s.category}" في ازدياد ملحوظ`,
      titleEn: `Demand for "${s.category}" is accelerating`,
      evidenceAr: `${s.volume} حدث طلب في الفترة الأخيرة مقابل ${s.baselineVolume} في الفترة السابقة (+${s.momentumPct.toFixed(0)}%). أعلى حصة جلسة واحدة: ${(s.topSessionShare * 100).toFixed(0)}%. توفيري يغطي هذه الفئة (${s.answerabilityReason}).`,
      evidenceEn: `${s.volume} demand events this period vs. ${s.baselineVolume} in the prior period (+${s.momentumPct.toFixed(0)}%). Top single-session share: ${(s.topSessionShare * 100).toFixed(0)}%. Tawveeri covers this category (${s.answerabilityReason}).`,
      sampleSize: s.volume,
      earlySignal: s.volume < EARLY_SIGNAL_THRESHOLD,
      evidenceConfidence,
      actionTier,
      recommendedActionAr: 'فرصة محتوى/تسويق — الطلب حقيقي ومتزايد وتوفيري قادر على الإجابة عليه.',
      recommendedActionEn: 'Content/marketing opportunity — real, growing demand that Tawveeri can already answer.',
    });
  }

  // Recoverable Unmet (ADR-275) — the mirror image of demand_momentum: real, real category demand
  // where Tawveeri's OWN catalog-capability read says it cannot confidently answer. Weak
  // answerability is the signal here, not a reason to suppress it — retrieval, aliasing,
  // categorization, or a genuine catalog gap are all plausible causes a human should look at.
  // Momentum is NOT required (a flat or declining but persistently unanswerable category is still
  // worth a look); the session-concentration guard is, so one obsessive searcher cannot manufacture
  // a false "we can't answer this" story either.
  for (const s of needSignals) {
    if (s.belowConfidenceFloor) continue;
    if (s.answerability === 'yes' || s.answerability === 'unknown') continue;
    if (s.topSessionShare > 0.7) continue;
    if (alreadyCoveredCategories.has(s.category)) continue; // high_demand_low_coverage already told this story for this category
    const evidenceConfidence = evidenceConfidenceFromSample(s.volume, EARLY_SIGNAL_THRESHOLD, 100);
    // Coverage-shaped, like high_demand_low_coverage above: the evidence IS the trigger — no
    // separate revenue-truth gap blocks ACT the way it does for Commercial.
    const actionTier: ActionTier = evidenceConfidence === 'low' ? 'INSUFFICIENT_EVIDENCE' : 'ACT';
    opportunities.push({
      kind: 'recoverable_unmet',
      category: s.category,
      titleAr: `طلب حقيقي على فئة "${s.category}" لا يستطيع توفيري الإجابة عليه بثقة حالياً`,
      titleEn: `Real demand for "${s.category}" Tawveeri cannot confidently answer today`,
      evidenceAr: `${s.volume} حدث طلب خلال الفترة الأخيرة. سبب ضعف التغطية: ${s.answerabilityReason}.`,
      evidenceEn: `${s.volume} demand events this period. Coverage gap: ${s.answerabilityReason}.`,
      sampleSize: s.volume,
      earlySignal: s.volume < EARLY_SIGNAL_THRESHOLD,
      evidenceConfidence,
      actionTier,
      recommendedActionAr: 'يستحق مراجعة هندسية — قد يكون السبب تصنيفاً، أسماء بديلة غير مغطاة، أو نقصاً حقيقياً في الكتالوج.',
      recommendedActionEn: 'Worth an engineering look — could be categorization, missing aliases, or a genuine catalog gap.',
    });
  }

  for (const c of emergingClusters) {
    if (c.belowClusterFloor) continue;
    if (c.distinctSessions < MIN_SESSIONS_FOR_MOMENTUM) continue; // one person retyping the same query is not an emerging pattern
    // Emerging Language lives at a much smaller natural scale than Demand/Commercial — its own
    // floor (3) and a modest ceiling (8, roughly the low end of the real Honor Pad cluster this
    // review found) are its OWN confidence scale, not the 30/100 used elsewhere.
    const evidenceConfidence = evidenceConfidenceFromSample(c.count, MIN_SESSIONS_FOR_MOMENTUM, 8);
    // This kind is inherently "worth a human look," never a revenue or coverage claim — ACT here
    // means "read these queries," which real session diversity (not raw count) justifies.
    const actionTier: ActionTier = c.distinctSessions >= 5 ? 'ACT' : 'WATCH';
    opportunities.push({
      kind: 'emerging_language',
      titleAr: `نمط بحث جديد لم يتعرف عليه توفيري بعد`,
      titleEn: `A new search pattern Tawveeri does not yet understand`,
      evidenceAr: `${c.count} عملية بحث حقيقية عبر ${c.distinctSessions} جلسة مختلفة لم يتعرف عليها المحلل الحالي. أمثلة: ${c.sampleQueries.slice(0, 3).join(' / ')}`,
      evidenceEn: `${c.count} real searches across ${c.distinctSessions} distinct sessions the current parser does not recognize. Examples: ${c.sampleQueries.slice(0, 3).join(' / ')}`,
      sampleSize: c.count,
      earlySignal: c.count < EARLY_SIGNAL_THRESHOLD,
      evidenceConfidence,
      actionTier,
      recommendedActionAr: 'يستحق مراجعة بشرية — قد يكون اسمًا جديدًا لمنتج أو تهجئة غير معروفة أو فئة غير مدعومة.',
      recommendedActionEn: 'Worth a human look — could be a new product name, an unknown spelling, or an unsupported category.',
    });
  }

  return opportunities;
}
