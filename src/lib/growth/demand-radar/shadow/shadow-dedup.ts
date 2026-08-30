// Radar 2.0 Phase 2 — Checkpoint 5.1: privacy-safe near-duplicate
// suppression. Case: the same "TCL QLED 65 🆚 Samsung QLED 65" promotional
// template appeared 4 times, each varying only by its tracking link and
// hashtag — today's exact-match dedup (source_post_id + exact-text
// fingerprint) never catches these because the raw text differs.
//
// Design: normalize away exactly the parts that vary between near-dupes
// (URLs, hashtags, emoji, punctuation, whitespace), then reuse the SAME
// privacy-safe HMAC fingerprint mechanism already established for identity
// (heuristics.ts::candidateFingerprint) — no new secret, no raw text
// retained beyond the normal 72h review-queue lifecycle, just a different
// input to the same one-way hash.
//
// SCOPE: within-run suppression only (an in-memory Set for the duration of
// one poll). Cross-run near-dup detection (the same ad reposted on a LATER
// day) would need a persisted content-fingerprint column — not built here;
// the observed failure was entirely within a single run, and no migration
// was authorized for this checkpoint.

import { candidateFingerprint } from '../heuristics';

const URL_PATTERN = /https?:\/\/\S+/g;
const HASHTAG_PATTERN = /#\S+/g;
const MENTION_PATTERN = /@\w+/g;
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

export function normalizeForNearDupDetection(text: string): string {
  return text
    .replace(URL_PATTERN, '')
    .replace(HASHTAG_PATTERN, '')
    .replace(MENTION_PATTERN, '')
    .replace(EMOJI_PATTERN, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip remaining punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** One-way, privacy-safe content fingerprint — same HMAC mechanism as
 *  identity fingerprinting, applied to normalized (link/hashtag/emoji-
 *  stripped) text instead of the post ID. */
export function computeContentFingerprint(source: string, text: string): string | null {
  const normalized = normalizeForNearDupDetection(text);
  if (!normalized) return null;
  return candidateFingerprint(source, null, normalized);
}

/** Tracks content fingerprints seen within one run. Call `seen()` before
 *  processing a candidate; if it returns true, the candidate is a near-
 *  duplicate of one already processed this run and should be suppressed
 *  (logged, not stored) rather than treated as a distinct opportunity. */
export class NearDuplicateTracker {
  private seenFingerprints = new Set<string>();

  seen(source: string, text: string): boolean {
    const fp = computeContentFingerprint(source, text);
    if (!fp) return false; // could not fingerprint (e.g. empty after normalization) — never suppress on a null
    if (this.seenFingerprints.has(fp)) return true;
    this.seenFingerprints.add(fp);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Near-duplicate suppression audit (founder decision 2026-08-30). Suppressed
// candidates are otherwise unmeasurable — they never reach founder review, so
// their own false-suppression rate can't be checked. This copies a small,
// capped, deterministically-selected sample into Shadow Review for
// measurement only (see shadow-recommendation-experiment.ts's post-loop
// audit pass) — it never affects which candidates get suppressed from the
// primary temporal-validation track.
// ---------------------------------------------------------------------------
export const SUPPRESSION_AUDIT_CAP = 5;

/** Deterministic, order-independent selection: sort by identity fingerprint
 *  (a stable, uniformly-distributed hex string already computed for every
 *  candidate) and take the first N. This is intentionally NOT "whichever
 *  five appeared first in poll order" — that would bias toward one category
 *  or one moment in the X search results ordering; sorting by fingerprint
 *  gives the same selection regardless of iteration/arrival order, and the
 *  same selection again if this were ever re-run against the same data. */
export function selectSuppressionAuditSample<T extends { fingerprint: string }>(
  candidates: T[],
  cap: number = SUPPRESSION_AUDIT_CAP
): T[] {
  return candidates
    .slice()
    .sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0))
    .slice(0, cap);
}
