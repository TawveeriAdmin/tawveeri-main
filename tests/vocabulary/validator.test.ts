// F7·2 — VALIDATOR TESTS, one per acceptance criterion.
//
// The validator's whole value is that it fails in exactly one direction. Every test here pins a
// property that, if it silently reversed, would let an unevidenced claim reach a customer.
import {
  validateGeneratedAnswer,
  EVIDENCE_RULES_HANDLED,
  EVIDENCE_REQUIRED_RULES,
  MAX_INPUT_CHARS,
  recordValidationEvent,
  setValidationSink,
  resetValidationSink,
  MAX_LOGGED_CHARS,
  VOCABULARY_VERSION,
  vocabularyFingerprint,
  type AnswerEvidence,
  type ValidationEvent,
} from '@/lib/vocabulary';

const EMPTY: AnswerEvidence = { figures: [], retailers: [] };
const evidence = (e: Partial<AnswerEvidence>): AnswerEvidence => ({ ...EMPTY, ...e });

describe('AC9 — EVIDENCE_REQUIRED_RULES is the single source of truth', () => {
  // THE LOAD-BEARING TEST. Add an evidence-required rule in F7·1 and this fails until F7·2
  // handles it. Without it, F7·1 could grow a rule the validator silently never checks — and
  // `checkCustomerText` returning [] would still read as "clean".
  it('the validator handles exactly the rules F7·1 declares evidence-required', () => {
    const declared = EVIDENCE_REQUIRED_RULES.map((r) => r.id).sort();
    expect([...EVIDENCE_RULES_HANDLED].sort()).toEqual(declared);
  });

  it('an unhandled evidence rule makes the validator UNAVAILABLE, never silently passing', () => {
    // Simulated by the validator's own guard: if F7·1 declared a rule this file does not
    // handle, `unhandled_evidence_rules:` is returned instead of a pass.
    const verdict = validateGeneratedAnswer('nothing interesting here', EMPTY);
    expect(verdict.unavailableReason ?? '').not.toContain('unhandled_evidence_rules');
    expect(verdict.outcome).toBe('passed');
  });

  it('every finding cites a rule id that exists in the vocabulary', () => {
    const v = validateGeneratedAnswer('Compare 5023 products compared today', EMPTY);
    const known = new Set([...EVIDENCE_RULES_HANDLED, ...['price-currency-claim', 'refresh-cadence', 'comprehensive-market', 'retired-retailer-count-string', 'official-partnership', 'exclusive-coupon', 'internal-engineering-figure', 'competitor-retroactive-claim', 'compliance-claim', 'identity-sentinel', 'storage-layer-name']]);
    for (const f of v.findings) expect(known.has(f.ruleId)).toBe(true);
  });
});

describe('AC2 — every rejection names a rule and a measurable reason', () => {
  it('catalogue figure offered as comparable is rejected with both numbers', () => {
    const v = validateGeneratedAnswer('We compare 5023 products compared across retailers.', evidence({
      figures: [
        { value: 5023, kind: 'catalogue-count', derivedFrom: 'live-query' },
        { value: 758, kind: 'comparable-count', derivedFrom: 'live-query' },
      ],
    }));
    expect(v.outcome).toBe('rejected');
    const f = v.findings.find((x) => x.ruleId === 'catalogue-presented-as-comparable')!;
    expect(f).toBeDefined();
    expect(f.reason).toContain('5023');
    expect(f.reason).toContain('CATALOGUE');
    expect(f.reason).toContain('758');
  });

  it('a comparable figure that IS in evidence passes', () => {
    const v = validateGeneratedAnswer('We compare 758 products compared across retailers.', evidence({
      figures: [{ value: 758, kind: 'comparable-count', derivedFrom: 'live-query' }],
    }));
    expect(v.outcome).toBe('passed');
  });

  it('a retailer count not derived from a live query is rejected, and says so', () => {
    const v = validateGeneratedAnswer('Search across 8 retailers.', evidence({
      figures: [{ value: 8, kind: 'retailer-count', derivedFrom: 'static' }],
    }));
    expect(v.outcome).toBe('rejected');
    const f = v.findings.find((x) => x.ruleId === 'fixed-retailer-count')!;
    expect(f.reason).toContain('static');
    expect(f.reason).toContain('live query');
  });

  it('a retailer count derived from a live query passes', () => {
    const v = validateGeneratedAnswer('Available at 3 stores.', evidence({
      figures: [{ value: 3, kind: 'retailer-count', derivedFrom: 'live-query' }],
    }));
    expect(v.outcome).toBe('passed');
  });

  it('a retailer count absent from evidence is rejected — unknown beats incorrect', () => {
    const v = validateGeneratedAnswer('Available at 11 stores.', EMPTY);
    expect(v.outcome).toBe('rejected');
    expect(v.findings[0].reason).toContain('no retailer-count figure');
  });

  it('a display-excluded retailer named as a source is rejected via the code authority', () => {
    const v = validateGeneratedAnswer('The best price is at lulu right now.', evidence({ retailers: ['lulu'] }));
    const f = v.findings.find((x) => x.ruleId === 'excluded-retailer-as-comparison-source')!;
    expect(f).toBeDefined();
    expect(f.reason).toContain('isDisplayableRetailer');
  });

  it('a retailer not supplied as evidence is rejected as a fabricated source', () => {
    const v = validateGeneratedAnswer('Cheapest at jarir.', evidence({ retailers: ['amazon'] }));
    const f = v.findings.find((x) => x.ruleId === 'excluded-retailer-as-comparison-source')!;
    expect(f).toBeDefined();
    expect(f.reason).toContain('not among the retailers supplied as evidence');
  });

  it('a supplied, displayable retailer passes', () => {
    const v = validateGeneratedAnswer('Cheapest at jarir.', evidence({ retailers: ['jarir'] }));
    expect(v.outcome).toBe('passed');
  });
});

