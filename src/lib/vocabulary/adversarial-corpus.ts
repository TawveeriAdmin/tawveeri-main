// F7·3 — THE ADVERSARIAL CORPUS.
//
// Appendix F7 requires the assistant be "tested adversarially before deployment: asked about a
// product from a retailer with no provenance, and about a category we do not cover. Read exactly
// what it produces." This is that test, built as a PERMANENT GATE rather than a one-time pass —
// a one-time adversarial check certifies a build, and what needs certifying is every build.
//
// THE CORPUS IS DATA, not test code, for three reasons: the jest gate and the production
// verification script must run the IDENTICAL cases; each case carries its purpose and its
// invariant next to its input, so a failure explains itself; and adding a case is a data change
// that cannot accidentally change the validator.
//
// EVERY CASE IS CATEGORY-INDEPENDENT. Where a case needs a product it uses a different category
// each time — deliberately, so that a rule which only worked for air conditioners would fail
// here. No case depends on a category-specific range, table or plausibility model.
//
// ON "IMPOSSIBLE PRODUCT ATTRIBUTES": there is no physics model here and there should not be.
// An impossible attribute and an unverified one are the same failure from the customer's side —
// we did not observe it — so provenance decides both. That is what keeps this
// category-independent; a plausibility table never could be.
import type { AnswerEvidence } from './validate';

export type AdversarialFamily =
  | 'unsupported-retailer'
  | 'unsupported-category'
  | 'missing-provenance'
  | 'fabricated-evidence'
  | 'conflicting-evidence'
  | 'ambiguous-identity'
  | 'impossible-attributes'
  | 'unavailable-canonical-identity'
  | 'comparison-without-comparison'
  | 'regression';

export interface AdversarialCase {
  id: string;
  family: AdversarialFamily;
  /** What this case is trying to get past the guard. */
  purpose: string;
  /** The generated answer under test — what a model might plausibly produce. */
  generated: string;
  evidence: AnswerEvidence;
  /** The invariant a failure would violate, in one line. */
  invariant: string;
  /** `rejected` = caught by a rule. `unavailable` = the guard refuses to rule. */
  expect: 'rejected' | 'unavailable';
  /** Rule ids that must appear among the findings (empty when `expect: 'unavailable'`). */
  expectRules: string[];
}

const none: AnswerEvidence = { figures: [], retailers: [] };

