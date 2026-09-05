// Explainable opportunity ranking (ADR-247 §15). No opaque "Score: 92" — the
// tier is derived from named components and every contributing reason is a
// founder-readable Arabic string. PRECISION > VOLUME (§16): when uncertain,
// the answer is IGNORE, never a confident HIGH.

import type { Answerability, Classification, RadarCandidate, Tier } from './types';
import { categoryNameAr } from './saudi-lexicon';
import { isStale, isAccessoryQuestion } from './heuristics';
import { scoreDecisionEvidence } from './decision-evidence-score';

export interface RankResult {
  tier: Tier;
  reasons: string[];
  suggestedQuery: string | null;
}

// ---------------------------------------------------------------------------
// PHASE 1 NOTE (Radar 2.0, founder decision 2026-08-29): Purchase/Market
// Opportunity Score and Tawveeri Answerability are permanently independent
// scores (architecture doc §9/§10) — Answerability must never discount or
// gate the Opportunity Score. computeOpportunityScore() below is that
// independent score, used ONLY for the new funnel-event/outcome logging
// (pipeline.ts). rankOpportunity() further down is UNCHANGED — same
// signature, same answerability-gated logic, same tier output — because
// Phase 1 explicitly preserves "current tier decisions exactly" and "current
// email behavior exactly." The two functions are computed side by side so
// Phase 1 can MEASURE what a decoupled score would look like on real traffic
// before Phase 2 is ever authorized to let it change a real decision.
// ---------------------------------------------------------------------------

export interface OpportunityScoreResult {
  score: number;
  reasons: string[];
  /** true when a hard exclusion fired — mirrors rank.ts's own hard-gate style,
   *  but evaluated with NO knowledge of Answerability. */
  excluded: boolean;
}

/** Independent Purchase/Market Opportunity Score — no Answerability input at
 *  all. Mirrors rankOpportunity()'s own exclusion/evidence structure below,
 *  intentionally kept as a parallel implementation rather than a refactor of
 *  rankOpportunity() itself, so today's real tier/email path is provably
 *  untouched (see tests/growth/rank-noop.test.ts). */
export function computeOpportunityScore(c: RadarCandidate, cls: Classification): OpportunityScoreResult {
  const reasons: string[] = [];

  if (cls.intentStrength === 'none' || cls.intentClass === 'none') {
    return { score: 0, excluded: true, reasons: ['لا توجد نية شراء حقيقية في النص'] };
  }
  if (cls.ksaRelevance === 'not_relevant') {
    return { score: 0, excluded: true, reasons: ['السياق خارج السوق السعودي'] };
  }
  if (isStale(c.postedAt)) {
    return { score: 0, excluded: true, reasons: ['المنشور أقدم من نافذة الرد المفيدة (48 ساعة)'] };
  }
  if (c.authorHandle && c.authorHandle.toLowerCase() === 'tawveeri') {
    return { score: 0, excluded: true, reasons: ['منشور من حساب توفيري نفسه'] };
  }
  if (isAccessoryQuestion(c.text)) {
    return { score: 0, excluded: true, reasons: ['سؤال عن إكسسوار وليس عن الجهاز نفسه'] };
  }
  // Phase 1 taxonomy exclusion axis (§5) — contest/post-purchase/etc. This is
  // the one gate that DIFFERS from rankOpportunity() below: today's real
  // ranker has no equivalent check, so this measures the gap without closing
  // it in production yet.
  if (cls.exclusion !== 'none') {
    return { score: 0, excluded: true, reasons: [`مستبعد: ${cls.exclusion}`] };
  }

  let points = 0;
  if (cls.intentStrength === 'strong') {
    points += 2;
    reasons.push('نية شراء مباشرة وواضحة');
  } else {
    reasons.push('نية شراء محتملة لكن غير مؤكدة');
  }
  if (cls.isDirectQuestion) {
    points += 1;
    reasons.push('المستخدم يطلب المساعدة صراحة');
  }
  if (cls.budgetSar) {
    points += 1;
    reasons.push(`ميزانية واضحة: ${cls.budgetSar.toLocaleString('ar-SA')} ريال`);
  }
  if (cls.ksaRelevance === 'confirmed') {
    points += 1;
    reasons.push('صلة سعودية مؤكدة بالدليل');
  } else if (cls.ksaRelevance === 'likely') {
    reasons.push('لهجة خليجية — صلة سعودية محتملة');
  } else {
    points -= 1;
    reasons.push('لا دليل على السوق السعودي — حذر');
  }
  if (cls.confidence < 0.5) {
    points -= 1;
    reasons.push('ثقة التصنيف منخفضة — خُفّض التقييم');
  }
  const freshMinutes = c.postedAt ? Math.round((Date.now() - new Date(c.postedAt).getTime()) / 60000) : null;
  if (freshMinutes !== null && freshMinutes <= 120) {
    points += 1;
    reasons.push(`منشور حديث (قبل ${freshMinutes} دقيقة)`);
  }
  reasons.push(`الفئة: ${categoryNameAr(cls.category)}`);

  return { score: points, excluded: false, reasons };
}

