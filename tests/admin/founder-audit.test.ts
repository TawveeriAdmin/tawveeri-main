import { radarStatusAr, founderAIStatusAr } from '@/lib/admin/service-status';
import { resolvePeriod, buildSessionFunnel, buildSessionKpis, type UsageEventRow } from '@/lib/admin/command-center-queries';
import { assembleFounderIntelligenceCandidates, generateFounderIntelligenceBrief } from '@/lib/admin/founder-intelligence';

describe('Founder audit integrity', () => {
  it('uses stage intersections rather than repeated exit volume in conversion rates', () => {
    const events = [
      { event_type: 'search', session_id: 'buyer' },
      { event_type: 'search', session_id: 'other' },
      { event_type: 'comparison_view', session_id: 'buyer' },
      ...Array.from({ length: 1000 }, () => ({ event_type: 'go_click', session_id: 'buyer' })),
      { event_type: 'go_click', session_id: null },
    ] as UsageEventRow[];
    expect(buildSessionKpis(buildSessionFunnel(events))).toMatchObject({ searchToExit: 0.5, compareToExit: 1 });
    expect(buildSessionKpis(buildSessionFunnel([])).searchToExit).toBe(0);
  });
  it('includes the entire final Saudi calendar day in a custom half-open period', () => {
    const range = resolvePeriod('custom', '2026-09-01', '2026-09-25');
    expect(range.start.toISOString()).toBe('2026-08-31T21:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-09-25T21:00:00.000Z');
    expect(new Date('2026-09-25T23:59:59.999+03:00') < range.end).toBe(true);
  });

  it('describes depleted credits without exposing the upstream error payload', () => {
    const status = radarStatusAr('source_unavailable: X API 402: {"detail":"credits depleted","secret":"payload"}');
    expect(status).toContain('نفاد رصيد');
    expect(status).not.toMatch(/payload|402|detail/);
    expect(radarStatusAr(null)).toContain('غير معروفة');
    expect(founderAIStatusAr('Unterminated string in JSON at position 2094')).not.toContain('2094');
  });

  it('rejects a truncated response even if its text happens to parse as JSON', async () => {
    const originalFetch = global.fetch;
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '[]' }] }) });
    try {
      const candidates = assembleFounderIntelligenceCandidates([{
        kind: 'demand_momentum', titleAr: 'طلب', titleEn: 'Demand', evidenceAr: 'دليل', evidenceEn: 'Evidence', sampleSize: 2,
        earlySignal: true, evidenceConfidence: 'low', actionTier: 'WATCH', recommendedActionAr: 'راقب', recommendedActionEn: 'Watch',
      }]);
      const result = await generateFounderIntelligenceBrief(candidates);
      expect(result.aiAvailable).toBe(false);
      expect(result.focusItems).toEqual([]);
    } finally {
      global.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });
});
