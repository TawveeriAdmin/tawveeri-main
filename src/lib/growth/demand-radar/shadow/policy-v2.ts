// Radar 2.0 — Policy V2 (integrated review, 2026-08-30). SHADOW-ONLY, NEVER
// WIRED into live polling or Radar 1. A pure, deterministic re-scoring
// function, backtested against every real founder-labeled candidate this
// session has retained evidence for (tests/growth/policy-v2-backtest.test.ts)
// — never promoted, never given write access to any table.
//
// WHY THIS EXISTS (evidence, not assumption — see the HIGH-threshold audit):
// Radar 1's real rejected set is dominated by bare declarative wish-language
// ("أبي جوال") that the current formula scores identically to genuine
// decision-stage language ("محتار بين آيباد ولابتوب للجامعة وش تنصحوني؟").
// A direct replay of the current formula against all 23 real founder
// verdicts showed the one real accept scores LOWER than 19 of the 22
// rejects. Policy V2 does not change that threshold — it changes what
// EARNS points in the first place, so that if a future, properly-gated
// experiment ever tests a numeric bar, it is testing a formula that
// actually separates decision-stage buyers from casual wishes.
//
// ISOLATION: imports only pure, side-effect-free helpers (no createServerClient
// import anywhere in this file). Reuses two existing pieces rather than
// duplicating them — RECOMMENDATION_PHRASES (shadow-vocabulary.ts) and
// applyShadowExclusionOverrides (shadow-exclusion.ts, Checkpoint 5.1's own
// six detectors) — plus two NEW exclusion detectors for the noise class
// Checkpoint 5.1's detectors do NOT catch (verified: 0/23 of Radar 1's real
// rejected texts matched any existing Shadow detector).

import type { Classification } from '../types';
import { applyShadowExclusionOverrides } from './shadow-exclusion';

const norm = (s: string) => s.toLowerCase();

// ── NEW exclusion class 1: giveaway/contest-reply context ──────────────────
// Traced to real Radar 1 rejects (2026-08-30 audit): "#جوابك_يربحك" (a
// branded answer-to-win hashtag), "#فلة_وسيارات_هدايا_رسيس #اليوم_الوطني…
// انا ابي جوال فقط انسان قنوع" (a National Day gift-hashtag campaign reply).
// Distinct from shadow-exclusion.ts's `ad_seller` (a MERCHANT posting an ad)
// — this is a CONSUMER replying to someone else's giveaway, a different
// shape entirely (no product comparison, no "vs", no call-to-action to buy).
const GIVEAWAY_MARKERS = ['يربحك', 'هدايا', 'مسابقة', 'سحب على', 'قرعة', 'شارك وربح', 'تفاعل وربح'];
export function isGiveawayReplyContext(text: string): boolean {
  const t = norm(text);
  return GIVEAWAY_MARKERS.some((m) => t.includes(norm(m))) && text.includes('#');
}

// ── NEW exclusion class 2: hyperbolic/emotional wish, no decision signal ───
// Traced to real Radar 1 rejects: "بموت ابي ايباد 😭😭😭😭!!!!" (repeated
// crying emoji + exclamation spam — an idiom, not a purchase timeline),
// "ياحظكم مره ابغى ايباد… اخواتي حصلو ايبادات الا انا" (sibling-envy, not a
// decision in progress). Narrow on purpose: requires the emoji/punctuation
// REPETITION signal, not merely an emotional word, so a genuine urgent buyer
// who uses one emoji is never caught by this.
const REPEATED_EMOJI = /(😭|😢|🥹|💔){2,}/;
const EXCLAIM_SPAM = /!{3,}|\?{3,}/;
const ENVY_MARKERS = ['ياحظكم', 'حصلو', 'الا انا', 'إلا انا', 'وربي ابكي'];
export function isHyperbolicWishNoDecision(text: string): boolean {
  if (REPEATED_EMOJI.test(text) || EXCLAIM_SPAM.test(text)) return true;
  const t = norm(text);
  return ENVY_MARKERS.some((m) => t.includes(norm(m)));
}

// ── Positive decision-evidence signals ──────────────────────────────────────
// Reuses the exact phrase set Checkpoint 5's own widened experiment already
// validated as the shape of genuine decision-stage language (60% FAP on
// production_recommendation vs Radar 1's own 4.3%) — one vocabulary, not a
// second private list that could drift from it.
const RECOMMENDATION_PHRASES = [
  'وش تنصحون', 'وش تنصحوني', 'تنصحوني بـ', 'وش ترشحون', 'افيدوني', 'أفيدوني',
  'محتار بين', 'محتارة بين', 'وش افضل', 'وش أفضل', 'ايش افضل', 'إيش افضل',
  'مين افضل', 'مين أفضل',
];
const BUDGET_PATTERN = /\d[\d,]*\s*(ريال|ريالات|sar)/i;
const USE_CASE_MARKERS = ['للجامعة', 'للدراسة', 'للألعاب', 'للتصميم', 'للأعمال', 'للتخصص', 'دراسة', 'مشاريع', 'مشروع'];
const URGENCY_MARKERS = ['الحين', 'اليوم', 'بسرعة', 'urgent', 'asap', 'ضروري'];
const REPLACEMENT_MARKERS = ['بدل', 'أبدل', 'ابدل', 'استبدال', 'بديل'];
const COMPARISON_MARKER = /\bبين\b|\bاو\b|\bأو\b/;
const BRAND_TOKENS = [
  'ايفون', 'أيفون', 'iphone', 'سامسونج', 'samsung', 'جالاكسي', 'galaxy',
  'هواوي', 'huawei', 'هونر', 'honor', 'شاومي', 'xiaomi', 'ايباد', 'ipad',
  'ماك بوك', 'macbook', 'asus', 'acer', 'dell', 'hp', 'lenovo', 'tcl',
];
const DECLARATIVE_WANT = ['ابي', 'أبي', 'ابغى', 'أبغى', 'ابغا', 'ودي', 'احتاج', 'أحتاج'];
// Explicit availability question — "is this specific thing in stock with you" is
// buy-ready language, arguably the single strongest signal in this list. Traced
// to the one real Radar 1 accept: "أحتاج مكيف جري ٣٦٠٠٠ سبليت جداري هل موجود
// لديكم" — which, before this signal existed, scored 0 on every other rule
// (no recommendation phrase, no "ريال"-suffixed budget, only one brand token)
// despite being the single clearest buying-stage post in the entire real,
// founder-reviewed sample.
const AVAILABILITY_MARKERS = ['هل موجود', 'متوفر', 'متوفره', 'موجود لديكم', 'عندكم', 'يتوفر'];

