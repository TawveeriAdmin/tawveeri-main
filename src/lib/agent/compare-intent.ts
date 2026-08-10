// src/lib/agent/compare-intent.ts
// UNIFIED SEARCH → "Comparison requests may generate structured comparisons."
//
// This file decides ONLY what the shopper asked for. It never decides whether we can
// deliver it — that is `resolve-comparison.ts`, and it is a separate file on purpose:
// intent is a property of the sentence, deliverability is a property of the data, and
// conflating them is how a shopper ends up on an empty comparison page.
//
// Deterministic and LLM-free (ADR-002).

/**
 * Arabic orthography varies more than the regexes would survive: أ/إ/آ→ا, ة→ه, ى→ي, and
 * the tatweel/diacritics that arrive from copy-paste. Normalising once here means each
 * marker below is written one way instead of six.
 */
export function normalizeAr(t: string): string {
  return (t || '')
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, '') // harakat
    .replace(/ـ/g, '')                 // tatweel
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Markers that mean "compare two things". Ordered longest-first where they overlap. */
const PAIR_MARKERS = [
  'الفرق بين', 'الفروقات بين', 'المقارنه بين', 'مقارنه بين', 'قارن بين', 'قارن لي بين',
  'ايهما افضل', 'ايهما احسن', 'ايش افضل', 'وش افضل', 'مين احسن', 'مين افضل',
  'difference between', 'differences between', 'which is better', 'which one is better',
  'compare between',
];

/** Markers that mean "compare prices for this one thing". */
const SINGLE_MARKERS = [
  'قارن اسعار', 'قارن سعر', 'مقارنه اسعار', 'قارن', 'مقارنه',
  'وين ارخص', 'وين اقل سعر', 'ارخص سعر', 'افضل سعر', 'اقل سعر', 'وين الاوفر', 'بكم يجي',
  'compare prices', 'compare price', 'price comparison', 'compare',
  'cheapest', 'best price', 'lowest price', 'where is the cheapest',
];

/** Infix separators that split a pair when no "between" marker framed it.
 *
 * MEASURED FAILURE (2026-08-09, production acceptance journey «S25 ولا iPhone 17؟»):
 * «ولا» — the everyday colloquial Saudi "or" in a comparison question — was entirely
 * missing. Only the formal « او » was recognized, so this extremely common phrasing
 * (space-delimited, distinct from the attached-morpheme «ولا» that CAN appear inside a
 * word like «شوكولاتة») fell through to plain retrieval with no comparison framing at
 * all. Kept space-delimited like every other separator here, so it never matches inside
 * a single word with no surrounding spaces. */
const PAIR_SEPARATORS = [' vs. ', ' vs ', ' versus ', ' مقابل ', ' او ', ' ولا ', ' or ', ' and ', ' و '];

export type CompareIntent =
  | { kind: 'none'; reason: string }
  | { kind: 'single'; subject: string; marker: string }
  | { kind: 'pair'; subjects: [string, string]; marker: string };

const strip = (s: string) =>
  s.replace(/[?؟.!،,]+$/g, '')
    .replace(/^(?:ال)?(?:بين|between)\s+/i, '')
    .trim();

/**
 * MEASURED DEFECT (2026-08-10, need-discovery mission): «وش أفضل لابتوب لاحتياجي
 * وميزانيتي؟» matched the "وش افضل" PAIR_MARKER, found no actual second subject, and fell
 * into the single-product fallback below — treating the ENTIRE vague-need phrase "لابتوب
 * لاحتياجي وميزانيتي" as if it were a product NAME to price-compare. That fallback's own
 * purpose (its doc comment's own example: «وش الفرق في آيفون ١٦؟») is a single NAMED
 * PRODUCT — a possessive reference to "my need"/"my budget" with no stated value is the
 * opposite of that: it is a recommendation request, not a product mention. No existing test
 * exercised this fallback with this shape of input, so tightening it here regresses nothing
 * already proven.
 */
const NOT_A_PRODUCT_NAME = /احتياجي|احتياجك|استخدامي|يناسبني|ميزانيتي|my (needs|budget|use ?case)/;

/**
 * Split a phrase into exactly two subjects, or return null.
 *
 * The Arabic conjunction «و» is written ATTACHED to the word it joins («وسامسونج»), so a
 * bare `و` split would slice inside ordinary words and produce nonsense product names —
 * which would then be shown to the customer in the "we cannot compare these" explanation.
 * Only a SPACE-DELIMITED « و » is treated as a separator, and the result is rejected unless
 * both sides look like real subjects.
 */
function splitPair(phrase: string): [string, string] | null {
  for (const sep of PAIR_SEPARATORS) {
    const i = phrase.indexOf(sep);
    if (i <= 0) continue;
    const a = strip(phrase.slice(0, i));
    const b = strip(phrase.slice(i + sep.length));
    // Two characters is not a product. A side that short means we split inside a word or
    // on a stray conjunction, and guessing past that point invents a product name.
    if (a.length >= 3 && b.length >= 3) return [a, b];
  }
  return null;
}

/**
 * What did the shopper ask for?
 *
 * Order matters: a pair marker wins over a single marker, because «قارن بين X و Y» contains
 * «قارن». Reading it as a single-product price comparison would answer a question nobody
 * asked and — worse — would offer a comparison page for only one of the two products.
 */
export function detectCompareIntent(text: string): CompareIntent {
  const raw = (text || '').trim();
  if (!raw) return { kind: 'none', reason: 'empty query' };
  const x = normalizeAr(raw);

  for (const m of PAIR_MARKERS) {
    const i = x.indexOf(m);
    if (i < 0) continue;
    const rest = strip(x.slice(i + m.length));
    const pair = splitPair(rest);
    if (pair) return { kind: 'pair', subjects: pair, marker: m };
    // A pair marker with only one nameable subject — «وش الفرق في آيفون ١٦؟». The shopper
    // is asking about ONE product, so treat it as a single-product comparison rather than
    // inventing a second side.
    if (rest.length >= 3 && !NOT_A_PRODUCT_NAME.test(rest)) return { kind: 'single', subject: rest, marker: m };
    return { kind: 'none', reason: `pair marker "${m}" with no nameable subject` };
  }

  for (const m of SINGLE_MARKERS) {
    const i = x.indexOf(m);
    if (i < 0) continue;
    const rest = strip(x.slice(i + m.length)) || strip(x.slice(0, i));
    // A separator inside a single-marker phrase still means two things:
    // «قارن آيفون ١٦ و جالكسي S24».
    const pair = splitPair(rest);
    if (pair) return { kind: 'pair', subjects: pair, marker: m };
    if (rest.length >= 3 && !NOT_A_PRODUCT_NAME.test(rest)) return { kind: 'single', subject: rest, marker: m };
    return { kind: 'none', reason: `marker "${m}" with no nameable subject` };
  }

  // A bare "X vs Y" carries the intent without any verb. «ولا» belongs in this marker
  // check (not just PAIR_SEPARATORS): it unambiguously means "or" as a standalone word —
  // unlike bare «و» ("and"), which is deliberately EXCLUDED here because most sentences
  // containing it are a single request with two conjoined qualities («لابتوب ألعاب
  // وشاشة كبيرة»), not a comparison of two things.
  const bare = splitPair(x);
  if (bare && /\bvs\b|\bversus\b|مقابل|ولا/.test(x)) return { kind: 'pair', subjects: bare, marker: /ولا/.test(x) ? 'ولا' : 'vs' };

  return { kind: 'none', reason: 'no comparison marker' };
}