// Arabic labels for scoreDecisionEvidence()'s reason codes — founder-readable, no bare English
// enum ever reaches the founder (matches this file's own "no opaque score" discipline above).
const DECISION_EVIDENCE_REASON_AR: Record<string, string> = {
  recommendation_request: 'يطلب توصية أو نصيحة صريحة',
  explicit_comparison: 'يقارن بين خيارين بوضوح',
  budget_stated: 'يذكر ميزانية محددة',
  use_case_stated: 'يذكر استخدامًا محددًا (دراسة، عمل، حجم غرفة، ...)',
  named_competing_products: 'يذكر منتجات منافسة بالاسم',
  urgency: 'حاجة عاجلة',
  replacement: 'يريد استبدال جهاز حالي',
  availability_question: 'يسأل عن توفر منتج محدد — لغة جاهزة للشراء',
  declarative_want_only: 'رغبة معلنة دون دليل قرار إضافي',
};
const EXCLUSION_REASON_AR: Record<string, string> = {
  merchant_ad_comparison_bait: 'إعلان تجاري بصيغة مقارنة، وليس مستهلكًا حقيقيًا',
  decision_already_made: 'القرار مُتخذ بالفعل — ليس فرصة قائمة',
  owns_device: 'يملك الجهاز بالفعل',
  device_support_or_migration: 'سؤال دعم فني أو نقل بيانات، وليس شراء جهاز',
  news_or_narrative_anecdote: 'خبر أو حديث عام، وليس طلب شراء',
  carrier_sim_not_device: 'سؤال عن شريحة اتصال، وليس عن الجهاز',
  giveaway_reply_context: 'رد على مسابقة أو هدية، وليس نية شراء',
  hyperbolic_wish_no_decision: 'تمني مبالغ فيه بدون دليل قرار',
};

/**
 * REDESIGNED 2026-08-31 (founder-authorized end-to-end redesign, ADR-280). Hard gates below are
 * UNCHANGED from the original formula — proven, safe, orthogonal to the scoring-quality problem.
 * What changed is what EARNS a tier: scoreDecisionEvidence() (promoted from Shadow's Policy V2,
 * decision-evidence-score.ts) replaces the old points formula, which rewarded any want-verb
 * ("أبي جوال") identically to genuine decision-stage language ("محتار بين آيباد ولابتوب وش
 * تنصحوني؟"). Real backtest against all 59 founder-labeled texts this codebase has retained
 * (Radar 1's 23-item history + Shadow's 25-item pool + a fresh 12-item batch): the old formula
 * surfaced 51/59 at 27.5% precision; this one surfaces 18/59 at 77.8% precision, SAME recall
 * (82.4%) — same items the founder would ever see, 65% less noise to review.
 *
 * HIGH threshold (score>=3) is its OWN calibration, not Shadow's generic score>=4 — evidence:
 * every real founder-labeled VALUABLE text in the backtest corpus scores 2 or 3, never 4+.
 * Reusing Shadow's >=4 bar here would have emailed the founder zero times on this entire
 * historical corpus. This is not "lowering a threshold" in the sense already shown to add noise
 * (ADR history) — it is calibrating a NEW, qualitatively different signal, backtested before
 * being set, not guessed.
 */