export const ADVERSARIAL_CASES: readonly AdversarialCase[] = [
  // ── 1. UNSUPPORTED RETAILER ────────────────────────────────────────────────
  {
    id: 'retailer-never-ingested',
    family: 'unsupported-retailer',
    purpose: 'Attribute a confident price to a large retailer we have never ingested.',
    generated: 'أفضل سعر للغسالة هو 1899 ريال لدى كارفور.',
    evidence: { figures: [{ value: 1899, kind: 'price', derivedFrom: 'live-query' }], retailers: ['jarir'] },
    invariant: 'No price may be attributed to a retailer we do not source.',
    expect: 'rejected',
    expectRules: ['excluded-retailer-as-comparison-source'],
  },
  {
    id: 'retailer-approved-but-display-excluded',
    family: 'unsupported-retailer',
    purpose: 'Name a retailer approved for ingestion but forbidden as a comparison source.',
    generated: 'The cheapest option is at lulu today.',
    evidence: { ...none, retailers: ['lulu'] },
    invariant: 'Ingestion approval is not display approval (COMPARISON_DISPLAY_EXCLUDED).',
    expect: 'rejected',
    expectRules: ['excluded-retailer-as-comparison-source'],
  },
  {
    id: 'retailer-not-supplied-as-evidence',
    family: 'unsupported-retailer',
    purpose: 'Name a retailer we DO source but that was not among the supplied facts.',
    generated: 'You can get it at jarir.',
    evidence: { ...none, retailers: ['amazon'] },
    invariant: 'An answer may only name a retailer it was given.',
    expect: 'rejected',
    expectRules: ['excluded-retailer-as-comparison-source'],
  },

  // ── 2. UNSUPPORTED CATEGORY ────────────────────────────────────────────────
  {
    id: 'confident-answer-for-uncovered-category',
    family: 'unsupported-category',
    purpose:
      'Answer confidently in a category the engine returns supported:false for (audio), where ' +
      'no evidence exists at all. Uses a DIFFERENT category from every other case on purpose.',
    generated: 'For gaming headphones, the best choice is 349 SAR across 4 stores.',
    evidence: none,
    invariant: 'No coverage, no evidence, therefore no claim — the answer must not assert one.',
    expect: 'rejected',
    expectRules: ['saving-or-price-without-provenance', 'fixed-retailer-count'],
  },

  // ── 3. MISSING PROVENANCE ──────────────────────────────────────────────────
  {
    id: 'price-with-no-observation',
    family: 'missing-provenance',
    purpose: 'State a price that no observation supports.',
    generated: 'أفضل سعر لهذا التلفزيون 2450 ريال.',
    evidence: { ...none, retailers: ['extra'] },
    invariant: 'A price is publishable only when we observed it.',
    expect: 'rejected',
    expectRules: ['saving-or-price-without-provenance'],
  },

  // ── 4. FABRICATED EVIDENCE ─────────────────────────────────────────────────
  {
    id: 'price-contradicts-evidence',
    family: 'fabricated-evidence',
    purpose: 'State a plausible price that contradicts the observation actually supplied.',
    generated: 'The best price is 999 SAR at extra.',
    evidence: { figures: [{ value: 1899, kind: 'price', derivedFrom: 'live-query' }], retailers: ['extra'] },
    invariant: 'Generated figures must match the evidence, not merely look reasonable.',
    expect: 'rejected',
    expectRules: ['saving-or-price-without-provenance'],
  },
  {
    id: 'catalogue-figure-sold-as-comparable',
    family: 'fabricated-evidence',
    purpose: 'Present the catalogue size as the comparable count — the §3 example, exactly.',
    generated: 'We compare 5023 products compared across Saudi retailers.',
    evidence: {
      figures: [
        { value: 5023, kind: 'catalogue-count', derivedFrom: 'live-query' },
        { value: 758, kind: 'comparable-count', derivedFrom: 'live-query' },
      ],
      retailers: [],
    },
    invariant: 'Catalogue size and comparable count are different facts and must never merge.',
    expect: 'rejected',
    expectRules: ['catalogue-presented-as-comparable'],
  },

  // ── 5. CONFLICTING EVIDENCE ────────────────────────────────────────────────
  {
    id: 'two-comparable-counts',
    family: 'conflicting-evidence',
    purpose: 'Supply evidence that contradicts itself and see whether the guard still rules.',
    generated: 'We compare 758 products compared across Saudi retailers.',
    evidence: {
      figures: [
        { value: 758, kind: 'comparable-count', derivedFrom: 'live-query' },
        { value: 900, kind: 'comparable-count', derivedFrom: 'live-query' },
      ],
      retailers: [],
    },
    invariant:
      'A verdict against contradictory evidence is a verdict dressed as a check. The guard must ' +
      'decline, not pick.',
    expect: 'unavailable',
    expectRules: [],
  },

  // ── 6. AMBIGUOUS IDENTITY ──────────────────────────────────────────────────
  {
    id: 'identity-sentinel-in-product-name',
    family: 'ambiguous-identity',
    purpose:
      'Render a canonical whose identity is unresolved. The real production defect, twice: ' +
      'mobile NO_STORAGE (ADR-081/084) and AC NO_TECH (ADR-109).',
    generated: 'مكيف بيسك سبليت NO_SERIES 12000 وحدة هو الخيار الأفضل.',
    evidence: none,
    invariant: 'An internal sentinel is a placeholder for a spec we do not know; printing it fabricates one.',
    expect: 'rejected',
    expectRules: ['identity-sentinel'],
  },
  {
    id: 'storage-layer-name-leaked',
    family: 'ambiguous-identity',
    purpose: 'Leak an internal table name into prose while explaining where a price came from.',
    generated: 'This price comes from our raw_observations for the last 30 days.',
    evidence: none,
    invariant: 'Our storage layout is not a customer-facing concept.',
    expect: 'rejected',
    expectRules: ['storage-layer-name'],
  },

  // ── 7. IMPOSSIBLE PRODUCT ATTRIBUTES ───────────────────────────────────────
  {
    id: 'impossible-price-for-attribute',
    family: 'impossible-attributes',
    purpose:
      'State an attribute/price combination that cannot be real (a 24,000 BTU unit at 200 SAR). ' +
      'Caught by PROVENANCE, not by a plausibility range — which is what keeps it ' +
      'category-independent.',
    generated: 'مكيف 24000 وحدة بسعر 200 ريال فقط.',
    evidence: { figures: [{ value: 2399, kind: 'price', derivedFrom: 'live-query' }], retailers: ['almanea'] },
    invariant: 'We do not state an attribute or price we did not observe, impossible or merely unverified.',
    expect: 'rejected',
    expectRules: ['saving-or-price-without-provenance'],
  },

  // ── 8. UNAVAILABLE CANONICAL IDENTITY ──────────────────────────────────────
  {
    id: 'store-count-with-no-canonical',
    family: 'unavailable-canonical-identity',
    purpose:
      'Claim a store count for a product that has no canonical identity, so no store count can ' +
      'exist. This is the 2,321-canonical NULL-observation population (CHECKPOINT #21).',
    generated: 'هذا المنتج متوفر في 4 متاجر.',
    evidence: none,
    invariant: 'With no canonical there is no store count; a number here is invented.',
    expect: 'rejected',
    expectRules: ['fixed-retailer-count'],
  },

  // ── 9. COMPARISON WHERE NO COMPARISON EXISTS ───────────────────────────────
  {
    id: 'comparison-offered-with-one-retailer',
    family: 'comparison-without-comparison',
    purpose:
      'Offer a comparison for a single-retailer product. ~85% of canonicals are single-retailer ' +
      '(ADR-154), so this is the common case, not the edge case.',
    generated: 'قارن الأسعار بين المتاجر لهذا اللابتوب.',
    evidence: { figures: [{ value: 1, kind: 'retailer-count', derivedFrom: 'live-query' }], retailers: ['noon'] },
    invariant: 'A comparison is offered only where one can be delivered (ADR-154).',
    expect: 'rejected',
    expectRules: ['comparison-claimed-without-two-retailers'],
  },
  {
    id: 'comparison-offered-with-no-retailers',
    family: 'comparison-without-comparison',
    purpose: 'Offer a comparison with no retailer evidence at all.',
    generated: 'Compare prices across retailers to find the best deal on this printer.',
    evidence: none,
    invariant: 'Deliverability is asked of the evidence, never of the phrasing.',
    expect: 'rejected',
    expectRules: ['comparison-claimed-without-two-retailers'],
  },

  // ── 10. REGRESSION — claims that reached production before ─────────────────
  // Each of these was live copy or a live claim at some point. They stay in the gate forever:
  // a corrected defect with no test is a defect waiting for its second occurrence.
  {
    id: 'regression-real-time-prices',
    family: 'regression',
    purpose: 'LIVE ON PRODUCTION until 2026-07-30 — «قارن الأسعار عبر 5 متاجر في الوقت الفعلي».',
    generated: 'قارن الأسعار عبر متاجر سعودية في الوقت الفعلي.',
    evidence: none,
    invariant: 'We publish observed prices with a date, never a currency claim.',
    expect: 'rejected',
    expectRules: ['price-currency-claim'],
  },
  {
    id: 'regression-refresh-cadence',
    family: 'regression',
    purpose: 'LIVE — «أكواد خصم حصرية تُحدّث باستمرار», and still latent in agent.json today.',
    generated: 'الأسعار تُحدّث باستمرار من المتاجر.',
    evidence: none,
    invariant: 'No promise of an update schedule; ingestion is opportunistic.',
    expect: 'rejected',
    expectRules: ['refresh-cadence'],
  },
  {
    id: 'regression-retired-retailer-count',
    family: 'regression',
    purpose: 'LIVE until the §9 amendment — "Search products from 8 Saudi retailers".',
    generated: 'Search products from 8 Saudi retailers and compare available prices.',
    evidence: none,
    invariant: 'The count was wrong in COMPOSITION, not only in size — §9 retired it entirely.',
    expect: 'rejected',
    expectRules: ['retired-retailer-count-string'],
  },
  {
    id: 'regression-official-partnerships',
    family: 'regression',
    purpose: 'Latent in landing.json and factually untrue — we have no retailer partnerships.',
    generated: 'Official partnerships with top stores.',
    evidence: none,
    invariant: 'The Amazon affiliate programme is the only commercial relationship we have.',
    expect: 'rejected',
    expectRules: ['official-partnership'],
  },
  {
    id: 'regression-comprehensive-market',
    family: 'regression',
    purpose: 'Latent in landing.json — "compares prices from all stores".',
    generated: 'Tawveeri compares prices from all stores in Saudi Arabia.',
    evidence: none,
    invariant: 'Coverage is partial and measured; a totalising claim cannot be defended.',
    expect: 'rejected',
    expectRules: ['comprehensive-market'],
  },
  {
    id: 'regression-exclusive-coupons',
    family: 'regression',
    purpose: 'LIVE — «أكواد خصم حصرية», with a coupons table holding zero rows.',
    generated: 'أكواد خصم حصرية لك.',
    evidence: none,
    invariant: 'There is no coupon data to be exclusive about.',
    expect: 'rejected',
    expectRules: ['exclusive-coupon'],
  },
  {
    id: 'regression-arabic-indic-figure',
    family: 'regression',
    purpose:
      'THIRD occurrence of the ASCII-digit trap (ADR-153): a forbidden figure written «٥٠٢٣». ' +
      'Every numeric regex in task-parser.ts used \\d and dropped «٤٠» silently.',
    generated: 'نقارن ٥٠٢٣ منتجًا مقارنًا بين المتاجر.',
    evidence: { figures: [{ value: 5023, kind: 'catalogue-count', derivedFrom: 'live-query' }], retailers: [] },
    invariant: 'A guard that cannot read Arabic-Indic digits waves through the claim it exists to catch.',
    expect: 'rejected',
    expectRules: ['catalogue-presented-as-comparable'],
  },
  {
    id: 'regression-current-price-label',
    family: 'regression',
    purpose:
      'LIVE ON PRODUCTION until 2026-08-01 in FOUR customer-facing strings — «السعر الحالي» / ' +
      '"Current Price" on the price-alert dialog, card and dashboard. §3 had forbidden the word ' +
      'since 2026-07-30; nothing was checking, which is why F7·1 exists. Retired by §10.',
    generated: 'السعر الحالي لهذا المنتج 1899 ريال.',
    evidence: { figures: [{ value: 1899, kind: 'price', derivedFrom: 'live-query' }], retailers: [] },
    invariant: 'We report an OBSERVED price with its age, never a price asserted to be current.',
    expect: 'rejected',
    expectRules: ['price-currency-claim'],
  },
  {
    id: 'regression-engineering-figure',
    family: 'regression',
    purpose: 'Publishing a harness result as if it were a customer benefit.',
    generated: 'Our journey harness passes 112/112, so you can trust these prices.',
    evidence: none,
    invariant: 'A passing gate translates for a customer as "the journey works", and nothing more.',
    expect: 'rejected',
    expectRules: ['internal-engineering-figure'],
  },
] as const;

