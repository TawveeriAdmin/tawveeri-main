// F7·3 — THE ADVERSARIAL GATE.
//
// Appendix F7 requires the assistant be tested adversarially before deployment. This is that
// test as a PERMANENT gate: a one-time adversarial pass certifies a build, and what needs
// certifying is every build.
//
// TWO LEVELS, AND THE SECOND IS THE POINT. Detection is not protection — a validator that
// correctly flags a claim while the route publishes it anyway has failed completely. So every
// case is asserted twice: the verdict (§2) and the actual HTTP response the customer would have
// received (§3). Only the second proves anything reached nobody.
//
// ⚠ `AI_ASSISTANT_ENABLED` IS SET INSIDE THIS TEST PROCESS ONLY, so the route body can run at
// all. It is read at module load, which is why the assignment precedes the import. This changes
// NOTHING in production — the deployed surface is verified 404 by `validator-verify.ts`, and no
// env file in this repo sets the flag.
import {
  ADVERSARIAL_CASES,
  MUST_PASS_CASES,
  DECLARED_RESIDUALS,
  EVIDENCE_REQUIRED_RULES,
  EVIDENCE_RULES_HANDLED,
  validateGeneratedAnswer,
  setValidationSink,
  resetValidationSink,
  type ValidationEvent,
} from '@/lib/vocabulary';
import { CATEGORY_SPEC_FILTERS } from '@/lib/scraping/config/spec-configs';

describe('§1 the corpus itself is sound', () => {
  it('covers every family Appendix F7 and the boundary require', () => {
    const required = [
      'unsupported-retailer', 'unsupported-category', 'missing-provenance', 'fabricated-evidence',
      'conflicting-evidence', 'ambiguous-identity', 'impossible-attributes',
      'unavailable-canonical-identity', 'comparison-without-comparison', 'regression',
    ];
    const present = new Set(ADVERSARIAL_CASES.map((c) => c.family));
    expect(required.filter((f) => !present.has(f as never))).toEqual([]);
  });

  it('every case states a purpose and an invariant', () => {
    for (const c of ADVERSARIAL_CASES) {
      expect(c.purpose.length).toBeGreaterThan(20);
      expect(c.invariant.length).toBeGreaterThan(20);
    }
  });

  it('case ids are unique', () => {
    const ids = ADVERSARIAL_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the validator handles exactly the evidence rules F7·1 declares', () => {
    expect([...EVIDENCE_RULES_HANDLED].sort()).toEqual(EVIDENCE_REQUIRED_RULES.map((r) => r.id).sort());
  });

  it('residuals are declared rather than hidden', () => {
    expect(DECLARED_RESIDUALS.length).toBeGreaterThan(0);
    for (const r of DECLARED_RESIDUALS) expect(r.bounded_by.length).toBeGreaterThan(30);
  });
});

describe('§2 every adversarial case is DETECTED, with a deterministic reason', () => {
  it.each(ADVERSARIAL_CASES.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const verdict = validateGeneratedAnswer(c.generated, c.evidence);

    // Requirement 5 — a failure must identify the violated invariant, the evidence used, the
    // decision, and a deterministic reason. All four are asserted, not assumed.
    expect(verdict.outcome).toBe(c.expect);
    expect(verdict.publish).toBe(false);

    if (c.expect === 'rejected') {
      const ids = verdict.findings.map((f) => f.ruleId);
      for (const required of c.expectRules) expect(ids).toContain(required);
      for (const f of verdict.findings) {
        expect(f.reason.length).toBeGreaterThan(15);
        expect(f.match.length).toBeGreaterThan(0);
      }
    } else {
      expect(verdict.unavailableReason).toBeTruthy();
    }
  });

  it('is deterministic — 20 runs of the whole corpus agree exactly', () => {
    const once = () => ADVERSARIAL_CASES.map((c) => JSON.stringify(validateGeneratedAnswer(c.generated, c.evidence)));
    const first = JSON.stringify(once());
    for (let i = 0; i < 20; i++) expect(JSON.stringify(once())).toBe(first);
  });

  it('is category-independent — no case depends on a category the app knows', () => {
    // Swapping the category word must not change any verdict. A rule that only worked for air
    // conditioners would fail here.
    const categories = Object.keys(CATEGORY_SPEC_FILTERS);
    expect(categories.length).toBeGreaterThan(0);
    for (const c of ADVERSARIAL_CASES) {
      const base = validateGeneratedAnswer(c.generated, c.evidence);
      for (const cat of categories.slice(0, 5)) {
        const swapped = validateGeneratedAnswer(`${c.generated} (${cat})`, c.evidence);
        expect(swapped.outcome).toBe(base.outcome);
      }
    }
  });
});

