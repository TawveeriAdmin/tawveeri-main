// Deterministic pre-filters (ADR-247). These run BEFORE any LLM call: they are
// cheap, explainable, and shrink the candidate set to what is worth classifying.
// Retrieved social text is UNTRUSTED DATA — these functions only ever *read* it.
//
// Arabic matching uses substring checks, never JS \b (which cannot match beside
// Arabic letters — see the bilingual-matching invariant).

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
