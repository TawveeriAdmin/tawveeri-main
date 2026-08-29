// Radar 2.0 Phase 2 — Checkpoint 5.1 (founder decision 2026-08-29):
// deterministic exclusion overrides targeting the EXACT failure modes
// surfaced by the 22-candidate founder-reviewed Checkpoint 5 sample. Every
// detector below is traceable to a specific observed case (cited inline).
//
// ISOLATION CONTRACT: this file is entirely new and Shadow-local. It does
// not import or modify heuristics.ts's isPostPurchaseStory()/
// isContestQuestion(), and it does not touch classify.ts's own
// prompt-construction logic — Radar 1's real classifier and its heuristic
// fallback are byte-for-byte unchanged. This module only post-processes the
// ALREADY-COMPUTED
// classification result for Shadow candidates, deterministic signals
// winning over the LLM's own 'exclusion' output when they fire (same
// "deterministic wins when unambiguous" discipline heuristics.ts already
// uses for lexicalCategory()).
//
// Deliberately narrow throughout: every marker list is sized to the
// observed cases, not a general-purpose NLP system — expansion should wait
// for more founder-reviewed data, not be guessed here.

import type { Classification } from '../types';
import type { ShadowExclusionClass } from './types';

export interface ExclusionOverrideResult {
  exclusion: ShadowExclusionClass;
  detail: string;
  categoryOverride?: null; // when set, the candidate's category should be nulled
}

// ---------------------------------------------------------------------------
// 1. Merchant / ad comparison bait
// Case: "🔥 TCL QLED 65 🆚 Samsung QLED 65 ... للطلب⬇️ #الهلال_الخليج" (×4,
// appeared with 2/4 inconsistently labeled 'valuable' by the founder).
// Small, evidence-backed SET — requires >=2 independent signals, never one
// brittle token (e.g. "للطلب" alone), per founder instruction.
// ---------------------------------------------------------------------------
const PROMO_CALL_TO_ACTION = ['للطلب', 'اطلبه الان', 'اطلبه الآن', 'اطلب الان', 'واتساب للطلب', 'تواصل معنا'];
const PROMO_HOOK_PHRASES = ['قبل ما تشتري', 'شوف المقارنة', 'شاهد المقارنة', 'اكتشف اي'];
const VS_MARKERS = ['🆚', ' vs ', ' VS ', 'مقابل'];
const PROMO_EMOJI = /[🔥📺🎮💰👀⬇️👏🤔]/g;

function countMerchantAdSignals(text: string): number {
  let signals = 0;
  if (PROMO_CALL_TO_ACTION.some((m) => text.includes(m))) signals++;
  if (PROMO_HOOK_PHRASES.some((m) => text.includes(m))) signals++;
  if (VS_MARKERS.some((m) => text.includes(m))) signals++;
  if ((text.match(PROMO_EMOJI) || []).length >= 3) signals++;
  if (text.includes('#') && text.includes('t.co/')) signals++;
  return signals;
}

export function isMerchantAdComparisonBait(text: string): boolean {
  return countMerchantAdSignals(text) >= 2;
}

// ---------------------------------------------------------------------------
// 2 & 3. Owned-device / decision-already-made
// Cases: "...شاري لابتوب...تتغير الخلفية...اعاني" (owns it, support Q);
// "...محتارة بين اشتري أيباد...أو ماك بوك...تم طلب ماك بوك🏃🏽‍♀️‍➡️" (decided).
// Explicit guard: never fires alongside genuine forward-purchase intent
// ("ناوي اشتري" / "ابي اشتري" / etc.) per founder instruction.
// ---------------------------------------------------------------------------
const OWNED_DEVICE_FORMS = ['شاري', 'شارية', 'مشتري', 'مشتريه', 'مشترية', 'اشتريت', 'شريت', 'جبت', 'اقتنيت', 'خذيت'];
const DECISION_MADE_FORMS = ['تم الطلب', 'تم طلب', 'خلاص طلبت', 'طلبته خلاص', 'تم طلبه'];
const FORWARD_INTENT_GUARD = [
  'ناوي اشتري', 'ناوي أشتري', 'ابي اشتري', 'أبي اشتري', 'ابغى اشتري', 'أبغى اشتري',
  'بشتري', 'ودي اشتري', 'ودي أشتري',
];

// OWNED_DEVICE_FORMS are single words, and a plain .includes() substring
// check false-positives on real data — "شاري" ("buying/owns") is a literal
// substring of "المشاريع" ("the projects"), which tripped both AutoCAD
// laptop posts in the founder-reviewed `valuable` sample. Require a whole
// token match instead (split on non-letter/non-digit runs — safe for
// Arabic, unlike a `\b`-based regex boundary).
const WORD_SPLIT = /[^\p{L}\p{N}]+/u;
function tokenize(text: string): string[] {
  return text.split(WORD_SPLIT).filter(Boolean);
}
function containsWholeWord(text: string, words: string[]): boolean {
  const tokens = tokenize(text);
  return words.some((w) => tokens.includes(w));
}

export function detectOwnedOrDecided(text: string): { fired: boolean; detail: string } {
  if (FORWARD_INTENT_GUARD.some((m) => text.includes(m))) return { fired: false, detail: '' };
  if (DECISION_MADE_FORMS.some((m) => text.includes(m))) return { fired: true, detail: 'decision_already_made' };
  if (containsWholeWord(text, OWNED_DEVICE_FORMS)) return { fired: true, detail: 'owns_device' };
  return { fired: false, detail: '' };
}