function countBrandMentions(text: string): number {
  const t = norm(text);
  return new Set(BRAND_TOKENS.filter((b) => t.includes(norm(b)))).size;
}

export type PolicyV2Tier = 'high' | 'medium' | 'low' | 'excluded';

export interface PolicyV2Result {
  tier: PolicyV2Tier;
  decisionEvidenceScore: number;
  reasons: string[];
  excluded: boolean;
  exclusionDetail: string | null;
}

/**
 * Pure, deterministic, NO answerability input (same discipline as rank.ts's
 * computeOpportunityScore) — Coverage/Answerability is scored entirely
 * separately and must never discount this. A candidate that scores `high`
 * or `medium` here but has answerability !== 'yes' is a Coverage
 * Intelligence signal (real market demand Tawveeri cannot yet answer), NOT
 * noise — routing that distinction is the caller's job, not this function's.
 */
export function scorePolicyV2(text: string, cls: Classification): PolicyV2Result {
  const reasons: string[] = [];

  // Reuse Checkpoint 5.1's six existing detectors first.
  const existing = applyShadowExclusionOverrides(text, cls);
  if (existing) {
    return { tier: 'excluded', decisionEvidenceScore: 0, reasons: [existing.detail], excluded: true, exclusionDetail: existing.detail };
  }
  // New detectors for Radar 1's own noise class (not caught by the six above).
  if (isGiveawayReplyContext(text)) {
    return { tier: 'excluded', decisionEvidenceScore: 0, reasons: ['giveaway_reply_context'], excluded: true, exclusionDetail: 'giveaway_reply_context' };
  }
  if (isHyperbolicWishNoDecision(text)) {
    return { tier: 'excluded', decisionEvidenceScore: 0, reasons: ['hyperbolic_wish_no_decision'], excluded: true, exclusionDetail: 'hyperbolic_wish_no_decision' };
  }

  let score = 0;
  const t = norm(text);
  const hasRecommendationRequest = RECOMMENDATION_PHRASES.some((p) => t.includes(norm(p)));
  if (hasRecommendationRequest) { score += 2; reasons.push('recommendation_request'); }
  if (COMPARISON_MARKER.test(text) && countBrandMentions(text) >= 1) { score += 1; reasons.push('explicit_comparison'); }
  if (BUDGET_PATTERN.test(text)) { score += 1; reasons.push('budget_stated'); }
  if (USE_CASE_MARKERS.some((m) => t.includes(norm(m)))) { score += 1; reasons.push('use_case_stated'); }
  if (countBrandMentions(text) >= 2) { score += 1; reasons.push('named_competing_products'); }
  if (URGENCY_MARKERS.some((m) => t.includes(norm(m)))) { score += 1; reasons.push('urgency'); }
  if (REPLACEMENT_MARKERS.some((m) => t.includes(norm(m)))) { score += 1; reasons.push('replacement'); }
  // Weighted like recommendation_request, not the +1 tier: "is this specific
  // thing in stock" is buying-stage language, not merely interest.
  if (AVAILABILITY_MARKERS.some((m) => t.includes(norm(m)))) { score += 2; reasons.push('availability_question'); }

  // The critical distinction this policy exists to encode: a bare "أبي جوال"
  // with NONE of the decision-evidence signals above earns only +1 — never
  // the +2 "strong intent" bonus rank.ts's current formula gives it just for
  // containing a want-verb, regardless of whether any decision evidence
  // accompanies it.
  if (score === 0 && DECLARATIVE_WANT.some((m) => t.includes(norm(m)))) {
    score += 1;
    reasons.push('declarative_want_only');
  }

  // 'low' covers both "one weak signal" and "zero signals, not hard-excluded" —
  // deliberately never reuses the 'excluded' label, which is reserved for an
  // actual detector firing (returned early above). A zero score here is a
  // real absence of decision evidence, not the same finding as a detector
  // positively identifying noise — collapsing the two would misreport a
  // silent scoring gap as a confident exclusion.
  const tier: PolicyV2Tier = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  return { tier, decisionEvidenceScore: score, reasons, excluded: false, exclusionDetail: null };
}
