// F7·2 — THE POST-GENERATION VALIDATOR.
//
// Reads the vocabulary F7·1 wrote down and decides whether a GENERATED answer may be published.
// It runs AFTER generation, never before: a prompt instruction is a request, and F7 exists
// because requests are not guarantees. ADR-002 says the same thing from the other side —
// deterministic engines decide, LLMs only phrase — so enforcement belongs after the phrasing.
//
// ── FAILURE BEHAVIOUR, DECIDED DELIBERATELY (ADR-158) ──────────────────────────────────────
//
// On ANY violation the whole generated answer is SUPPRESSED and the caller falls back to the
// deterministic answer it already has. Four alternatives were considered and rejected:
//
//   • remove only the offending content — the one option that can MANUFACTURE a claim while
//     "fixing" one. Deleting a clause can invert a sentence, and the result is text no human
//     wrote and no evidence backs.
//   • replace with approved wording — substitutes an answer to a question the customer did not
//     ask. Silent meaning change. (Falling back to the whole deterministic answer is different:
//     that answer was computed for THIS query.)
//   • regenerate once — non-deterministic, doubles latency and cost, and a model that produced
//     a forbidden claim has no evidence-backed reason to avoid it on retry. The second failure
//     needs this policy anyway.
//   • publish with a warning — a disclosure does not make an unevidenced price claim true.
//
// Suppression costs the PHRASING, not the answer, because the deterministic engine already
// produced one. It is also the established behaviour of this surface: a failed advisory layer is
// silent and the deterministic result stands (CHECKPOINT #25) — an "I could not help" panel
// above good results invents a failure the customer does not have.
//
// ── WHEN THE VALIDATOR ITSELF CANNOT RUN ───────────────────────────────────────────────────
//
// FAIL CLOSED. Unloadable rules, an internal error, or an input beyond the deterministic size
// cap all produce `unavailable`, which suppresses exactly as a rejection does. An unvalidated
// generated claim is what F7 forbids; "the guard was down" is not a defence, and fail-open means
// the guard stops guarding precisely when the system is under stress.
//
// DETERMINISM IS STRUCTURAL. No wall-clock, no randomness, no I/O in the decision path — a
// pathological input is caught by a deterministic CHARACTER CAP, not by a race that could
// resolve differently on a slower machine. Same (text, evidence) in, same verdict out, always.
// Imported from `./check`, NOT from `./index` — the barrel re-exports this module, and that
// cycle would leave the rule set undefined at init. See the note in `index.ts`.
import {
  checkCustomerText,
  findInternalLeaks,
  EVIDENCE_REQUIRED_RULES,
  VOCABULARY_VERSION,
  vocabularyFingerprint,
} from './check';
import { FORBIDDEN_CLAIMS } from './customer-vocabulary';
import type { Violation } from './types';
import {
  isDisplayableRetailer,
  resolveApprovedSlug,
  APPROVED_RETAILERS,
} from '../retailers/approved-retailers';

/**
 * Deterministic input cap. A regex engine on unbounded attacker-influenced text is the one way
 * a pure function acquires a timeout, and a wall-clock guard would make the verdict depend on
 * machine speed. A cap does not.
 */
export const MAX_INPUT_CHARS = 20_000;

/** How a figure in an answer is allowed to have been obtained. */
export type FigureProvenance = 'live-query' | 'static';

export type FigureKind =
  | 'comparable-count'
  | 'catalogue-count'
  | 'retailer-count'
  | 'price'
  | 'other';

/** One number the generated answer is permitted to state, and where it came from. */
export interface EvidenceFigure {
  value: number;
  kind: FigureKind;
  derivedFrom: FigureProvenance;
  label?: string;
}

/**
 * The structured evidence an answer rests on. Supplied by the CALLER, which knows what it
 * fetched — the validator never goes and looks, because a validator that can fetch can also
 * disagree with the generator about which facts were in play.
 */
export interface AnswerEvidence {
  figures: readonly EvidenceFigure[];
  /** Retailer identifiers the answer may name as a source. Slugs, ids or display names. */
  retailers: readonly string[];
}

export type ValidationOutcome = 'passed' | 'rejected' | 'unavailable';

export interface ValidationFinding {
  /** The vocabulary rule id. Always one of the ids F7·1 exports — never invented here. */
  ruleId: string;
  /** A measurable reason: what was found, and what would have made it acceptable. */
  reason: string;
  /** The offending excerpt exactly as it appeared. */
  match: string;
}

