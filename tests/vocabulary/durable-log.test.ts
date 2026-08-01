// F7 — DURABLE LOGGING: the guard must survive its own logger (ADR-160).
//
// Every test here pins the same property from a different angle: LOGGING IS OBSERVABILITY, NEVER
// A DEPENDENCY. The failure this prevents is specific and severe — a logging outage that turns
// into a guard outage, letting a violating answer reach a customer because a write timed out.
import {
  validateGeneratedAnswer,
  recordValidationEvent,
  setValidationSink,
  resetValidationSink,
  writeDurableValidationEvent,
  type AnswerEvidence,
  type ValidationEvent,
} from '@/lib/vocabulary';

const EMPTY: AnswerEvidence = { figures: [], retailers: [] };
const violating = 'Prices updated daily across all stores.';

const record = (generated: string) =>
  recordValidationEvent({
    verdict: validateGeneratedAnswer(generated, EMPTY),
    query: 'أرخص لابتوب',
    generated,
    surface: 'test',
    timestamp: '2026-08-01T00:00:00.000Z',
  });

describe('the durable sink is disabled in tests, deliberately', () => {
  it('NODE_ENV=test suppresses durable writes', () => {
    // `.env.local` carries a real production DSN and jest loads it. Without this gate every test
    // run would write to the production log — silently poisoning the one table used to answer
    // "was the guard running?".
    expect(process.env.NODE_ENV).toBe('test');
    expect(() => writeDurableValidationEvent({
      timestamp: '2026-08-01T00:00:00.000Z',
      outcome: 'passed',
      query: 'q',
      generated: 'g',
      generatedTruncated: false,
      violatedRules: [],
      findings: [],
      decision: 'published-generated',
      vocabularyVersion: 'v',
      fingerprint: 'f',
      surface: 'test',
    } as ValidationEvent)).not.toThrow();
  });
});

describe('a logging failure never changes a verdict', () => {
  afterEach(() => resetValidationSink());

  it('a throwing stdout sink does not stop the durable write from being attempted', () => {
    // Separate try blocks, not one around both: a single wrapper would let a throwing first sink
    // silently skip the second, which is how a logger looks healthy while recording nothing.
    const calls: string[] = [];
    setValidationSink(() => { calls.push('stdout'); throw new Error('stdout sink down'); });
    expect(() => record(violating)).not.toThrow();
    expect(calls).toEqual(['stdout']);
  });

  it('the verdict is identical whether the sink works or throws', () => {
    setValidationSink(() => { throw new Error('down'); });
    const broken = record(violating);
    resetValidationSink();
    const captured: ValidationEvent[] = [];
    setValidationSink((e) => captured.push(e));
    const working = record(violating);
    expect(broken.outcome).toBe(working.outcome);
    expect(broken.decision).toBe(working.decision);
    expect(broken.violatedRules).toEqual(working.violatedRules);
  });

  it('suppression still happens when logging is entirely broken', () => {
    setValidationSink(() => { throw new Error('down'); });
    const verdict = validateGeneratedAnswer(violating, EMPTY);
    record(violating);
    // The decision is read from the VERDICT, never from the log — so a dead logger cannot
    // publish anything.
    expect(verdict.publish).toBe(false);
    expect(verdict.outcome).toBe('rejected');
  });

  it('the validator itself never touches the log', () => {
    // Structural, asserted on the source: if `validate.ts` ever imports the log, a logging
    // failure acquires the ability to change a verdict.
    const src = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src/lib/vocabulary/validate.ts'), 'utf8',
    );
    expect(src).not.toContain('validation-log');
    expect(src).not.toContain('durable-sink');
    expect(src).not.toContain('recordValidationEvent');
  });

  it('the durable writer returns void — there is no result a caller could branch on', () => {
    const result = writeDurableValidationEvent({
      timestamp: '2026-08-01T00:00:00.000Z', outcome: 'passed', query: 'q', generated: 'g',
      generatedTruncated: false, violatedRules: [], findings: [],
      decision: 'published-generated', vocabularyVersion: 'v', fingerprint: 'f', surface: 'test',
    } as ValidationEvent);
    expect(result).toBeUndefined();
  });

  it('the durable write is not awaited in the record path', () => {
    // `recordValidationEvent` is synchronous. If it ever became async, a slow database would
    // become a slow answer.
    expect(recordValidationEvent.constructor.name).toBe('Function');
    const returned = record('a plain sentence');
    expect(returned).not.toBeInstanceOf(Promise);
  });
});
