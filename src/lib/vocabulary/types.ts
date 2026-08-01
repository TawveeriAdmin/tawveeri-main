// F7·1 — THE APPROVED VOCABULARY AS DATA. Types only.
//
// Constitution Appendix F7 governs the generative surface: "No repository search catches what
// the assistant says in a live answer." A runtime guard is the answer — but a guard cannot read
// prose, and the approved vocabulary lives as prose in `docs/LAUNCH_VOCABULARY.md`. A guard
// built against prose would be CONFIDENTLY wrong: it would certify a vocabulary nobody approved.
// So the vocabulary becomes data first, and the guard (F7·2) is built against the data.
//
// GOVERNANCE DIRECTION IS ONE-WAY. The document is the authority; this module is DERIVED.
// Appendix F1 requires the vocabulary be amended in the document, with evidence, before any
// claim changes. Drift is prevented mechanically rather than by discipline: every rule carries a
// verbatim `source.quote`, and a test asserts that quote still exists in the document. Edit
// either side alone and the test fails.

export type VocabLocale = 'ar' | 'en';

/** Where a rule comes from in `docs/LAUNCH_VOCABULARY.md` (or the Constitution's Appendix F7). */
export interface DocSource {
  /** Section heading, e.g. `§3`. Human navigation only. */
  section: string;
  /**
   * A VERBATIM substring of the governing document. This is the anti-drift anchor, not a label:
   * `tests/vocabulary` asserts the document still contains it. Choose a phrase that carries the
   * rule's meaning, so a substantive edit breaks the test and a typo fix does not.
   */
  quote: string;
}

/**
 * How a rule can be enforced.
 *
 * `pattern` — decidable from the text alone.
 *
 * `evidence-required` — NOT decidable from text, and saying so is the point. Example: the
 * document forbids «5,023 products compared» while approving «we compare 758 products». Those
 * two sentences are the same shape; only the evidence behind the number separates them. A
 * pattern that tried would either miss the violation or flag the approved statement, and both
 * failures are silent. Such rules carry no patterns, are skipped by the text checker, and are
 * exported so that F7·2 MUST handle them against structured evidence rather than inherit a
 * false sense of coverage.
 */
export type Enforcement = 'pattern' | 'evidence-required';

/** A class of claim a customer must never read. Category-agnostic by construction. */
export interface ForbiddenClaim {
  /** Stable id. Referenced by F7·2 verdicts and by any future amendment. Never reused. */
  id: string;
  title: string;
  /** Why it is forbidden — the reasoning, not a restatement of the rule. */
  why: string;
  enforcement: Enforcement;
  /**
   * Regex sources per locale, applied with `giu`. EMPTY for `evidence-required` rules.
   *
   * ARABIC PATTERNS MUST NOT USE `\b`. JavaScript word boundaries are defined on `[A-Za-z0-9_]`,
   * so `\b` never matches beside an Arabic letter — a trap this codebase has hit three times
   * (ADR-153). Use `(?:^|[^\p{L}])` / `(?:[^\p{L}]|$)` instead.
   */
  patterns: Record<VocabLocale, string[]>;
  /**
   * Documented TRUE uses that must never be flagged. Prefer making a pattern precise over
   * adding an exclusion — precision by construction cannot be forgotten. Present only where the
   * document itself records a near-identical true statement.
   */
  allowedContext?: Record<VocabLocale, string[]>;
  /** For `evidence-required` rules: the code that actually enforces it, if any. */
  codeAuthority?: string;
  source: DocSource;
  /** ADR or dated decision that introduced or last amended this rule. */
  since: string;
}

/** A statement we may make. Exact wording — the document says "do not paraphrase". */
export interface ApprovedStatement {
  id: string;
  text: Record<VocabLocale, string>;
  /** True when the wording is load-bearing and must be reproduced exactly, not adapted. */
  verbatim: boolean;
  source: DocSource;
}

/** «رصدنا» not «نحدّث» — the past-tense, evidence-anchored substitution table (§4). */
export interface ReplacementPair {
  id: string;
  use: Record<VocabLocale, string>;
  insteadOf: Record<VocabLocale, string>;
  source: DocSource;
}

/** An internal token that exists only inside the system and must never reach a customer. */
export interface InternalToken {
  id: string;
  title: string;
  why: string;
  /** Literal tokens, matched as whole tokens by the checker. */
  tokens: readonly string[];
  source: DocSource;
  since: string;
}

/** One detected violation. Carries its citation so a verdict is auditable, never just a boolean. */
export interface Violation {
  ruleId: string;
  title: string;
  locale: VocabLocale;
  /** The offending excerpt, as it appeared. */
  match: string;
  /** Character offset in the checked text. */
  index: number;
  source: DocSource;
}