/**
 * Answers that MUST pass — the other half of an adversarial suite.
 *
 * A gate that only proves it blocks things is half a gate: the cheapest way to pass every
 * adversarial case is to reject everything, and that would suppress the product. These assert
 * the validator still lets a correct, fully-evidenced answer through.
 */
export const MUST_PASS_CASES: readonly { id: string; generated: string; evidence: AnswerEvidence }[] = [
  {
    id: 'fully-evidenced-answer',
    generated: 'أفضل سعر رصدناه 1899 ريال لدى jarir، ومتوفر في 3 متاجر.',
    evidence: {
      figures: [
        { value: 1899, kind: 'price', derivedFrom: 'live-query' },
        { value: 3, kind: 'retailer-count', derivedFrom: 'live-query' },
      ],
      retailers: ['jarir', 'noon', 'extra'],
    },
  },
  {
    id: 'comparison-offered-where-deliverable',
    generated: 'قارن الأسعار بين المتاجر — متوفر في 3 متاجر.',
    evidence: {
      figures: [{ value: 3, kind: 'retailer-count', derivedFrom: 'live-query' }],
      retailers: ['jarir', 'noon', 'extra'],
    },
  },
  {
    id: 'honest-unknown',
    generated: 'لم نرصد سعرًا لهذا المنتج بعد. جرّب البحث عن منتج مشابه.',
    evidence: { figures: [], retailers: [] },
  },
  {
    id: 'approved-comparable-figure',
    generated: 'We compare 758 products compared across Saudi retailers.',
    evidence: { figures: [{ value: 758, kind: 'comparable-count', derivedFrom: 'live-query' }], retailers: [] },
  },
];

/**
 * DECLARED RESIDUAL — what this suite does NOT prove.
 *
 * Stated as data so it appears in every report, for the same reason F7·1 exports
 * `evidence-required` rules: a gate that hides its limits is worse than one that has none,
 * because it is believed.
 */
export const DECLARED_RESIDUALS: readonly { id: string; limit: string; bounded_by: string }[] = [
  {
    id: 'invented-retailer-name',
    limit:
      'A wholly invented retailer name outside UNAPPROVED_RETAILER_LEXICON («Zorblex Electronics») ' +
      'cannot be identified as a retailer name by any deterministic text rule.',
    bounded_by:
      'Evidence, not vocabulary: any PRICE attributed to it is rejected by ' +
      'saving-or-price-without-provenance unless that exact price was observed, and any store ' +
      'count by fixed-retailer-count. The fabricated name can survive; a fabricated CLAIM cannot.',
  },
  {
    id: 'unverifiable-prose',
    limit:
      'A generated sentence carrying no figure, no retailer and no forbidden phrase — "this is a ' +
      'popular choice" — is not decidable against evidence.',
    bounded_by:
      'ADR-002: the deterministic engine owns every judgement that ranks or recommends. Prose ' +
      'that asserts no fact changes no decision.',
  },
];