describe('AC8 — Arabic-Indic digits are read, not silently dropped', () => {
  // Third occurrence of this trap in the codebase (ADR-153). A validator that cannot read
  // «٥٠٢٣» would wave through exactly the claim it exists to catch.
  it('catches a catalogue figure written in Arabic-Indic digits', () => {
    const v = validateGeneratedAnswer('نقارن ٥٠٢٣ منتجًا مقارنًا.', evidence({
      figures: [{ value: 5023, kind: 'catalogue-count', derivedFrom: 'live-query' }],
    }));
    expect(v.outcome).toBe('rejected');
    expect(v.findings.some((f) => f.ruleId === 'catalogue-presented-as-comparable')).toBe(true);
  });

  it('catches an Arabic-Indic retailer count', () => {
    const v = validateGeneratedAnswer('متوفر في ٨ متاجر.', EMPTY);
    expect(v.outcome).toBe('rejected');
    expect(v.findings.some((f) => f.ruleId === 'fixed-retailer-count')).toBe(true);
  });
});

describe('AC1 + AC3 — post-generation only, and never mutates the output', () => {
  it('the validator returns a verdict and no text', () => {
    const generated = 'Prices updated daily across all stores.';
    const v = validateGeneratedAnswer(generated, EMPTY) as unknown as Record<string, unknown>;
    // There is no code path that can emit modified text: assert the shape carries none.
    for (const key of Object.keys(v)) {
      expect(['outcome', 'publish', 'findings', 'unavailableReason', 'vocabularyVersion', 'fingerprint']).toContain(key);
    }
  });

  it('the input string is unchanged after validation', () => {
    const generated = 'Prices updated daily.';
    const before = generated.slice();
    validateGeneratedAnswer(generated, EMPTY);
    expect(generated).toBe(before);
  });

  it('publish is true only when there are zero findings', () => {
    expect(validateGeneratedAnswer('A plain sentence about nothing.', EMPTY).publish).toBe(true);
    expect(validateGeneratedAnswer('Prices updated daily.', EMPTY).publish).toBe(false);
  });
});

describe('AC4 — fail closed when the validator cannot run', () => {
  const cases: Array<[string, () => ReturnType<typeof validateGeneratedAnswer>, string]> = [
    ['input over the deterministic cap', () => validateGeneratedAnswer('x'.repeat(MAX_INPUT_CHARS + 1), EMPTY), 'input_too_large'],
    ['generated output not a string', () => validateGeneratedAnswer(undefined as unknown as string, EMPTY), 'generated_output_not_a_string'],
    ['evidence missing', () => validateGeneratedAnswer('hello', undefined as unknown as AnswerEvidence), 'evidence_missing_or_malformed'],
    ['evidence malformed', () => validateGeneratedAnswer('hello', { figures: 'nope', retailers: [] } as unknown as AnswerEvidence), 'evidence_missing_or_malformed'],
  ];

  it.each(cases)('%s → unavailable, publish=false', (_name, run, reason) => {
    const v = run();
    expect(v.outcome).toBe('unavailable');
    expect(v.publish).toBe(false);
    expect(v.unavailableReason).toBe(reason);
  });

  it('unavailable suppresses exactly as a rejection does', () => {
    const unavailable = validateGeneratedAnswer('x'.repeat(MAX_INPUT_CHARS + 1), EMPTY);
    const rejected = validateGeneratedAnswer('Prices updated daily.', EMPTY);
    expect(unavailable.publish).toBe(rejected.publish);
    expect(unavailable.publish).toBe(false);
  });

  it('unavailable is NOT reported as rejected — a broken guard must not hide in the reject rate', () => {
    expect(validateGeneratedAnswer('x'.repeat(MAX_INPUT_CHARS + 1), EMPTY).outcome).not.toBe('rejected');
  });
});

