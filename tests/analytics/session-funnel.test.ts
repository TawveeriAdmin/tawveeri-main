/**
 * Session-level funnel — conversion rates that cannot exceed 100% (ADR-259).
 *
 * WHY THIS EXISTS
 * On 2026-08-18 the launch-readiness gate printed "Comparison → Exit (CTR) 2003.6% PASS"
 * and every KPI green, on a sample that was mostly the founder's own traffic. The 2003.6%
 * came from dividing rows of the outbound_clicks TABLE by comparison_view EVENT rows —
 * two datasets, two time scopes, one number the founder was about to make a distribution
 * decision on.
 *
 * These are synthetic funnels with hand-computed expected answers, which is the only way
 * to prove a metric means what it says: production data cannot tell you the arithmetic is
 * right, it can only tell you the number changed.
 */

import { buildSessionFunnel, sessionRate, type UsageEventRow } from '@/lib/admin/command-center-queries';

let seq = 0;
const ev = (session_id: string, event_type: string, query_text: string | null = null): UsageEventRow =>
  ({
    session_id,
    event_type,
    query_text,
    // Fixed base + increment: ordering is deterministic and never depends on wall clock.
    created_at: new Date(Date.UTC(2026, 7, 18, 0, 0, seq++)).toISOString(),
  }) as unknown as UsageEventRow;

beforeEach(() => { seq = 0; });

describe('buildSessionFunnel — units are sessions, always', () => {
  it('counts a session once per stage no matter how many events it fires', () => {
    // One session, ten comparison views. That is ONE session at the comparison stage.
    const events = [
      ev('s1', 'search', 'ايفون'),
      ev('s1', 'results', 'ايفون'),
      ...Array.from({ length: 10 }, () => ev('s1', 'comparison_view')),
      ev('s1', 'go_click'),
    ];
    const f = buildSessionFunnel(events);
    expect(f.sessions).toBe(1);
    expect(f.viewedComparison).toBe(1);
    expect(f.exited).toBe(1);
    expect(f.viewedComparisonAndExited).toBe(1);
    // The defect in one assertion: 10 events / 1 session would have been 1000%.
    expect(sessionRate(f.viewedComparisonAndExited, f.viewedComparison)).toBe(1);
  });

  it('never exceeds 100% even when exits outnumber comparisons many times over', () => {
    // 3 sessions compared; 2 of them exited. 50 exit events across the board.
    const events: UsageEventRow[] = [];
    for (const s of ['a', 'b', 'c']) { events.push(ev(s, 'search'), ev(s, 'results'), ev(s, 'comparison_view')); }
    for (const s of ['a', 'b']) { for (let i = 0; i < 25; i++) events.push(ev(s, 'go_click')); }
    const f = buildSessionFunnel(events);
    expect(f.viewedComparison).toBe(3);
    expect(f.viewedComparisonAndExited).toBe(2);
    expect(sessionRate(f.viewedComparisonAndExited, f.viewedComparison)).toBeCloseTo(2 / 3);
  });

  it('a session that exited WITHOUT comparing never inflates compare→exit', () => {
    // The structural reason the old ratio could exceed 100%: exits from sessions that
    // never reached the denominator's stage.
    const events = [
      ev('compared', 'comparison_view'), ev('compared', 'go_click'),
      ev('never-compared', 'go_click'), ev('never-compared', 'go_click'),
      ev('also-never', 'go_click'),
    ];
    const f = buildSessionFunnel(events);
    expect(f.exited).toBe(3);            // three sessions exited
    expect(f.viewedComparison).toBe(1);  // one session compared
    expect(f.viewedComparisonAndExited).toBe(1);
    expect(sessionRate(f.viewedComparisonAndExited, f.viewedComparison)).toBe(1); // 100%, not 300%
  });

  it('computes a realistic mixed funnel exactly', () => {
    const events: UsageEventRow[] = [
      // s1: full journey
      ev('s1', 'search'), ev('s1', 'results'), ev('s1', 'product_view'), ev('s1', 'comparison_view'), ev('s1', 'go_click'),
      // s2: searched, got results, viewed a product, stopped
      ev('s2', 'search'), ev('s2', 'results'), ev('s2', 'product_view'),
      // s3: searched, dead end
      ev('s3', 'search'), ev('s3', 'no_answer'),
      // s4: landed and left without searching
      ev('s4', 'product_view'),
    ];
    const f = buildSessionFunnel(events);
    expect(f.sessions).toBe(4);
    expect(f.searched).toBe(3);
    expect(f.gotResults).toBe(2);
    expect(f.noAnswer).toBe(1);
    expect(f.viewedProduct).toBe(3);            // s1, s2, s4
    expect(f.searchedAndViewedProduct).toBe(2); // s4 did not search
    expect(f.viewedComparison).toBe(1);
    expect(f.exited).toBe(1);

    expect(sessionRate(f.searchedAndGotResults, f.searched)).toBeCloseTo(2 / 3);
    expect(sessionRate(f.searchedAndViewedProduct, f.searched)).toBeCloseTo(2 / 3);
    expect(sessionRate(f.searchedAndExited, f.searched)).toBeCloseTo(1 / 3);
  });

  it('treats an advisor_query/search echo of one action as one searching session', () => {
    // ADR-214: the unified surface fires both for a single user action.
    const f = buildSessionFunnel([ev('s1', 'search', 'مكيف'), ev('s1', 'advisor_query', 'مكيف')]);
    expect(f.searched).toBe(1);
    expect(f.sessions).toBe(1);
  });

  it('does not count a session that reached results as a dead end', () => {
    // A query that no-answered and then succeeded on retry is not unmet demand.
    const f = buildSessionFunnel([ev('s1', 'search'), ev('s1', 'no_answer'), ev('s1', 'results')]);
    expect(f.noAnswer).toBe(0);
    expect(f.gotResults).toBe(1);
  });

  it('ignores events with no session id rather than inventing a session', () => {
    const f = buildSessionFunnel([ev('s1', 'search'), { ...ev('x', 'go_click'), session_id: null } as UsageEventRow]);
    expect(f.sessions).toBe(1);
    expect(f.exited).toBe(0);
  });

  it('is empty-safe', () => {
    const f = buildSessionFunnel([]);
    expect(f.sessions).toBe(0);
    expect(sessionRate(f.searchedAndExited, f.searched)).toBe(0); // 0, never NaN
  });
});

describe('every bounded rate stays within [0,1] on adversarial input', () => {
  it('holds for a lopsided event storm', () => {
    const events: UsageEventRow[] = [];
    for (let s = 0; s < 7; s++) {
      const id = `s${s}`;
      events.push(ev(id, 'search'), ev(id, 'results'));
      for (let i = 0; i < 40; i++) events.push(ev(id, 'go_click'), ev(id, 'comparison_view'), ev(id, 'product_view'));
    }
    const f = buildSessionFunnel(events);
    const rates = [
      sessionRate(f.searchedAndGotResults, f.searched),
      sessionRate(f.searchedAndViewedProduct, f.searched),
      sessionRate(f.viewedProductAndComparison, f.viewedProduct),
      sessionRate(f.viewedComparisonAndExited, f.viewedComparison),
      sessionRate(f.searchedAndExited, f.searched),
      sessionRate(f.noAnswer, f.searched),
    ];
    for (const r of rates) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });
});
