// THE VOCABULARY — one door.
//
// A barrel only. Every implementation lives in a sibling module so that `validate.ts` (F7·2) can
// import the checkers WITHOUT importing the barrel that re-exports it. That cycle would not
// throw; it would leave `FORBIDDEN_CLAIMS` undefined during module init, and the validator fails
// CLOSED on an empty rule set — so the symptom would be every generated answer silently
// suppressed in production, with no error anywhere. Structure, not luck.
//
//   types.ts                    the shapes
//   customer-vocabulary.ts      F7·1 — what a customer may / must never read
//   internal-vocabulary.ts      F7·1 — tokens that must never escape the system
//   pending-copy-decisions.ts   F7·1 — live copy awaiting an F1 wording decision
//   check.ts                    F7·1 — the text checkers
//   validate.ts                 F7·2 — the post-generation validator
//   validation-log.ts           F7·2 — the event record

export * from './types';

// ── F7·1 · the vocabulary itself ──────────────────────────────────────────────
export {
  FORBIDDEN_CLAIMS,
  APPROVED_STATEMENTS,
  REPLACEMENT_PAIRS,
  UNAPPROVED_RETAILER_LEXICON,
} from './customer-vocabulary';
export { INTERNAL_TOKENS, ALL_INTERNAL_TOKENS } from './internal-vocabulary';
export { PENDING_COPY_DECISIONS, PENDING_KEYS } from './pending-copy-decisions';
export type { PendingCopyDecision } from './pending-copy-decisions';

// ── F7·1 · the checkers ───────────────────────────────────────────────────────
export {
  VOCABULARY_VERSION,
  GOVERNING_DOCUMENTS,
  vocabularyFingerprint,
  PATTERN_RULES,
  EVIDENCE_REQUIRED_RULES,
  checkCustomerText,
  findInternalLeaks,
  checkCustomerSurface,
  ALL_CUSTOMER_RULE_IDS,
  ALL_INTERNAL_RULE_IDS,
  INTERNAL_TOKEN_LIST,
} from './check';

/**
 * Bundles that are NOT customer surfaces. The customer vocabulary asks "may a customer read
 * this claim"; a merchant editing their own price in the store portal legitimately sees
 * "Current Price", and an operator console is not customer copy. Scoping this here — as data,
 * next to the vocabulary — rather than as a quiet condition inside a scanner.
 */
export const OPERATOR_BUNDLES: ReadonlySet<string> = new Set(['store.json', 'admin.json']);

// ── F7·2 · the post-generation validator and its log ──────────────────────────
export { validateGeneratedAnswer, EVIDENCE_RULES_HANDLED, MAX_INPUT_CHARS } from './validate';
export type {
  AnswerEvidence,
  EvidenceFigure,
  FigureKind,
  FigureProvenance,
  ValidationFinding,
  ValidationOutcome,
  ValidationVerdict,
} from './validate';
export {
  recordValidationEvent,
  setValidationSink,
  resetValidationSink,
  MAX_LOGGED_CHARS,
} from './validation-log';
export type { ValidationEvent, ValidationSink } from './validation-log';
export { writeDurableValidationEvent, closeDurableSink } from './durable-sink';

// ── F7·3 · the adversarial corpus, as data shared by the gate and the production script ──
export { ADVERSARIAL_CASES, MUST_PASS_CASES, DECLARED_RESIDUALS } from './adversarial-corpus';
export type { AdversarialCase, AdversarialFamily } from './adversarial-corpus';