export interface ValidationVerdict {
  outcome: ValidationOutcome;
  /** True only when the caller may publish the generated text unchanged. */
  publish: boolean;
  findings: ValidationFinding[];
  /** Set only when `outcome === 'unavailable'`. */
  unavailableReason?: string;
  vocabularyVersion: string;
  fingerprint: string;
}

/** Arabic-Indic and Eastern-Arabic digits → ASCII. */
const AR_DIGITS = /[٠-٩۰-۹]/g;
function normaliseDigits(s: string): string {
  return s.replace(AR_DIGITS, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
}

/**
 * Numbers stated near a subject word.
 *
 * DIGITS ARE NORMALISED FIRST. Every numeric regex in `task-parser.ts` used `\d`, which is
 * ASCII-only, so «٤٠» was dropped silently — the THIRD occurrence of that trap in this codebase
 * (ADR-153). A validator that cannot read «٥٬٠٢٣» would wave through the exact claim it exists
 * to catch, and would do it silently.
 */
function figuresNear(text: string, subjectPatterns: string[]): Array<{ value: number; match: string }> {
  const t = normaliseDigits(text);
  const out: Array<{ value: number; match: string }> = [];
  const num = '(\\d[\\d,\\u066B\\u066C.]*)';
  for (const subject of subjectPatterns) {
    for (const src of [`${num}\\s*(?:${subject})`, `(?:${subject})\\s*${num}`]) {
      for (const m of t.matchAll(new RegExp(src, 'giu'))) {
        const raw = (m[1] || '').replace(/[,٫٬]/g, '');
        const value = Number.parseFloat(raw);
        if (Number.isFinite(value)) out.push({ value, match: m[0].trim() });
      }
    }
  }
  return out;
}

const COMPARABLE_SUBJECTS = [
  'compared', 'comparable', 'products compared',
  'منتجًا مقارنًا', 'منتجا مقارنا', 'منتج مقارن', 'قابل للمقارنة', 'قابلة للمقارنة',
];
const RETAILER_SUBJECTS = [
  'retailers?', 'stores?', 'shops?',
  'متجر', 'متاجر', 'متجرًا', 'متجرا',
];

/** Every alias by which an approved retailer might be named in prose. */
const RETAILER_ALIASES: Array<{ alias: string; slug: string }> = APPROVED_RETAILERS.flatMap((r) => {
  const raw = r as unknown as Record<string, unknown>;
  const names = [raw.slug, raw.displayName, raw.displayNameAr, raw.nameAr, raw.nameEn]
    .filter((v): v is string => typeof v === 'string' && v.length > 2);
  return names.map((alias) => ({ alias, slug: r.slug }));
});

/**
 * Validate a GENERATED answer against the vocabulary and its own evidence.
 *
 * Pure. It NEVER edits, truncates or rewrites `generated` — it returns a verdict and the caller
 * decides what to publish. Keeping the decision outside the validator is what makes
 * "never silently rewrite customer-visible output" a structural property rather than a promise:
 * there is no code path here that can produce modified text.
 */
export function validateGeneratedAnswer(
  generated: string,
  evidence: AnswerEvidence,
): ValidationVerdict {
  const stamp = { vocabularyVersion: VOCABULARY_VERSION, fingerprint: vocabularyFingerprint() };
  const unavailable = (reason: string): ValidationVerdict => ({
    outcome: 'unavailable', publish: false, findings: [], unavailableReason: reason, ...stamp,
  });

  try {
    // ── Can the validator run at all? Each of these is fail-closed. ────────────────────────
    if (typeof generated !== 'string') return unavailable('generated_output_not_a_string');
    if (generated.length > MAX_INPUT_CHARS) return unavailable('input_too_large');
    if (!evidence || !Array.isArray(evidence.figures) || !Array.isArray(evidence.retailers)) {
      return unavailable('evidence_missing_or_malformed');
    }
    // A tree-shaken or mis-bundled rule set would otherwise pass everything, silently.
    if (FORBIDDEN_CLAIMS.length === 0) return unavailable('rule_set_empty');
    if (EVIDENCE_REQUIRED_RULES.length === 0) return unavailable('evidence_rules_unavailable');

    const findings: ValidationFinding[] = [];

    // ── 1. Pattern rules (F7·1). Same checker the bundles and surfaces are scanned with. ──
    const asFinding = (v: Violation, reason: string): ValidationFinding =>
      ({ ruleId: v.ruleId, reason, match: v.match });
    for (const v of checkCustomerText(generated)) {
      findings.push(asFinding(v, `forbidden claim class "${v.ruleId}" (${v.source.section}) appears in generated text`));
    }
    for (const v of findInternalLeaks(generated)) {
      findings.push(asFinding(v, `internal token leaked into customer-visible text`));
    }

    // ── 2. EVIDENCE-REQUIRED rules — the part F7·1 declared no text scan can decide. ──────
    // The ids are read FROM F7·1, never restated, so a rule added there fails the coverage
    // test until it is handled here.
    const handled = new Set<string>();

    // catalogue-presented-as-comparable — a number offered as "comparable" must BE one.
    handled.add('catalogue-presented-as-comparable');
    for (const f of figuresNear(generated, COMPARABLE_SUBJECTS)) {
      const asComparable = evidence.figures.find((e) => e.kind === 'comparable-count' && e.value === f.value);
      if (asComparable) continue;
      const asCatalogue = evidence.figures.find((e) => e.kind === 'catalogue-count' && e.value === f.value);
      findings.push({
        ruleId: 'catalogue-presented-as-comparable',
        match: f.match,
        reason: asCatalogue
          ? `stated ${f.value} as a comparable count, but the evidence records ${f.value} as a CATALOGUE count` +
            `${evidence.figures.find((e) => e.kind === 'comparable-count') ? ` (comparable is ${evidence.figures.find((e) => e.kind === 'comparable-count')!.value})` : ''}`
          : `stated ${f.value} as a comparable count; no comparable-count figure of that value is in the supplied evidence`,
      });
    }

    // fixed-retailer-count — any retailer count must be present AND derived from a live query.
    handled.add('fixed-retailer-count');
    for (const f of figuresNear(generated, RETAILER_SUBJECTS)) {
      const match = evidence.figures.find((e) => e.kind === 'retailer-count' && e.value === f.value);
      if (match && match.derivedFrom === 'live-query') continue;
      findings.push({
        ruleId: 'fixed-retailer-count',
        match: f.match,
        reason: match
          ? `stated a retailer count of ${f.value}, but the evidence marks it derivedFrom="${match.derivedFrom}"; §9 requires a live query`
          : `stated a retailer count of ${f.value} with no retailer-count figure of that value in the supplied evidence`,
      });
    }

    // excluded-retailer-as-comparison-source — display authority is the existing code gate.
    handled.add('excluded-retailer-as-comparison-source');
    const suppliedSlugs = new Set(
      evidence.retailers.map((r) => resolveApprovedSlug(r)).filter((s): s is string => !!s),
    );
    const seen = new Set<string>();
    for (const { alias, slug } of RETAILER_ALIASES) {
      if (!generated.includes(alias) || seen.has(slug)) continue;
      seen.add(slug);
      if (!isDisplayableRetailer(slug)) {
        findings.push({
          ruleId: 'excluded-retailer-as-comparison-source',
          match: alias,
          reason: `named "${alias}" (${slug}), which isDisplayableRetailer() excludes from being shown as a comparison source`,
        });
      } else if (!suppliedSlugs.has(slug)) {
        findings.push({
          ruleId: 'excluded-retailer-as-comparison-source',
          match: alias,
          reason: `named "${alias}" (${slug}), which was not among the retailers supplied as evidence — a retailer we did not supply is a fabricated source`,
        });
      }
    }

    // Coverage is asserted, not assumed: an evidence-required rule added in F7·1 and not
    // handled here must fail loudly rather than be silently unchecked.
    const unhandled = EVIDENCE_REQUIRED_RULES.filter((r) => !handled.has(r.id)).map((r) => r.id);
    if (unhandled.length > 0) return unavailable(`unhandled_evidence_rules:${unhandled.join(',')}`);

    return {
      outcome: findings.length === 0 ? 'passed' : 'rejected',
      publish: findings.length === 0,
      findings,
      ...stamp,
    };
  } catch (err) {
    // Fail closed on anything unforeseen. A validator that throws must never become a validator
    // that is skipped.
    return unavailable(`internal_error:${err instanceof Error ? err.name : 'unknown'}`);
  }
}

/** Rule ids this validator claims to enforce against evidence. Asserted against F7·1 in tests. */
export const EVIDENCE_RULES_HANDLED: readonly string[] = [
  'catalogue-presented-as-comparable',
  'fixed-retailer-count',
  'excluded-retailer-as-comparison-source',
];
