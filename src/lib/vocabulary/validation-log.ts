// F7·2 — THE VALIDATION LOG.
//
// EVERY validation event is recorded, not only the rejections. A log that records failures alone
// cannot answer the question that actually matters after an incident — "was the guard running?"
// — because silence is then indistinguishable between "nothing was generated", "everything
// passed" and "the validator never executed". So the three outcomes are recorded as three
// distinct, queryable states:
//
//   passed       — validator ran, generated text published
//   rejected     — validator ran, generated text suppressed, findings attached
//   unavailable  — validator could NOT run; text suppressed exactly as a rejection
//
// `unavailable` is deliberately NOT folded into `rejected`. They have the same customer-visible
// effect and completely different meanings: one says the vocabulary caught something, the other
// says the guard is broken. Merging them would let a broken guard hide inside a healthy-looking
// rejection rate.
//
// SINK. The default writes one JSON line to stdout, which is captured by the platform's log
// collector and needs no schema change. Persisting to the database would be a production write
// and a migration — a founder decision, not an engineering one — so the sink is INJECTABLE and
// that decision stays open rather than being made silently here.
//
// PRIVACY. The customer's query and the generated answer are both recorded, because a rejection
// that does not say what was rejected cannot be investigated or reproduced. Anything routed to
// durable storage later must be reviewed for retention on that basis.
import type { ValidationVerdict } from './validate';

/** Generated answers can be long; the record stays bounded and SAYS when it truncated. */
export const MAX_LOGGED_CHARS = 4_000;

export interface ValidationEvent {
  /** ISO-8601. Supplied by the caller so the record is reproducible in tests. */
  timestamp: string;
  outcome: ValidationVerdict['outcome'];
  /** The customer's query, verbatim. */
  query: string;
  /** The generated output as produced — never the published output, which may differ. */
  generated: string;
  generatedTruncated: boolean;
  /** Rule ids violated. Empty for `passed` and for `unavailable`. */
  violatedRules: string[];
  findings: ValidationVerdict['findings'];
  /** Set only for `unavailable`. */
  unavailableReason?: string;
  /** What the caller actually did — the decision, recorded next to its cause. */
  decision: 'published-generated' | 'suppressed-fell-back-to-deterministic';
  vocabularyVersion: string;
  fingerprint: string;
  surface: string;
}

export type ValidationSink = (event: ValidationEvent) => void;

const defaultSink: ValidationSink = (event) => {
  // A single line, machine-parseable, with a stable prefix so it can be grepped out of a mixed
  // log stream without a parser.
  console.log(`[f7-validation] ${JSON.stringify(event)}`);
};

let sink: ValidationSink = defaultSink;

/** Swap the sink (tests, or a durable store once that is decided). Returns the previous one. */
export function setValidationSink(next: ValidationSink): ValidationSink {
  const previous = sink;
  sink = next;
  return previous;
}

export function resetValidationSink(): void {
  sink = defaultSink;
}

/**
 * Record one validation event.
 *
 * NEVER THROWS. A logging failure must not take down an answer, and it must not be able to turn
 * a rejection into a publication by throwing before the caller acts on the verdict.
 */
export function recordValidationEvent(input: {
  verdict: ValidationVerdict;
  query: string;
  generated: string;
  surface: string;
  timestamp: string;
}): ValidationEvent {
  const truncated = input.generated.length > MAX_LOGGED_CHARS;
  const event: ValidationEvent = {
    timestamp: input.timestamp,
    outcome: input.verdict.outcome,
    query: input.query,
    generated: truncated ? input.generated.slice(0, MAX_LOGGED_CHARS) : input.generated,
    generatedTruncated: truncated,
    violatedRules: [...new Set(input.verdict.findings.map((f) => f.ruleId))],
    findings: input.verdict.findings,
    ...(input.verdict.unavailableReason ? { unavailableReason: input.verdict.unavailableReason } : {}),
    decision: input.verdict.publish ? 'published-generated' : 'suppressed-fell-back-to-deterministic',
    vocabularyVersion: input.verdict.vocabularyVersion,
    fingerprint: input.verdict.fingerprint,
    surface: input.surface,
  };
  try {
    sink(event);
  } catch {
    /* a broken sink must not break an answer */
  }
  return event;
}
