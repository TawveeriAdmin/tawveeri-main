// P2-5 — F7 ON THE DETERMINISTIC ADVISOR (ADR-163).
//
// "Every customer-visible sentence must pass through F7. No path bypasses the validator —
// including clarification questions, fallback text, empty states, error states and partial
// responses."
//
// WHY THIS EXISTS EVEN THOUGH THE ENGINE IS DETERMINISTIC. CHECKPOINT #25 recorded, correctly,
// that F7 does not GOVERN a surface with no runtime generation. But "does not govern" was a
// statement about risk, not about coverage — and the advisor's sentences are COMPOSED at runtime
// from data (`أوفر بـ${diff} ريال`, `ضمن ميزانيتك (${total} ريال)`). A repository search cannot
// catch what a template produces, which is the same property F7 exists to answer for a model.
// Static copy is covered by `vocabulary-scan` over `messages/`; this covers the rest.
//
// FAILURE BEHAVIOUR — WITHHOLD THE SENTENCE, NEVER REWRITE IT.
// F7·2 suppresses a GENERATED answer whole, because a generated answer is one artefact and
// editing it manufactures a claim. A deterministic answer is different in kind: it is a LIST of
// independently-derived statements, so dropping one withholds a claim without inventing one, and
// the remaining statements are exactly as true as they were. Suppressing the whole deterministic
// answer would delete a correct recommendation because one adjacent sentence failed — punishing
// the customer for our defect.
//
// IT SHOULD NEVER FIRE. Measured 2026 of 2026 real production strings passing (ADR-162). A guard
// that never fires is not pointless: it is the difference between "we checked" and "we believe".
// Every activation is recorded, so a first firing is visible rather than silent.
import {
  validateGeneratedAnswer,
  recordValidationEvent,
  type AnswerEvidence,
  type ValidationVerdict,
} from '@/lib/vocabulary';

/** One withheld sentence, kept for the record — never returned to a customer. */
export interface WithheldSentence {
  path: string;
  text: string;
  ruleIds: string[];
  reason: string;
}

export interface GuardResult<T> {
  payload: T;
  withheld: WithheldSentence[];
}

/**
 * The fields a customer actually reads. Enumerated rather than discovered, because a walk of the
 * whole payload would also validate identity keys, slugs and enum tokens — machine fields whose
 * digits are not claims — and would put ~290 regex passes on the hot path instead of ~30.
 *
 * ADDING A CUSTOMER-VISIBLE FIELD? Add it here. `tests/agent/answer-guard.test.ts` asserts this
 * list still covers every prose field the engine emits, so the omission fails loudly.
 */
const PROSE_FIELDS = ['reasons_ar', 'reasons_en', 'caveats_ar', 'caveats_en'] as const;

function isProseKey(key: string): boolean {
  return (PROSE_FIELDS as readonly string[]).includes(key);
}

/**
 * Validate every customer-visible sentence in a decide payload and WITHHOLD any that fails.
 *
 * Mutation is confined to removing array entries: no string is ever altered, so there is no code
 * path here that can produce text a human did not write.
 */
export function guardAdvisorPayload<T extends Record<string, unknown>>(
  payload: T,
  evidence: AnswerEvidence,
  context: { query: string; surface: string; timestamp: string },
): GuardResult<T> {
  const withheld: WithheldSentence[] = [];

  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      const childPath = path ? `${path}.${key}` : key;
      if (isProseKey(key) && Array.isArray(value)) {
        const kept: unknown[] = [];
        const keptFrom: number[] = []; // original index of each survivor
        value.forEach((sentence, originalIndex) => {
          if (typeof sentence !== 'string') { kept.push(sentence); keptFrom.push(originalIndex); return; }
          const verdict: ValidationVerdict = validateGeneratedAnswer(sentence, evidence);
          if (verdict.publish) { kept.push(sentence); keptFrom.push(originalIndex); return; }
          withheld.push({
            path: childPath,
            text: sentence,
            ruleIds: [...new Set(verdict.findings.map((f) => f.ruleId))],
            reason: verdict.unavailableReason ?? verdict.findings.map((f) => f.reason).join(' | '),
          });
          // Recorded individually so a first firing is visible in the same log that answers
          // "was the guard running?" for the generative surface.
          recordValidationEvent({
            verdict, query: context.query, generated: sentence,
            surface: context.surface, timestamp: context.timestamp,
          });
        });
        obj[key] = kept;
        // WITHHOLDING A SENTENCE RENUMBERS EVERY SENTENCE AFTER IT (ADR-187).
        //
        // ADR-187 attached two INDEX-ALIGNED companions to `reasons_ar`: `reason_kinds` (what
        // kind of claim each sentence is) and `headline_reasons` (which at most two the card
        // leads with). Dropping an entry here without remapping them would leave the card
        // rendering a survivor under the WITHHELD sentence's kind, or reading past the end —
        // silently, and only on the day this guard first fires. The guard owns the mutation, so
        // the guard keeps the aligned fields aligned.
        if (key === 'reasons_ar' && kept.length !== value.length) {
          const kinds = obj.reason_kinds;
          if (Array.isArray(kinds)) obj.reason_kinds = keptFrom.map((i) => kinds[i]);
          const headline = obj.headline_reasons;
          if (Array.isArray(headline)) {
            const remap = new Map(keptFrom.map((orig, next) => [orig, next]));
            obj.headline_reasons = (headline as unknown[])
              .map((i) => remap.get(i as number))
              .filter((i): i is number => i !== undefined);
          }
        }
        continue;
      }
      walk(value, childPath);
    }
  };

  walk(payload, '');
  return { payload, withheld };
}
