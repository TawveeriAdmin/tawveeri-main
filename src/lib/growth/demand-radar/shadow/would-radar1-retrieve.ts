// Radar 2.0 Phase 2 — the Control/Treatment comparison primitive
// (Checkpoint 4, architecture doc §M/§N). A PURE function replaying Radar
// 1's CURRENT, unchanged retrieval logic against arbitrary candidate text —
// never a live re-poll of Radar 1, never a stored history lookup. Imports
// CATEGORY_LEXICONS (read-only DATA, not a write path) directly from the
// same source of truth Radar 1's own adapters.ts uses, so this replay can
// never silently drift out of sync with the real queries.
//
// Matching mirrors X's own literal quoted-phrase OR-matching as faithfully
// as possible: EXACT substring containment, no normalization — the codebase's
// own xQuery strings already spell out both hamza forms as separate OR'd
// phrases specifically because X's server-side matching is not assumed to
// auto-normalize hamza (see saudi-lexicon.ts's own header comment).

import { CATEGORY_LEXICONS } from '../saudi-lexicon';

export interface Radar1RetrievalCheck {
  matched: boolean;
  matchedCategory: string | null;
  matchedPhrase: string | null;
}

function extractQuotedPhrases(xQuery: string): string[] {
  const matches = xQuery.match(/"([^"]+)"/g) ?? [];
  return matches.map((m) => m.slice(1, -1));
}

const CATEGORY_PHRASES: Array<{ category: string; phrases: string[] }> = CATEGORY_LEXICONS.map((c) => ({
  category: c.category,
  phrases: extractQuotedPhrases(c.xQuery),
}));

/** Would Radar 1's CURRENT (unwidened) query set have retrieved this text?
 *  Checks every category's exact quoted phrases; returns the first match
 *  found (category order follows CATEGORY_LEXICONS, unchanged). */
export function wouldRadar1Retrieve(text: string): Radar1RetrievalCheck {
  for (const { category, phrases } of CATEGORY_PHRASES) {
    for (const phrase of phrases) {
      if (text.includes(phrase)) {
        return { matched: true, matchedCategory: category, matchedPhrase: phrase };
      }
    }
  }
  return { matched: false, matchedCategory: null, matchedPhrase: null };
}
