/**
 * Radar Policy V2 — backtest against EVERY real founder-labeled candidate
 * this session has retained evidence for (integrated review, 2026-08-30).
 * Pure backtest: no database, no live wiring, no promotion. Two separate
 * evidence pools, reported separately (never pooled into one KPI, per
 * standing rule) — Radar 1's real production history and Shadow's
 * PRODUCT_RECOMMENDATION sample. This is the "tested against founder-
 * labelled Shadow evidence" step the integration review requires before any
 * policy is even considered for promotion — it is evidence, not a decision.
 */
import { scorePolicyV2, type PolicyV2Tier } from '@/lib/growth/demand-radar/shadow/policy-v2';
import type { Classification } from '@/lib/growth/demand-radar/types';
// Real corpus extracted 2026-08-31 (ADR-280) into a shared fixture — same texts/verdicts,
// relocated only, so this file and rank-redesign-backtest.test.ts never drift into two copies.
import { RADAR1_REAL, SHADOW_PRODUCT_RECOMMENDATION, type LabeledCase as Case } from './fixtures/real-labeled-corpus';

function cls(category: string | null = 'mobile'): Classification {
  return {
    category, intentClass: 'recommendation', intentStrength: 'strong', ksaRelevance: 'likely',
    isDirectQuestion: false, budgetSar: null, confidence: 0.9, via: 'heuristic',
    domain: 'product', buyingStage: 'research', intentType: 'help_request', exclusion: 'none',
  };
}

function backtest(cases: Case[]) {
  const rows = cases.map((c) => ({ ...c, result: scorePolicyV2(c.text, cls(c.category)) }));
  const surfaced = (t: PolicyV2Tier) => t === 'high' || t === 'medium';
  const surfacedRows = rows.filter((r) => surfaced(r.result.tier));
  const precision = surfacedRows.length > 0 ? surfacedRows.filter((r) => r.founderVerdict === 'valuable').length / surfacedRows.length : null;
  const totalValuable = rows.filter((r) => r.founderVerdict === 'valuable').length;
  const recall = totalValuable > 0 ? rows.filter((r) => r.founderVerdict === 'valuable' && surfaced(r.result.tier)).length / totalValuable : null;
  return { rows, precision, recall, surfacedCount: surfacedRows.length, totalValuable };
}

describe('Policy V2 backtest — Radar 1 real production (23 candidates, its entire history)', () => {
  const { rows, precision, recall, surfacedCount, totalValuable } = backtest(RADAR1_REAL);

  it('reports precision and recall explicitly (n=23 — below any promotion-worthy floor; this is a design check, not a promotion decision)', () => {
    console.log(`Radar1 backtest: surfaced=${surfacedCount}/23, of which valuable=${Math.round((precision ?? 0) * surfacedCount)}, recall=${recall}/${totalValuable} valuable, precision=${precision}`);
    expect(totalValuable).toBe(1);
  });

  it('the one real accept is surfaced (high or medium), not low or excluded', () => {
    const accept = rows.find((r) => r.founderVerdict === 'valuable')!;
    expect(['high', 'medium']).toContain(accept.result.tier);
    expect(accept.result.reasons).toContain('availability_question'); // "هل موجود لديكم" — buy-ready language the current formula has no signal for at all
  });

  it('does not surface every rejected candidate — some real precision improvement over the current formula, which surfaced all 23 identically at MEDIUM', () => {
    const surfacedFn = (t: PolicyV2Tier) => t === 'high' || t === 'medium';
    const rejectedSurfaced = rows.filter((r) => r.founderVerdict === 'not_valuable' && surfacedFn(r.result.tier)).length;
    expect(rejectedSurfaced).toBeLessThan(22); // current formula: 22/22 rejects also reach MEDIUM
  });

  it('catches the giveaway/contest-reply pattern the existing Shadow detectors do not', () => {
    const giveawayCase = rows.find((r) => r.text.includes('يربحك'))!;
    expect(giveawayCase.result.excluded).toBe(true);
    const nationalDayCase = rows.find((r) => r.text.includes('اليوم_الوطني'))!;
    expect(nationalDayCase.result.excluded).toBe(true);
  });

  it('catches the hyperbolic/emotional-wish pattern the existing Shadow detectors do not', () => {
    const cryingCase = rows.find((r) => r.text.includes('😭'))!;
    expect(cryingCase.result.excluded).toBe(true);
    const envyCase = rows.find((r) => r.text.includes('اخواتي'))!;
    expect(envyCase.result.excluded).toBe(true);
  });
});

describe('Policy V2 backtest — Shadow PRODUCT_RECOMMENDATION (25 candidates, kept as its own separate pool)', () => {
  const { rows, precision, recall, surfacedCount, totalValuable } = backtest(SHADOW_PRODUCT_RECOMMENDATION);

  it('reports precision and recall explicitly (n=25 — below Checkpoint 5.1s own ≥30 floor; not a promotion decision)', () => {
    console.log(`Shadow backtest: surfaced=${surfacedCount}/25, recall=${recall}/${totalValuable} valuable, precision=${precision}`);
    expect(totalValuable).toBe(15);
  });

  it('precision on this pool is directionally at or above the founder-reviewed baseline (60% FAP)', () => {
    expect(precision).not.toBeNull();
    expect(precision as number).toBeGreaterThanOrEqual(0.6);
  });

  it('the recurring merchant-ad template is excluded in every instance, including the fresh repost Checkpoint 5.1 was built against', () => {
    const adRows = rows.filter((r) => r.text.includes('🆚'));
    expect(adRows.length).toBeGreaterThan(0);
    for (const r of adRows) expect(r.result.excluded).toBe(true);
  });

  it('does not require answerability to surface a candidate — this function never reads it at all', () => {
    // Structural check: scorePolicyV2's signature takes no answerability parameter.
    expect(scorePolicyV2.length).toBe(2); // (text, cls) — no third argument exists to pass one
  });
});
