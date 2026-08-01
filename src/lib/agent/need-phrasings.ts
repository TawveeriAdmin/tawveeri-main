// THE ONE PLACE THAT TEACHES "a sentence is a valid query" (ADR-171).
//
// WHY THE CAPABILITY WAS INVISIBLE — the honest history, because neither step was wrong alone:
//
//   1. The homepage used to offer وفّر beside the search box. It was removed on 2026-07-29
//      because the first screen then carried TWO doors to the same assistant — a measured
//      homepage-journey failure in both locales.
//   2. The persistent nav item it was removed IN FAVOUR OF was itself retired by ADR-152:
//      «وفّر» in the header was exactly the "choose between search and AI" fork the
//      Constitution forbids.
//
// Each removal was correct. Together they left ZERO entry points, and the comment in
// `unified-home.tsx` still pointed at a nav item that no longer existed. Measured 2026-08-01:
// zero `href` to `/advisor` on `/ar` and `/en`.
//
// THE FIX IS NOT A NEW ENTRY POINT. `/search` already routes by intent — `routeQuery()` sends a
// need-based query to the deterministic engine and renders the answer above the results, with the
// AI disclosure as its first child. The homepage search box posts to that same field. So the
// capability is REACHABLE; it was only UNDISCOVERABLE. Adding a second door would recreate
// failure (1); restoring the nav item would recreate failure (2).
//
// What was missing is that nothing on the first screen REVEALED that the box accepts a sentence.
// `/search` already teaches this. The homepage — where a first-time visitor actually lands —
// did not.
//
// WHY THESE LIVE IN ONE MODULE. The phrasings are the teaching, and two surfaces teaching
// different sentences is the same class of defect as the rendered-but-unpublished delta and the
// rounded-vs-raw price: one fact with two representations and no single source. Both surfaces
// import this.
//
// THEY ARE QUERIES, NOT CLAIMS. Each string is an example of what a CUSTOMER may type. None
// asserts anything about coverage, price or availability, so none is governed by
// LAUNCH_VOCABULARY's CAN SAY / MUST NOT SAY — and each is a category the engine actually
// advises on, so every one of them completes.

export const NEED_PHRASINGS: Record<'ar' | 'en', readonly string[]> = {
  ar: ['مكيف لغرفة 30 متر هادئ تحت 4000', 'لابتوب للألعاب تحت 5000', 'غسالة صحون كبيرة للعائلة'],
  en: ['a quiet AC for a 30 m² room under 4000', 'a gaming laptop under 5000', 'a large family dishwasher'],
} as const;

/** The label that introduces them. Deliberately an invitation, never a feature name. */
export const NEED_PROMPT: Record<'ar' | 'en', string> = {
  ar: 'أو صِف ما تحتاجه:',
  en: 'Or describe what you need:',
} as const;

export const needPhrasings = (locale: string): readonly string[] =>
  NEED_PHRASINGS[locale === 'ar' ? 'ar' : 'en'];

export const needPrompt = (locale: string): string =>
  NEED_PROMPT[locale === 'ar' ? 'ar' : 'en'];
