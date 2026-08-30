// Founder Intelligence — Need Signals (integrated review, 2026-08-30). Pure
// unit tests against synthetic fixtures; answerability is mocked (it reads
// live catalog truth via Demand Radar's own assessAnswerability, which this
// suite treats as already-tested elsewhere — see answerability.ts's own
// coverage). Real-data validation lives in
// scripts/tps-analysis/_tmp-need-signals-realdata.ts (not committed —
// read-only, run manually against retained evidence).
import { computeNeedSignals, MIN_SAMPLE_FOR_SIGNAL } from '@/lib/admin/need-signals';
import type { UsageEventRow } from '@/lib/admin/command-center-queries';

jest.mock('@/lib/growth/demand-radar/answerability', () => ({
  assessAnswerability: jest.fn(async (category: string | null) => {
    if (category === 'air_conditioner') return { answerability: 'yes', reason: 'mock: well covered' };
    if (category === 'cooker') return { answerability: 'no', reason: 'mock: no catalog presence' };
    return { answerability: 'partial', reason: 'mock: thin coverage' };
  }),
}));

function ev(overrides: Partial<UsageEventRow>): UsageEventRow {
  return {
    event_type: 'search', session_id: 's1', is_test: false, source: 'web',
    category: null, query_text: 'مكيف', canonical_id: null,
    created_at: '2026-08-20T10:00:00.000Z', meta: null,
    ...overrides,
  };
}

describe('computeNeedSignals — category volume, momentum, decision evidence, answerability', () => {
  it('derives a category from query_text when the recorded column is empty — same parser as topDemand()', async () => {
    const recent = [ev({ query_text: 'مكيف رخيص لغرفة 30 متر', category: null })];
    const signals = await computeNeedSignals(recent, []);
    expect(signals[0].category).toBe('air_conditioner');
    expect(signals[0].derived).toBe(1);
    expect(signals[0].recorded).toBe(0);
  });

  it('keeps recorded and derived volume separately, summed into total volume', async () => {
    const recent = [
      ev({ category: 'laptop', query_text: 'لابتوب' }),
      ev({ category: null, query_text: 'لابتوب للجامعة' }),
    ];
    const signals = await computeNeedSignals(recent, []);
    expect(signals[0]).toMatchObject({ category: 'laptop', volume: 2, recorded: 1, derived: 1 });
  });

  it('computes momentum as a percentage change vs. the baseline period', async () => {
    const recent = Array.from({ length: 15 }, () => ev({ category: 'air_conditioner' }));
    const baseline = Array.from({ length: 10 }, () => ev({ category: 'air_conditioner' }));
    const signals = await computeNeedSignals(recent, baseline);
    expect(signals[0].momentumPct).toBeCloseTo(50, 5); // 15 vs 10 = +50%
  });

  it('reports momentum as null (never a fabricated percentage) when the baseline is zero', async () => {
    const recent = [ev({ category: 'monitor' })];
    const signals = await computeNeedSignals(recent, []);
    expect(signals[0].momentumPct).toBeNull();
  });

  it('flags a session-concentration risk without silently netting it out', async () => {
    const recent = [
      ...Array.from({ length: 9 }, (_, i) => ev({ category: 'tv', session_id: 'heavy-session' })),
      ev({ category: 'tv', session_id: 'other-session' }),
    ];
    const signals = await computeNeedSignals(recent, []);
    expect(signals[0].topSessionShare).toBeCloseTo(0.9, 5);
  });

  it('computes decision-evidence share using the shared canonical detector, not a private copy', async () => {
    const recent = [
      ev({ category: 'laptop', query_text: 'وش تنصحوني لابتوب ل دراسة؟' }), // decision evidence
      ev({ category: 'laptop', query_text: 'ابي لابتوب' }),                 // bare want only
    ];
    const signals = await computeNeedSignals(recent, []);
    expect(signals[0].decisionEvidenceShare).toBeCloseTo(0.5, 5);
    expect(signals[0].decisionEvidenceCount).toBe(1);
  });

  it('reuses Demand Radar live-catalog answerability — never a second, re-derived check', async () => {
    const recent = [ev({ category: 'air_conditioner' }), ev({ category: 'cooker' })];
    const signals = await computeNeedSignals(recent, []);
    const ac = signals.find((s) => s.category === 'air_conditioner')!;
    const cooker = signals.find((s) => s.category === 'cooker')!;
    expect(ac.answerability).toBe('yes');
    expect(cooker.answerability).toBe('no');
  });

  it('flags below-confidence-floor volume explicitly rather than presenting a thin sample as a strong signal', async () => {
    const recent = Array.from({ length: 5 }, () => ev({ category: 'audio' }));
    const signals = await computeNeedSignals(recent, []);
    expect(signals[0].volume).toBeLessThan(MIN_SAMPLE_FOR_SIGNAL);
    expect(signals[0].belowConfidenceFloor).toBe(true);
  });

  it('ignores non-demand event types (product_view, go_click, etc.)', async () => {
    const recent = [ev({ event_type: 'product_view', category: 'laptop' })];
    const signals = await computeNeedSignals(recent, []);
    expect(signals).toEqual([]);
  });

  it('never throws on a genuinely unparseable query — stays absent from the category list, never crashes', async () => {
    const recent = [ev({ category: null, query_text: 'مكروويف' })]; // real production example the parser still misses
    await expect(computeNeedSignals(recent, [])).resolves.not.toThrow();
    const signals = await computeNeedSignals(recent, []);
    expect(signals).toEqual([]); // no category derived — correctly excluded, not fabricated
  });
});
