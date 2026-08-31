// Demand Radar — decision-evidence scoring (end-to-end redesign, 2026-08-31, founder-authorized).
// Promoted out of Shadow (shadow/policy-v2.ts) into Radar 1's real path, on real evidence:
// backtested against every real founder-labeled text this codebase has retained (Radar 1's own
// 23-item history + Shadow's 25-item PRODUCT_RECOMMENDATION pool + a fresh 12-item real batch,
// n=59 total) —
//   current points-formula: 27.5% precision / 82.4% recall, 51/59 surfaced
//   this scoring, same hard gates:  77.8% precision / 82.4% recall, 18/59 surfaced
// Same recall (nothing the founder would have seen is now hidden), 65% fewer items to review,
// because it rewards WHAT the language says (recommendation/comparison/availability-seeking)
// instead of WHETHER a want-verb is present at all — "أبي جوال" and "محتار بين آيباد ولابتوب
// وش تنصحوني؟" scored identically under the old formula; they do not here.
//
// This file has NO write-path dependency (no createServerClient import) — pure, deterministic,
// testable without a database. rank.ts (Radar 1, real) and shadow/policy-v2.ts (Shadow, kept for
// its own continued backtest/experiment use) both compose this.
import type { Classification } from './types';
import { applyShadowExclusionOverrides } from './shadow/shadow-exclusion';
import { detectDecisionEvidence } from '@/lib/language/decision-evidence';

const norm = (s: string) => s.toLowerCase();

// ── Exclusion: giveaway/contest-reply context ───────────────────────────────
// Traced to real Radar 1 rejects (2026-08-30 audit): "#جوابك_يربحك" (a branded
// answer-to-win hashtag), "#فلة_وسيارات_هدايا_رسيس #اليوم_الوطني… انا ابي جوال
// فقط انسان قنوع" (a National Day gift-hashtag campaign reply). Distinct from
// shadow-exclusion.ts's `ad_seller` (a MERCHANT posting an ad) — this is a
// CONSUMER replying to someone else's giveaway, a different shape entirely.
const GIVEAWAY_MARKERS = ['يربحك', 'هدايا', 'مسابقة', 'سحب على', 'قرعة', 'شارك وربح', 'تفاعل وربح'];
export function isGiveawayReplyContext(text: string): boolean {
  const t = norm(text);
  return GIVEAWAY_MARKERS.some((m) => t.includes(norm(m))) && text.includes('#');
}

// ── Exclusion: hyperbolic/emotional wish, no decision signal ───────────────
// Traced to real Radar 1 rejects: "بموت ابي ايباد 😭😭😭😭!!!!" (repeated crying
// emoji + exclamation spam — an idiom, not a purchase timeline), "ياحظكم مره
// ابغى ايباد… اخواتي حصلو ايبادات الا انا" (sibling-envy, not a decision in
// progress). Narrow on purpose: requires the emoji/punctuation REPETITION
// signal, not merely an emotional word, so a genuine urgent buyer who uses
// one emoji is never caught by this.
const REPEATED_EMOJI = /(😭|😢|🥹|💔){2,}/;
const EXCLAIM_SPAM = /!{3,}|\?{3,}/;
const ENVY_MARKERS = ['ياحظكم', 'حصلو', 'الا انا', 'إلا انا', 'وربي ابكي'];
export function isHyperbolicWishNoDecision(text: string): boolean {
  if (REPEATED_EMOJI.test(text) || EXCLAIM_SPAM.test(text)) return true;
  const t = norm(text);
  return ENVY_MARKERS.some((m) => t.includes(norm(m)));
}

export interface DecisionEvidenceScoreResult {
  score: number;
  reasons: string[];
  excluded: boolean;
  exclusionDetail: string | null;
}

/**
 * Pure, deterministic, NO answerability/freshness/staleness input by design — those remain the
 * CALLER's job (rank.ts's existing hard gates), exactly as before. A candidate that scores well
 * here but has answerability !== 'yes' is a Coverage Intelligence signal (real market demand
 * Tawveeri cannot yet answer), not noise — routing that distinction stays the caller's.
 */
export function scoreDecisionEvidence(text: string, cls: Classification): DecisionEvidenceScoreResult {
  // Reuse Checkpoint 5.1's six existing detectors first (device_support_or_migration,
  // carrier_sim_not_device, ad_seller, etc. — see shadow-exclusion.ts).
  const existing = applyShadowExclusionOverrides(text, cls);
  if (existing) return { score: 0, reasons: [existing.detail], excluded: true, exclusionDetail: existing.detail };
  if (isGiveawayReplyContext(text)) return { score: 0, reasons: ['giveaway_reply_context'], excluded: true, exclusionDetail: 'giveaway_reply_context' };
  if (isHyperbolicWishNoDecision(text)) return { score: 0, reasons: ['hyperbolic_wish_no_decision'], excluded: true, exclusionDetail: 'hyperbolic_wish_no_decision' };

  let score = 0;
  const reasons: string[] = [];
  const signals = detectDecisionEvidence(text);
  if (signals.recommendationRequest) { score += 2; reasons.push('recommendation_request'); }
  if (signals.explicitComparison) { score += 1; reasons.push('explicit_comparison'); }
  if (signals.budgetStated) { score += 1; reasons.push('budget_stated'); }
  if (signals.useCaseStated) { score += 1; reasons.push('use_case_stated'); }
  if (signals.namedCompetingProducts) { score += 1; reasons.push('named_competing_products'); }
  if (signals.urgency) { score += 1; reasons.push('urgency'); }
  if (signals.replacement) { score += 1; reasons.push('replacement'); }
  // Weighted like recommendation_request, not the +1 tier: "is this specific thing in stock" is
  // buying-stage language, not merely interest.
  if (signals.availabilityQuestion) { score += 2; reasons.push('availability_question'); }
  // The critical distinction this scoring exists to encode: a bare "أبي جوال" with NONE of the
  // decision-evidence signals above earns only +1 — never the +2 "strong intent" bonus the old
  // formula gave it just for containing a want-verb, regardless of decision evidence.
  if (signals.declarativeWantOnly) { score += 1; reasons.push('declarative_want_only'); }

  return { score, reasons, excluded: false, exclusionDetail: null };
}
