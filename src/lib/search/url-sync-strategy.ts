// src/lib/search/url-sync-strategy.ts
//
// Founder back-navigation audit (2026-09-08): the search page's URL write-back effect
// (search-client.tsx) used `router.replace` unconditionally (ADR-282, to avoid bloating
// history on every filter/sort/page chip toggle). That also meant a genuinely NEW search —
// e.g. the advisor answering "مكيف لغرفة 30 متر هادئ تحت 4000" while already on /search — never
// earned its own history entry. Browser Back from a later page (compare/merchant) then skipped
// past it entirely, landing on whatever preceded it.
//
// Extracted as a pure predicate so the push-vs-replace decision is unit-testable without
// rendering the whole search page component.

export interface SearchSubject {
  /** The search query text (debounced). */
  q: string;
  /** The selected category, or 'all'. */
  cat: string;
}

/**
 * True when `next` is a genuinely different search subject than `prev` (query text or
 * category changed) — earns its own history entry (`router.push`) so Back can return to it.
 * False when only filters/sort/page changed on the SAME subject — keeps replacing
 * (`router.replace`), exactly as ADR-282 intended, so chip toggles never bloat history.
 */
export function isNewSearchSubject(prev: SearchSubject | null, next: SearchSubject): boolean {
  return !prev || prev.q !== next.q || prev.cat !== next.cat;
}
