// Founder Intelligence — AI reasoning layer (integrated review, 2026-08-30).
// The load-bearing property this suite exists to prove: the model can
// select and explain, but can never inject a fact this codebase did not
// already compute. Every test that matters here is an integrity test.
import {
  generateFounderIntelligenceBrief, assembleFounderIntelligenceCandidates,
  describeUnavailability,
} from '@/lib/admin/founder-intelligence';
import type { Opportunity } from '@/lib/admin/opportunities';

function opp(overrides: Partial<Opportunity>): Opportunity {
  return {
    kind: 'demand_momentum', titleAr: 'عنوان', titleEn: 'Title',
    evidenceAr: 'دليل', evidenceEn: 'Evidence', sampleSize: 100, earlySignal: false,
    evidenceConfidence: 'high', actionTier: 'ACT',
    recommendedActionAr: 'إجراء', recommendedActionEn: 'Action',
    ...overrides,
  };
}

function mockFetch(responseText: string, ok = true, status = 200) {
  return jest.fn(async () => ({
    ok, status,
    json: async () => ({ content: [{ type: 'text', text: responseText }] }),
  })) as unknown as typeof fetch;
}

describe('assembleFounderIntelligenceCandidates', () => {
  it('assigns a stable, unique id per opportunity and tags its domain from its kind', () => {
    const candidates = assembleFounderIntelligenceCandidates([
      opp({ kind: 'demand_momentum' }),
      opp({ kind: 'no_agreement_retailer' }),
    ]);
    expect(candidates).toHaveLength(2);
    expect(new Set(candidates.map((c) => c.id)).size).toBe(2);
    expect(candidates[0].domain).toBe('marketing_content');
    expect(candidates[1].domain).toBe('commercial');
  });
});

