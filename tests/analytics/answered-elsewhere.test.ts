/**
 * "no_answer" does not mean "the customer saw nothing" (ADR-260).
 *
 * THE FINDING
 * The unified search surface runs TWO routes for one user action: the storefront grid
 * (`/api/search`) and the advisor (`/api/v1/agent/decide`). For a need-shaped sentence the
 * storefront deliberately returns an honest zero rather than junk (`categoryEnforcedZero`,
 * "zero beats wrong") and the ADVISOR answers — the shopper sees six real recommendations.
 * But `no_answer` is fired off the storefront result alone.
 *
 * Measured on production 2026-08-18: 77 of 127 REAL no_answer events (61%) were
 * contradicted by a results/advisor_result for the same session and query seconds later.
 * The top entry on the founder's "UNMET DEMAND — prioritize these" list,
 * «مكيف لغرفة 30 متر هادئ تحت 4000» at 22 occurrences, was answered 22 times out of 22.
 * A founder reading that list would have prioritised building something that already worked.
 *
 * These tests pin the correction so the list cannot silently re-fill with answered queries.
 */

import { buildFunnel, wasAnsweredElsewhere, type UsageEventRow } from '@/lib/admin/command-center-queries';

const BASE = Date.UTC(2026, 7, 18, 12, 0, 0);
const at = (msOffset: number) => new Date(BASE + msOffset).toISOString();

const ev = (
  session_id: string,
  event_type: string,
  query_text: string | null,
  msOffset: number,
): UsageEventRow => ({ session_id, event_type, query_text, created_at: at(msOffset) }) as unknown as UsageEventRow;

describe('wasAnsweredElsewhere', () => {
  const GOLDEN = 'مكيف لغرفة 30 متر هادئ تحت 4000';

  it('the real production shape: storefront empty, advisor answers 2s later', () => {
    const events = [
      ev('s1', 'search', GOLDEN, 0),
      ev('s1', 'no_answer', GOLDEN, 500),        // storefront grid came back empty
      ev('s1', 'advisor_result', GOLDEN, 2_500), // advisor rendered 6 recommendations
    ];
    const noAnswer = events[1];
    expect(wasAnsweredElsewhere(noAnswer, events)).toBe(true);
  });

  it('catches the answer that lands AFTER the 3s action window (8 such cases measured)', () => {
    const events = [
      ev('s1', 'no_answer', GOLDEN, 0),
      ev('s1', 'advisor_result', GOLDEN, 7_000),
    ];
    expect(wasAnsweredElsewhere(events[0], events)).toBe(true);
  });

  it('a genuinely unanswered query stays unanswered', () => {
    const events = [
      ev('s1', 'search', 'منتج غير مدعوم', 0),
      ev('s1', 'no_answer', 'منتج غير مدعوم', 500),
    ];
    expect(wasAnsweredElsewhere(events[1], events)).toBe(false);
  });

  it('does not credit an answer from a DIFFERENT session', () => {
    const events = [
      ev('s1', 'no_answer', GOLDEN, 0),
      ev('s2', 'advisor_result', GOLDEN, 1_000),
    ];
    expect(wasAnsweredElsewhere(events[0], events)).toBe(false);
  });

  it('does not credit an answer for a DIFFERENT query', () => {
    const events = [
      ev('s1', 'no_answer', GOLDEN, 0),
      ev('s1', 'advisor_result', 'ايفون 16', 1_000),
    ];
    expect(wasAnsweredElsewhere(events[0], events)).toBe(false);
  });

  it('does not credit a repeat visit days later (the measured long tail)', () => {
    // Production gaps were bimodal: <=10s (same action) then a day-scale tail averaging
    // ~21,000s. The tail is a different visit and must not excuse the original dead end.
    const events = [
      ev('s1', 'no_answer', GOLDEN, 0),
      ev('s1', 'advisor_result', GOLDEN, 6 * 60 * 60 * 1000),
    ];
    expect(wasAnsweredElsewhere(events[0], events)).toBe(false);
  });

  it('is safe when the event carries no query or session', () => {
    const noQuery = ev('s1', 'no_answer', null, 0);
    expect(wasAnsweredElsewhere(noQuery, [noQuery])).toBe(false);
    const noSession = { ...ev('s1', 'no_answer', 'x', 0), session_id: null } as UsageEventRow;
    expect(wasAnsweredElsewhere(noSession, [noSession])).toBe(false);
  });
});

describe('funnel no-answer counting', () => {
  const GOLDEN = 'مكيف لغرفة 30 متر هادئ تحت 4000';

  it('does not count an advisor-answered action as a dead end, even past the 3s cluster', () => {
    const f = buildFunnel([
      ev('s1', 'search', GOLDEN, 0),
      ev('s1', 'no_answer', GOLDEN, 400),
      ev('s1', 'advisor_result', GOLDEN, 6_000),
    ]);
    expect(f.noAnswer).toBe(0);
    expect(f.search).toBe(1);
  });

  it('still counts a genuine dead end', () => {
    const f = buildFunnel([
      ev('s1', 'search', 'منتج غير مدعوم', 0),
      ev('s1', 'no_answer', 'منتج غير مدعوم', 400),
    ]);
    expect(f.noAnswer).toBe(1);
  });

  it('keeps search/results volume untouched by the correction', () => {
    // The fix changes ONE verdict (is this a dead end) and must not move the other counters.
    const f = buildFunnel([
      ev('s1', 'search', GOLDEN, 0),
      ev('s1', 'no_answer', GOLDEN, 400),
      ev('s1', 'advisor_result', GOLDEN, 6_000),
      ev('s2', 'search', 'ايفون 16', 0),
      ev('s2', 'results', 'ايفون 16', 800),
    ]);
    expect(f.search).toBe(2);
    expect(f.results).toBe(2);
    expect(f.noAnswer).toBe(0);
  });
});