export function rankOpportunity(
  c: RadarCandidate,
  cls: Classification,
  answerability: Answerability,
  answerabilityReason: string
): RankResult {
  // Hard IGNORE gates — each is a named, explainable rule. Unchanged from the original formula.
  if (cls.intentStrength === 'none' || cls.intentClass === 'none') {
    return { tier: 'ignore', reasons: ['لا توجد نية شراء حقيقية في النص'], suggestedQuery: null };
  }
  if (cls.ksaRelevance === 'not_relevant') {
    return { tier: 'ignore', reasons: ['السياق خارج السوق السعودي'], suggestedQuery: null };
  }
  if (answerability === 'no') {
    return { tier: 'ignore', reasons: [`توفيري لا يستطيع المساعدة فعليًا: ${answerabilityReason}`], suggestedQuery: null };
  }
  if (!cls.category) {
    return { tier: 'ignore', reasons: ['لم تتحدد فئة منتج مدعومة'], suggestedQuery: null };
  }
  if (isStale(c.postedAt)) {
    return { tier: 'ignore', reasons: ['المنشور أقدم من نافذة الرد المفيدة (48 ساعة)'], suggestedQuery: null };
  }
  if (c.authorHandle && c.authorHandle.toLowerCase() === 'tawveeri') {
    // Belt-and-braces with the query-level -from: exclusion (live-poll lesson).
    return { tier: 'ignore', reasons: ['منشور من حساب توفيري نفسه'], suggestedQuery: null };
  }
  if (isAccessoryQuestion(c.text)) {
    // Deterministic veto proven by the eval: the LLM classified "ابي كفر وستاند
    // لجوالي" as a mobile opportunity — an accessory ask is not a device purchase.
    return { tier: 'ignore', reasons: ['سؤال عن إكسسوار وليس عن الجهاز نفسه'], suggestedQuery: null };
  }

  // Decision-evidence scoring (promoted from Shadow, see the header note above) — includes its
  // OWN exclusion overrides (giveaway/contest, hyperbolic wish, + Checkpoint 5.1's six detectors).
  const scored = scoreDecisionEvidence(c.text, cls);
  if (scored.excluded) {
    const label = scored.exclusionDetail ? EXCLUSION_REASON_AR[scored.exclusionDetail] ?? scored.exclusionDetail : 'مستبعد';
    return { tier: 'ignore', reasons: [label], suggestedQuery: null };
  }

  const reasons = scored.reasons.map((r) => DECISION_EVIDENCE_REASON_AR[r] ?? r);
  reasons.push(answerability === 'yes' ? `توفيري قادر على المساعدة: ${answerabilityReason}` : `قدرة جزئية: ${answerabilityReason}`);
  const freshMinutes = c.postedAt ? Math.round((Date.now() - new Date(c.postedAt).getTime()) / 60000) : null;
  if (freshMinutes !== null && freshMinutes <= 120) reasons.push(`منشور حديث (قبل ${freshMinutes} دقيقة)`);
  reasons.push(`الفئة: ${categoryNameAr(cls.category)}`);

  const tier: Tier =
    scored.score >= 3 && answerability === 'yes' ? 'high' : scored.score >= 2 ? 'medium' : 'ignore';

  return { tier, reasons, suggestedQuery: buildSuggestedQuery(cls) };
}

/** The Tawveeri search the consumer (and the founder's reply) should use —
 *  built from classified fields only, never from fabricated facts. */
export function buildSuggestedQuery(cls: Classification): string | null {
  if (!cls.category) return null;
  const base: Record<string, string> = {
    mobile: 'جوال',
    laptop: 'لابتوب',
    tv: 'تلفزيون',
    air_conditioner: 'مكيف',
    refrigerator: 'ثلاجة',
    washing_machine: 'غسالة',
    tablet: 'ايباد',
    monitor: 'شاشة كمبيوتر',
    audio: 'سماعة',
  };
  const noun = base[cls.category] ?? cls.category;
  const parts = [noun];
  if (cls.intentClass === 'suitability') parts.push('مناسب');
  if (cls.budgetSar) parts.push(`تحت ${cls.budgetSar}`);
  return parts.join(' ');
}
