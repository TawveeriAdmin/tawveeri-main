// F7·1 — THE VOCABULARY CHECKERS. Implementation; `index.ts` is the barrel.
//
// Split out of the barrel when F7·2 landed: `validate.ts` needs these, and importing them
// from a barrel that also re-exports `validate.ts` is a module cycle. A cycle here would not
// throw — it would leave `FORBIDDEN_CLAIMS` momentarily undefined at init, and the validator
// fails CLOSED on an empty rule set, so the symptom would be every generated answer silently
// suppressed. Structure, not luck.
//
// PURE AND DEPENDENCY-FREE. No I/O, no crypto import, no env. Safe from a route, a script, a
// test, and from inside a generation loop.
import type { ForbiddenClaim, InternalToken, Violation, VocabLocale } from './types';
import { FORBIDDEN_CLAIMS, APPROVED_STATEMENTS, REPLACEMENT_PAIRS } from './customer-vocabulary';
import { INTERNAL_TOKENS, ALL_INTERNAL_TOKENS } from './internal-vocabulary';
/**
 * VERSION. Bumped by hand, in the same change that amends the vocabulary — and the fingerprint
 * below makes that not-optional: a test pins the fingerprint, so any edit to the rule set fails
 * until the version is bumped deliberately. A vocabulary that can change without anyone
 * declaring it changed is the exact failure F7 exists to prevent.
 *
 * Format: `<doc-date>+<n>` — the LAUNCH_VOCABULARY revision this was derived from, plus the
 * derivation revision.
 */
export const VOCABULARY_VERSION = '2026-08-01+1';

/** Governing documents, highest first. The module is derived from these; never the reverse. */
export const GOVERNING_DOCUMENTS = [
  'docs/CONSUMER_EXPERIENCE_CONSTITUTION.md',
  'docs/LAUNCH_VOCABULARY.md',
  'CLAUDE.md',
] as const;

/**
 * Deterministic fingerprint of the whole vocabulary (FNV-1a, 32-bit, hex).
 *
 * Not a security hash — a CHANGE DETECTOR. F7·2 will stamp verdicts with it so that an answer
 * approved under one vocabulary can never be assumed approved under the next.
 */
export function vocabularyFingerprint(): string {
  const canonical = JSON.stringify({
    v: VOCABULARY_VERSION,
    forbidden: FORBIDDEN_CLAIMS.map((r) => [r.id, r.enforcement, r.patterns.ar, r.patterns.en, r.source.quote]),
    approved: APPROVED_STATEMENTS.map((s) => [s.id, s.text.ar, s.text.en, s.verbatim]),
    replacements: REPLACEMENT_PAIRS.map((p) => [p.id, p.use.ar, p.use.en]),
    internal: INTERNAL_TOKENS.map((t) => [t.id, t.tokens]),
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Rules a text checker can decide. */
export const PATTERN_RULES: readonly ForbiddenClaim[] =
  FORBIDDEN_CLAIMS.filter((r) => r.enforcement === 'pattern');

/**
 * Rules NO text checker can decide — exported so F7·2 must handle them against structured
 * evidence. Read this list before assuming `checkCustomerText` returning `[]` means "clean".
 */
export const EVIDENCE_REQUIRED_RULES: readonly ForbiddenClaim[] =
  FORBIDDEN_CLAIMS.filter((r) => r.enforcement === 'evidence-required');

function spansOf(text: string, sources: readonly string[]): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const src of sources) {
    const re = new RegExp(src, 'giu');
    for (const m of text.matchAll(re)) {
      if (m.index === undefined) continue;
      spans.push([m.index, m.index + m[0].length]);
    }
  }
  return spans;
}

const overlaps = (a: [number, number], spans: Array<[number, number]>) =>
  spans.some(([s, e]) => a[0] < e && s < a[1]);

/**
 * Find forbidden CUSTOMER claims in a string.
 *
 * Both locales are always checked regardless of the page's language, because a bilingual product
 * mixes them constantly and a one-sided check is how «في الوقت الفعلي» survived an English-only
 * audit (§1, note on parity). Pass `locale` only to narrow deliberately.
 */
export function checkCustomerText(
  text: string,
  opts: { locale?: VocabLocale } = {},
): Violation[] {
  if (!text) return [];
  const locales: VocabLocale[] = opts.locale ? [opts.locale] : ['ar', 'en'];
  const out: Violation[] = [];

  for (const rule of PATTERN_RULES) {
    for (const locale of locales) {
      const allowed = rule.allowedContext ? spansOf(text, rule.allowedContext[locale]) : [];
      for (const src of rule.patterns[locale]) {
        const re = new RegExp(src, 'giu');
        for (const m of text.matchAll(re)) {
          if (m.index === undefined) continue;
          const span: [number, number] = [m.index, m.index + m[0].length];
          if (allowed.length && overlaps(span, allowed)) continue;
          out.push({
            ruleId: rule.id,
            title: rule.title,
            locale,
            match: m[0].trim(),
            index: m.index,
            source: rule.source,
          });
        }
      }
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * Find escaped INTERNAL tokens in customer-visible text.
 *
 * Give this RENDERED TEXT, never raw HTML: an RSC payload carries internal prop and column names
 * by design, and scanning it would report a leak on every page. What a customer reads is the
 * only thing this question is about.
 */
export function findInternalLeaks(text: string): Violation[] {
  if (!text) return [];
  const out: Violation[] = [];
  for (const group of INTERNAL_TOKENS as readonly InternalToken[]) {
    for (const token of group.tokens) {
      // Sentinels leak CONCATENATED into a display name ("NO_STORAGEGB" — ADR-081), so the match
      // is deliberately unanchored on the right. Anchoring it would have missed the real defect.
      const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      for (const m of text.matchAll(re)) {
        if (m.index === undefined) continue;
        out.push({
          ruleId: group.id,
          title: `${group.title}: ${token}`,
          locale: 'en',
          match: text.slice(Math.max(0, m.index - 20), m.index + token.length + 20).trim(),
          index: m.index,
          source: group.source,
        });
      }
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Everything a customer surface must satisfy, in one call. */
export function checkCustomerSurface(text: string, opts: { locale?: VocabLocale } = {}): {
  violations: Violation[];
  internalLeaks: Violation[];
  clean: boolean;
  /** Rules this check could NOT decide. Never treat `clean: true` as full coverage. */
  undecided: readonly string[];
  vocabularyVersion: string;
  fingerprint: string;
} {
  const violations = checkCustomerText(text, opts);
  const internalLeaks = findInternalLeaks(text);
  return {
    violations,
    internalLeaks,
    clean: violations.length === 0 && internalLeaks.length === 0,
    undecided: EVIDENCE_REQUIRED_RULES.map((r) => r.id),
    vocabularyVersion: VOCABULARY_VERSION,
    fingerprint: vocabularyFingerprint(),
  };
}

/** Every token in the vocabulary, for the separation test and for reporting. */
export const ALL_CUSTOMER_RULE_IDS: readonly string[] = FORBIDDEN_CLAIMS.map((r) => r.id);
export const ALL_INTERNAL_RULE_IDS: readonly string[] = INTERNAL_TOKENS.map((t) => t.id);
export { ALL_INTERNAL_TOKENS as INTERNAL_TOKEN_LIST };