describe('§3 every adversarial case is BLOCKED from the customer — detection is not protection', () => {
  const ORIGINAL_ENV = process.env.AI_ASSISTANT_ENABLED;
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;
  // Typed loosely on purpose: the route returns NextResponse unions, and pinning the exact
  // shape here would couple this gate to the route body it is meant to survive.
  let POST: (req: never) => Promise<Response>;
  let events: ValidationEvent[] = [];
  // `jest.resetModules()` gives the route a FRESH module graph, so the sink must be taken from
  // that same graph — the top-level import is a different instance and would silently record
  // nothing. The symptom is an empty event list beside a correctly suppressed answer, which
  // reads exactly like "the guard did not run".
  let setSink: typeof setValidationSink;
  let resetSink: typeof resetValidationSink;

  beforeAll(async () => {
    // Test process only — see the file header. Set BEFORE the import: the route reads the flag
    // at module load.
    process.env.AI_ASSISTANT_ENABLED = '1';
    process.env.ANTHROPIC_API_KEY = 'test-key-not-used';
    jest.resetModules();
    const vocab = await import('@/lib/vocabulary');
    setSink = vocab.setValidationSink;
    resetSink = vocab.resetValidationSink;
    ({ POST } = await import('@/app/api/ai-assistant/route'));
  });

  afterAll(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.AI_ASSISTANT_ENABLED;
    else process.env.AI_ASSISTANT_ENABLED = ORIGINAL_ENV;
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
    jest.restoreAllMocks();
  });

  beforeEach(() => { events = []; setSink((e) => events.push(e)); });
  afterEach(() => { resetSink(); });

  /** Drive the real route with a generator that returns exactly this adversarial answer. */
  const callRoute = async (generated: string, query = 'أرخص سعر') => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.anthropic.com')) {
        return new Response(JSON.stringify({ content: [{ text: generated }], usage: {} }), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
      // Any other fetch the route makes (intent extraction, data lookups) resolves empty so the
      // route reaches the generation step with NO evidence — the harshest case for the guard.
      return new Response(JSON.stringify({ content: [{ text: '{}' }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    });

    const res = await POST(new Request('http://localhost/api/ai-assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: query }),
    }) as never);
    return { status: res.status, body: await res.json() };
  };

  it.each(ADVERSARIAL_CASES.map((c) => [c.id, c] as const))(
    '%s never reaches the customer',
    async (_id, c) => {
      const { status, body } = await callRoute(c.generated);

      // THE ASSERTION THAT MATTERS: no generated text leaves the route.
      expect(status).toBe(200);
      expect(body.reply).toBeNull();
      expect(body.suppressed).toBe(true);
      expect(body.suppressedBy).toBe('f7-vocabulary-validator');

      // Requirement 4 — nothing was rewritten, spliced or substituted. The response carries no
      // customer-visible text at all, so there is nothing that could have been altered.
      expect(JSON.stringify(body)).not.toContain(c.generated.slice(0, 24));

      // Requirement 7 — an honest unknown, not fabricated certainty: history is NOT extended
      // with the rejected answer, so the next turn cannot inherit it as something we said.
      expect(body.updatedHistory).toEqual([]);

      // Requirement 6 — the event is recorded with its decision.
      expect(events).toHaveLength(1);
      expect(events[0].decision).toBe('suppressed-fell-back-to-deterministic');
      expect(['rejected', 'unavailable']).toContain(events[0].outcome);
    },
  );

  it('a fully-evidenced answer is NOT blocked — the gate is not "reject everything"', async () => {
    // Proven at the validator level rather than through the route, because the route's own
    // lookups supply no evidence in this harness. Without this the cheapest way to pass every
    // adversarial case would be to suppress the product.
    for (const c of MUST_PASS_CASES) {
      const verdict = validateGeneratedAnswer(c.generated, c.evidence);
      expect(
        `${c.id}: ${verdict.outcome} ${verdict.findings.map((f) => f.ruleId).join(',')}${verdict.unavailableReason ?? ''}`,
      ).toBe(`${c.id}: passed `);
      expect(verdict.publish).toBe(true);
    }
  });

  it('the route still refuses entirely when the flag is off — the production state', async () => {
    process.env.AI_ASSISTANT_ENABLED = '0';
    jest.resetModules();
    const { POST: closedPost } = await import('@/app/api/ai-assistant/route');
    const res = await closedPost(new Request('http://localhost/api/ai-assistant', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hi' }),
    }) as never);
    expect(res.status).toBe(404);
    process.env.AI_ASSISTANT_ENABLED = '1';
  });
});