// ---------------------------------------------------------------------------
// 4. Owned-device support / migration / troubleshooting
// Case: "...وش افضل طريقة لنقل كل البيانات من ايفون إلى جالكسي؟" — a
// migration/support question about devices already owned, not a purchase
// decision. Co-occurrence check (verb + data-noun), not a single fixed
// phrase, since "نقل...البيانات" rarely appears as one contiguous phrase.
// ---------------------------------------------------------------------------
const MIGRATION_VERBS = ['نقل', 'تحويل', 'انقل'];
const DATA_NOUNS = ['البيانات', 'بياناتي', 'الداتا'];
const GENERIC_TROUBLESHOOTING = ['تتغير الخلفية', 'ما يشتغل', 'مشكلة في'];

export function detectSupportOrMigration(text: string): boolean {
  if (MIGRATION_VERBS.some((v) => text.includes(v)) && DATA_NOUNS.some((n) => text.includes(n))) return true;
  return GENERIC_TROUBLESHOOTING.some((m) => text.includes(m));
}

// ---------------------------------------------------------------------------
// 5. News / generic conversation
// Case: "في بريطانيا، الحرامية صاروا إذا سرقوا جوال واكتشفوا إنه سامسونج
// ...يرجعونه...وش رايكم انتم وش افضل عندك ايفون او اندرويد" — a news
// anecdote/opinion-poll post, not a purchase question, despite containing
// "وش افضل". Deliberately narrow — scoped to this observed shape
// (place-scoped 3rd-person narrative), not a general narrative detector.
// ---------------------------------------------------------------------------
const NARRATIVE_MARKERS = ['في بريطانيا', 'صاروا', 'حصل ان', 'حصل أن'];

export function isNewsOrGenericConversation(text: string): boolean {
  return NARRATIVE_MARKERS.some((m) => text.includes(m));
}

// ---------------------------------------------------------------------------
// 6. Category-adjacent ambiguity — carrier/SIM line, not a device
// Case: "وش أفضل شريحة جوال؟" — matched the mobile noun group ("جوال") but
// is asking about a carrier line/plan, not a phone.
// ---------------------------------------------------------------------------
export function isCarrierLineNotDevice(text: string, category: string | null): boolean {
  if (category !== 'mobile') return false;
  return text.includes('شريحة') || text.includes('خط جوال') || text.includes('باقة جوال');
}

// ---------------------------------------------------------------------------
// 7. Context-poor reply fragments — DEFERRED, NOT WIRED (founder review
// 2026-08-29). Original design: strip a leading @mention and fire when the
// remaining content is very short, on the theory that "short reply" implies
// "leans on unavailable parent-post context". Real counter-evidence: the
// sample's one genuine founder-rejected ambiguous/context-poor case —
// "@SaudiAndroid طيب وش افضل جالكسي من ناحيه الاستخدام والسعر" (رفض:
// not_a_lead) — is 45+ characters after stripping the mention, so this
// length-based test does not fire on it (correctly reported as a miss, not
// silently claimed as covered). The actual ambiguity in that case is an
// IMPLICIT ANTECEDENT ("جالكسي" — which Galaxy? — presumably referring to
// specific models named in the parent tweet this text doesn't include), not
// text length — and a structurally identical pattern (an implicit "او هو"
// antecedent in "@azizthemaster @androidkq ايش افضل سامسونج الترا ٢٦ او
// هو") was labeled `valuable` by the founder. No non-speculative textual
// rule in this file reliably separates those two cases, so this detector is
// deliberately left UNWIRED from applyShadowExclusionOverrides() below
// rather than broadened to force a fit. Resolving implicit-antecedent
// ambiguity needs the parent tweet's text, which is exactly what the
// separately-planned, not-yet-approved Context Resolver checkpoint exists
// for — this class of failure is explicitly deferred to it, not claimed
// here. The function is kept (tested on its own narrow terms below) as a
// possible building block for that future checkpoint, not as active
// Checkpoint 5.1 behavior.
// ---------------------------------------------------------------------------
export function isContextPoorReply(text: string): boolean {
  const trimmed = text.trim();
  const stripped = trimmed.replace(/^@\w+(\s+@\w+)*\s*/, '').trim();
  if (stripped.length === trimmed.length) return false; // not reply-shaped at all
  return stripped.length > 0 && stripped.length < 15;
}

// ---------------------------------------------------------------------------
// Combining function — fixed precedence, first match wins, never double-
// classifies. Falls through to the LLM's own `exclusion` value unchanged
// when nothing here fires. isContextPoorReply() is intentionally NOT called
// here — see the deferral note above §7.
// ---------------------------------------------------------------------------
export function applyShadowExclusionOverrides(text: string, cls: Classification): ExclusionOverrideResult | null {
  if (isMerchantAdComparisonBait(text)) return { exclusion: 'ad_seller', detail: 'merchant_ad_comparison_bait' };

  const ownedOrDecided = detectOwnedOrDecided(text);
  if (ownedOrDecided.fired) return { exclusion: 'post_purchase_story', detail: ownedOrDecided.detail };

  if (detectSupportOrMigration(text)) return { exclusion: 'support_complaint', detail: 'device_support_or_migration' };

  if (isNewsOrGenericConversation(text)) return { exclusion: 'news_review', detail: 'news_or_narrative_anecdote' };

  if (isCarrierLineNotDevice(text, cls.category)) {
    return { exclusion: 'generic_conversation', detail: 'carrier_sim_not_device', categoryOverride: null };
  }

  // isContextPoorReply(text) deliberately not called here — deferred, see §7 above.

  return null; // no override — keep the LLM's own classification as-is
}
