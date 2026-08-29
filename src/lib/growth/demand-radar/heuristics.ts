// Deterministic pre-filters (ADR-247). These run BEFORE any LLM call: they are
// cheap, explainable, and shrink the candidate set to what is worth classifying.
// Retrieved social text is UNTRUSTED DATA — these functions only ever *read* it.
//
// Arabic matching uses substring checks, never JS \b (which cannot match beside
// Arabic letters — see the bilingual-matching invariant).

import { createHmac } from 'crypto';
import {
  INTENT_MARKERS,
  NOISE_MARKERS,
  KSA_MARKERS,
  GULF_DIALECT_MARKERS,
  CATEGORY_LEXICONS,
} from './saudi-lexicon';
import type { KsaRelevance, IntentStrength } from './types';

const norm = (s: string) =>
  s
    .toLowerCase()
    // strip tatweel + Arabic diacritics so marker matching is form-insensitive
    .replace(/[ـً-ٰٟ]/g, '')
    // unify alef/hamza forms and taa marbuta for matching only
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');

const normalizedMarkers = (markers: string[]) => markers.map((m) => norm(m));

const N_INTENT = normalizedMarkers(INTENT_MARKERS);
const N_NOISE = normalizedMarkers(NOISE_MARKERS);
const N_KSA = normalizedMarkers(KSA_MARKERS);
const N_GULF = normalizedMarkers(GULF_DIALECT_MARKERS);

export function hasArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