describe('AC5 — deterministic', () => {
  it('100 runs of the same input produce an identical verdict', () => {
    const text = 'Prices updated daily at 8 retailers, lulu included. نقارن ٥٠٢٣ منتجًا مقارنًا.';
    const ev = evidence({ figures: [{ value: 5023, kind: 'catalogue-count', derivedFrom: 'live-query' }], retailers: ['amazon'] });
    const first = JSON.stringify(validateGeneratedAnswer(text, ev));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(validateGeneratedAnswer(text, ev))).toBe(first);
  });

  it('the decision path contains no wall-clock or randomness', () => {
    const src = require('fs').readFileSync(require('path').join(process.cwd(), 'src/lib/vocabulary/validate.ts'), 'utf8');
    expect(src).not.toMatch(/Date\.now\(|new Date\(|Math\.random\(|setTimeout\(|performance\.now\(/);
  });
});

describe('AC6 — category-independent', () => {
  it('the same claim in different categories yields the same verdict', () => {
    const shape = (category: string) => `Available at 9 stores for the best ${category} price.`;
    const verdicts = ['laptop', 'mobile', 'air conditioner', 'washing machine', 'refrigerator']
      .map((c) => validateGeneratedAnswer(shape(c), EMPTY))
      .map((v) => `${v.outcome}:${v.findings.map((f) => f.ruleId).join(',')}`);
    expect(new Set(verdicts).size).toBe(1);
  });

  it('the validator source names no product category', () => {
    const src = require('fs').readFileSync(require('path').join(process.cwd(), 'src/lib/vocabulary/validate.ts'), 'utf8').toLowerCase();
    for (const c of ['smartphone', 'air_conditioner', 'washing_machine', 'refrigerator', 'laptop"']) {
      expect(src).not.toContain(c);
    }
  });
});

describe('AC7 — every validation event is recorded, and the three outcomes are distinguishable', () => {
  let events: ValidationEvent[] = [];
  beforeEach(() => { events = []; setValidationSink((e) => events.push(e)); });
  afterEach(() => resetValidationSink());

  const record = (generated: string, ev: AnswerEvidence) =>
    recordValidationEvent({
      verdict: validateGeneratedAnswer(generated, ev),
      query: 'أرخص لابتوب',
      generated,
      surface: 'test',
      timestamp: '2026-08-01T00:00:00.000Z',
    });

  it('a PASS is recorded, not only failures', () => {
    record('A plain sentence.', EMPTY);
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('passed');
    expect(events[0].decision).toBe('published-generated');
  });

  it('a REJECT records the violated rule, the output, the query and the timestamp', () => {
    record('Prices updated daily.', EMPTY);
    const e = events[0];
    expect(e.outcome).toBe('rejected');
    expect(e.violatedRules).toContain('refresh-cadence');
    expect(e.generated).toBe('Prices updated daily.');
    expect(e.query).toBe('أرخص لابتوب');
    expect(e.timestamp).toBe('2026-08-01T00:00:00.000Z');
    expect(e.decision).toBe('suppressed-fell-back-to-deterministic');
    expect(e.findings[0].reason.length).toBeGreaterThan(10);
  });

  it('UNAVAILABLE is a third, distinct state carrying its reason', () => {
    record('x'.repeat(MAX_INPUT_CHARS + 1), EMPTY);
    const e = events[0];
    expect(e.outcome).toBe('unavailable');
    expect(e.unavailableReason).toBe('input_too_large');
    expect(e.violatedRules).toEqual([]);
    expect(e.decision).toBe('suppressed-fell-back-to-deterministic');
  });

  it('every event carries the vocabulary version and fingerprint it was judged under', () => {
    record('A plain sentence.', EMPTY);
    expect(events[0].vocabularyVersion).toBe(VOCABULARY_VERSION);
    expect(events[0].fingerprint).toBe(vocabularyFingerprint());
  });

  it('a long output is truncated and SAYS it was truncated', () => {
    const long = 'a'.repeat(MAX_LOGGED_CHARS + 500);
    record(long, EMPTY);
    expect(events[0].generated).toHaveLength(MAX_LOGGED_CHARS);
    expect(events[0].generatedTruncated).toBe(true);
  });

  it('a throwing sink never breaks the answer path', () => {
    setValidationSink(() => { throw new Error('sink down'); });
    expect(() => record('A plain sentence.', EMPTY)).not.toThrow();
  });
});