describe('generateFounderIntelligenceBrief — evidence integrity', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  afterEach(() => { global.fetch = originalFetch; if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey; else delete process.env.ANTHROPIC_API_KEY; });
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key'; });

  it('a candidate id the model invented (not in the input) is silently dropped, never shown', async () => {
    global.fetch = mockFetch(JSON.stringify([{ candidate_id: 'opp-does-not-exist', why_now_ar: 'x', recommended_action_ar: 'y', confidence: 'high' }]));
    const candidates = assembleFounderIntelligenceCandidates([opp({})]);
    const result = await generateFounderIntelligenceBrief(candidates);
    expect(result.focusItems).toEqual([]);
    expect(result.aiAvailable).toBe(true); // the CALL succeeded — the model just cited nothing real
  });

  it('a valid candidate_id resolves ALL facts (title/evidence/sampleSize/earlySignal/evidenceConfidence/actionTier) from the original candidate, never from the model response', async () => {
    const real = opp({
      titleAr: 'العنوان الحقيقي', evidenceAr: 'الدليل الحقيقي 42', sampleSize: 42, earlySignal: true,
      evidenceConfidence: 'low', actionTier: 'INSUFFICIENT_EVIDENCE',
    });
    const candidates = assembleFounderIntelligenceCandidates([real]);
    global.fetch = mockFetch(JSON.stringify([{
      candidate_id: candidates[0].id,
      why_now_ar: 'لأن الأدلة قوية', recommended_action_ar: 'انشر محتوى',
      risk_caveat_ar: 'عينة صغيرة', what_to_measure_next_ar: 'راقب الأسبوع القادم',
    }]));
    const result = await generateFounderIntelligenceBrief(candidates);
    expect(result.focusItems).toHaveLength(1);
    const item = result.focusItems[0];
    expect(item.titleAr).toBe('العنوان الحقيقي');
    expect(item.evidenceAr).toBe('الدليل الحقيقي 42');
    expect(item.sampleSize).toBe(42);
    expect(item.earlySignal).toBe(true);
    expect(item.evidenceConfidence).toBe('low');
    expect(item.actionTier).toBe('INSUFFICIENT_EVIDENCE');
    // narrative fields come from the model
    expect(item.whyNowAr).toBe('لأن الأدلة قوية');
  });

  it('a model attempt to override evidence_confidence or action_tier in its response is silently ignored — both remain exactly what the candidate carried', async () => {
    const real = opp({ evidenceConfidence: 'medium', actionTier: 'WATCH' });
    const candidates = assembleFounderIntelligenceCandidates([real]);
    global.fetch = mockFetch(JSON.stringify([{
      candidate_id: candidates[0].id,
      why_now_ar: 'x', recommended_action_ar: 'y',
      // a hostile/confused model trying to smuggle its own tier through the response object
      evidence_confidence: 'high', action_tier: 'ACT', confidence: 'high',
    }]));
    const result = await generateFounderIntelligenceBrief(candidates);
    expect(result.focusItems[0].evidenceConfidence).toBe('medium');
    expect(result.focusItems[0].actionTier).toBe('WATCH');
  });

  it('caps at 3 focus items even if the model returns more', async () => {
    const candidates = assembleFounderIntelligenceCandidates([opp({}), opp({}), opp({}), opp({}), opp({})]);
    const modelOutput = candidates.map((c) => ({ candidate_id: c.id, why_now_ar: 'x', recommended_action_ar: 'y' }));
    global.fetch = mockFetch(JSON.stringify(modelOutput));
    const result = await generateFounderIntelligenceBrief(candidates);
    expect(result.focusItems.length).toBeLessThanOrEqual(3);
  });

  it('an empty array from the model is a valid, correct "recommend nothing" answer', async () => {
    global.fetch = mockFetch('[]');
    const result = await generateFounderIntelligenceBrief(assembleFounderIntelligenceCandidates([opp({})]));
    expect(result.focusItems).toEqual([]);
    expect(result.aiAvailable).toBe(true);
  });

  it('an empty candidate list never even calls the model — trivially aiAvailable:true with nothing to say', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const result = await generateFounderIntelligenceBrief([]);
    expect(result.focusItems).toEqual([]);
    expect(result.aiAvailable).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('malformed JSON from the model degrades to aiAvailable:false, never a crash', async () => {
    global.fetch = mockFetch('not json at all {{{');
    const result = await generateFounderIntelligenceBrief(assembleFounderIntelligenceCandidates([opp({})]));
    expect(result.aiAvailable).toBe(false);
    expect(result.focusItems).toEqual([]);
  });

  it('a non-2xx API response degrades gracefully with a stated reason', async () => {
    global.fetch = mockFetch('', false, 500);
    const result = await generateFounderIntelligenceBrief(assembleFounderIntelligenceCandidates([opp({})]));
    expect(result.aiAvailable).toBe(false);
    expect(describeUnavailability(result)).toContain('500');
  });

  it('a thrown network error never propagates — always resolves', async () => {
    global.fetch = jest.fn(() => { throw new Error('network down'); }) as unknown as typeof fetch;
    await expect(generateFounderIntelligenceBrief(assembleFounderIntelligenceCandidates([opp({})]))).resolves.not.toThrow();
  });

  it('no API key configured degrades cleanly, no fetch attempted', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const result = await generateFounderIntelligenceBrief(assembleFounderIntelligenceCandidates([opp({})]));
    expect(result.aiAvailable).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an item missing a required narrative field is dropped, not shown half-formed', async () => {
    const candidates = assembleFounderIntelligenceCandidates([opp({})]);
    global.fetch = mockFetch(JSON.stringify([{ candidate_id: candidates[0].id, confidence: 'high' }])); // no why_now_ar/recommended_action_ar
    const result = await generateFounderIntelligenceBrief(candidates);
    expect(result.focusItems).toEqual([]);
  });

  it('the system prompt sent to the model states action_tier/evidence_confidence are fixed and forbids revenue claims and Radar/policy changes', async () => {
    const fetchSpy = mockFetch('[]');
    global.fetch = fetchSpy;
    await generateFounderIntelligenceBrief(assembleFounderIntelligenceCandidates([opp({})]));
    const call = (fetchSpy as jest.Mock).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.system).toContain('evidence_confidence');
    expect(body.system).toContain('action_tier');
    expect(body.system.toLowerCase()).toContain('revenue');
    expect(body.system).toContain('Demand Radar tier');
  });
});