/** Ad/news/review noise gate. True = discard before classification. */
export function looksLikeNoise(text: string): boolean {
  const t = norm(text);
  if (N_NOISE.some((m) => t.includes(m))) return true;
  // Promo shape: many hashtags or a price+link pitch with no question mark
  const hashtags = (text.match(/#/g) || []).length;
  if (hashtags >= 4) return true;
  const hasLink = /https?:\/\//.test(text);
  const hasQuestion = text.includes('؟') || text.includes('?');
  if (hasLink && !hasQuestion && hashtags >= 2) return true;
  return false;
}

/** Lexical purchase-intent strength (candidate signal, not the decision). */
export function lexicalIntent(text: string): { strength: IntentStrength; hits: string[] } {
  const t = norm(text);
  const hits = INTENT_MARKERS.filter((m, i) => t.includes(N_INTENT[i]));
  const hasQuestion = text.includes('؟') || text.includes('?');
  if (hits.length >= 2 || (hits.length === 1 && hasQuestion)) return { strength: 'strong', hits };
  if (hits.length === 1 || hasQuestion) return { strength: 'weak', hits };
  return { strength: 'none', hits };
}

/** Lexical category guess — the LLM may refine; deterministic wins when unambiguous. */
export function lexicalCategory(text: string): { category: string | null; ambiguous: boolean } {
  const t = norm(text);
  const matched = CATEGORY_LEXICONS.filter((c) =>
    c.keywords.some((k) => t.includes(norm(k)))
  ).map((c) => c.category);
  if (matched.length === 1) return { category: matched[0], ambiguous: false };
  if (matched.length > 1) return { category: null, ambiguous: true };
  return { category: null, ambiguous: false };
}

/** Evidence-based KSA relevance. CONFIRMED needs an explicit Saudi signal;
 *  LIKELY needs Gulf-dialect markers; otherwise UNKNOWN. Never guesses. */
export function ksaRelevance(text: string, authorBioOrLocation?: string | null): KsaRelevance {
  const t = norm(text + ' ' + (authorBioOrLocation ?? ''));
  if (N_KSA.some((m) => t.includes(m))) return 'confirmed';
  if (N_GULF.some((m) => t.includes(m))) return 'likely';
  return 'unknown';
}

// Accessory tokens: a question about a case/stand/charger mentions the device
// but is NOT a device-purchase opportunity. Deterministic veto (the eval showed
// the LLM alone lets these through — R-style guard, not prompt hope).
const ACCESSORY_TOKENS = [
  'كفر', 'جراب', 'ستاند', 'حامل', 'شاحن', 'كيبل', 'كابل', 'وصلة',
  'لصقة', 'لاصقة', 'حماية شاشة', 'سكرين', 'ريموت', 'فلتر', 'قاعدة',
].map((t) => norm(t));

/** True when the text is asking about an ACCESSORY for a device, not the device. */
export function isAccessoryQuestion(text: string): boolean {
  const t = norm(text);
  return ACCESSORY_TOKENS.some((a) => t.includes(a));
}

/** Stale gate: a purchase question loses reply value quickly. */
export function isStale(postedAtIso: string | null, maxHours = 48): boolean {
  if (!postedAtIso) return false; // unknown age ≠ stale; ranking will down-weight
  const age = Date.now() - new Date(postedAtIso).getTime();
  return Number.isFinite(age) && age > maxHours * 3600_000;
}

/** Thread/duplicate key: prefer the source conversation id; fall back to a
 *  normalized-text fingerprint so the same question re-posted dedups too. */
export function dedupKey(sourcePostId: string, threadKey: string | null, text: string): string {
  if (threadKey) return `thread:${threadKey}`;
  const fp = norm(text).replace(/\s+/g, ' ').trim().slice(0, 120);
  return `text:${fp}`;
}

// ---- Funnel observability fingerprint (Radar 2.0 Phase 1) -----------------
// A stable, ONE-WAY, keyed hash used only for cross-stage/cross-time dedup in
// the de-identified funnel event log — never the raw source_post_id, which
// resolves directly to a public URL and must never enter that log. The key
// lives only in server env config, is never logged, and is never stored next
// to the fingerprints it produces. Falls back to CRON_SECRET (already
// server-only, already provisioned) when DEMAND_RADAR_FINGERPRINT_SECRET is
// unset, so Phase 1 doesn't require a brand-new secret before it can even be
// tested — see the Phase 1 doc's §E note recommending a dedicated secret
// before Phase 2 widens this system's real usage.
function fingerprintSecret(): string | null {
  return process.env.DEMAND_RADAR_FINGERPRINT_SECRET || process.env.CRON_SECRET || null;
}

/** Returns null (never a guessable placeholder) when no secret is configured
 *  at all — an explicit "can't fingerprint" state, matching the codebase's
 *  own "unconfigured, never a silent wrong value" discipline. */
export function candidateFingerprint(source: string, sourcePostId: string | null, text: string): string | null {
  const secret = fingerprintSecret();
  if (!secret) return null;
  const basis = sourcePostId ? `${source}:${sourcePostId}` : `${source}:text:${norm(text).slice(0, 200)}`;
  return createHmac('sha256', secret).update(basis).digest('hex');
}

// ---- Deterministic exclusion signals (Radar 2.0 Phase 1) ------------------
// Founder-review lesson: a real HIGH-scored candidate turned out to be a
// contest entry or a past-tense purchase story. These are deterministic
// vetoes for the SAME reason isAccessoryQuestion() above is deterministic —
// "the eval showed the LLM alone lets these through — a guard, not prompt
// hope." Phase 1 computes and logs these for measurement only; they do not
// change rank.ts's real tier decision (see rank.ts's computeOpportunityScore).

const CONTEST_TOKENS = [
  'مسابقة', 'سحب على', 'قرعة', 'تفاعل وربح', 'شارك وربح', 'منشن صديق',
  'اعادة تغريد وربح', 'لو فزت', 'يارب افوز', 'يارب أفوز', 'ريتوت وربح',
].map((t) => norm(t));

/** True when the text reads as a contest/giveaway entry rather than a real
 *  purchase question — even when it also contains a genuine intent marker
 *  (e.g. "يارب أفوز بالمسابقة أبي آيفون" still says "أبي"). */
export function isContestQuestion(text: string): boolean {
  const t = norm(text);
  return CONTEST_TOKENS.some((m) => t.includes(m));
}

// First-person past-tense purchase verbs. Deliberately distinct from
// INTENT_MARKERS' 'اشتري'/'أشتري' (present/imperative stem) — "اشتريت" shares
// that root and already trips the generic intent-marker match today, which
// is exactly the false-positive class this targets (founder example: "اشتريت
// لي جوال جديد" reads as a post-purchase story, not a purchase intent).
const POST_PURCHASE_TOKENS = ['اشتريت', 'شريت', 'جبت', 'اقتنيت', 'خذيت'].map((t) => norm(t));

/** True when the text is a past-tense purchase story, not a forward-looking
 *  purchase question. */
export function isPostPurchaseStory(text: string): boolean {
  const t = norm(text);
  return POST_PURCHASE_TOKENS.some((m) => t.includes(m));
}
