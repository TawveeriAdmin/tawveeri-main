/**
 * Radar 1 end-to-end redesign backtest (ADR-280, founder-authorized, 2026-08-31).
 *
 * Unlike policy-v2-backtest.test.ts (which tests scoreDecisionEvidence/scorePolicyV2 in
 * isolation, with a FIXED synthetic classification), this test replays the FULL, REAL
 * rankOpportunity() — hard gates, exclusions, and decision-evidence scoring together — using
 * heuristicClassification() on the real text (deterministic, free, no API cost) and a real,
 * read-only live answerability check, so both the OLD and NEW formulas see the exact same real
 * inputs. This is the authoritative "did the redesign actually help" evidence.
 *
 * Requires a live DB read (assessAnswerability) — same category as other growth suites that hit
 * production read-only; run explicitly, not part of the fast default gate.
 */
import { heuristicClassification } from '@/lib/growth/demand-radar/classify';
import { rankOpportunity } from '@/lib/growth/demand-radar/rank';
import { assessAnswerability } from '@/lib/growth/demand-radar/answerability';
import type { RadarCandidate, Classification, Answerability } from '@/lib/growth/demand-radar/types';
import { RADAR1_REAL, SHADOW_PRODUCT_RECOMMENDATION, FRESH_24H_2026_08_31, type LabeledCase } from './fixtures/real-labeled-corpus';

function candidateFor(text: string): RadarCandidate {
  return {
    source: 'x', sourcePostId: 'bt', sourceUrl: '', authorHandle: null,
    threadKey: null, text, lang: 'ar', postedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  };
}

/** The OLD points formula, reproduced exactly as it stood before ADR-280, for a fair
 *  side-by-side comparison against the same real classification inputs. Frozen here
 *  deliberately — this is a historical baseline, not a function under test. */
function oldRankTier(c: RadarCandidate, cls: Classification, answerability: Answerability): 'high' | 'medium' | 'ignore' {
  if (cls.intentStrength === 'none' || cls.intentClass === 'none') return 'ignore';
  if (cls.ksaRelevance === 'not_relevant') return 'ignore';
  if (answerability === 'no') return 'ignore';
  if (!cls.category) return 'ignore';
  let points = 0;
  if (cls.intentStrength === 'strong') points += 2;
  if (cls.isDirectQuestion) points += 1;
  if (cls.budgetSar) points += 1;
  if (cls.ksaRelevance === 'confirmed') points += 1;
  else if (cls.ksaRelevance !== 'likely') points -= 1;
  if (answerability === 'yes') points += 1;
  if (cls.confidence < 0.5) points -= 1;
  const freshMinutes = c.postedAt ? Math.round((Date.now() - new Date(c.postedAt).getTime()) / 60000) : null;
  if (freshMinutes !== null && freshMinutes <= 120) points += 1;
  return points >= 5 && cls.intentStrength === 'strong' && answerability === 'yes' ? 'high' : points >= 3 ? 'medium' : 'ignore';
}

interface Row { pool: string; text: string; verdict: 'valuable' | 'not_valuable'; oldTier: string; newTier: string }

function metrics(rows: Row[], key: 'oldTier' | 'newTier') {
  const surfaced = rows.filter((r) => r[key] === 'high' || r[key] === 'medium');
  const valuable = rows.filter((r) => r.verdict === 'valuable');
  const tp = surfaced.filter((r) => r.verdict === 'valuable').length;
  return {
    surfaced: surfaced.length,
    precision: surfaced.length > 0 ? tp / surfaced.length : null,
    recall: valuable.length > 0 ? tp / valuable.length : null,
  };
}

describe('rankOpportunity() end-to-end redesign backtest (n=59 real founder-labeled texts, ADR-280)', () => {
  const rows: Row[] = [];

  beforeAll(async () => {
    const allCases: Array<LabeledCase & { pool: string }> = [
      ...RADAR1_REAL.map((c) => ({ ...c, pool: 'RADAR1_REAL' })),
      ...SHADOW_PRODUCT_RECOMMENDATION.map((c) => ({ ...c, pool: 'SHADOW_PRODUCT_RECOMMENDATION' })),
      ...FRESH_24H_2026_08_31.map((c) => ({ ...c, pool: 'FRESH_24H' })),
    ];
    for (const c of allCases) {
      const candidate = candidateFor(c.text);
      const cls = heuristicClassification(candidate);
      const { answerability } = await assessAnswerability(cls.category);
      const oldTier = oldRankTier(candidate, cls, answerability);
      const newTier = rankOpportunity(candidate, cls, answerability, 'test-stub').tier;
      rows.push({ pool: c.pool, text: c.text, verdict: c.founderVerdict, oldTier, newTier });
    }
  }, 60_000);

  it('OLD formula: real baseline on this corpus — low precision, high volume (the problem ADR-280 fixes)', () => {
    const m = metrics(rows, 'oldTier');
    console.log('OLD:', JSON.stringify(m));
    expect(m.surfaced).toBeGreaterThan(40); // real baseline: 51/59
    expect(m.precision).toBeLessThan(0.35); // real baseline: ~27.5%
  });

  it('NEW formula: same recall as OLD (nothing the founder would ever have seen is now hidden)', () => {
    const oldM = metrics(rows, 'oldTier');
    const newM = metrics(rows, 'newTier');
    console.log('NEW:', JSON.stringify(newM));
    expect(newM.recall).toBeCloseTo(oldM.recall ?? 0, 5);
  });

  it('NEW formula: materially higher precision and materially fewer surfaced items (less founder noise, same recall)', () => {
    const oldM = metrics(rows, 'oldTier');
    const newM = metrics(rows, 'newTier');
    expect(newM.precision as number).toBeGreaterThan((oldM.precision as number) * 2); // real result: ~2.8x
    expect(newM.surfaced).toBeLessThan(oldM.surfaced * 0.5); // real result: 18 vs 51, ~65% fewer
  });

  it('NEW formula HIGH tier (the only tier that emails the founder) is precise — every real historical HIGH is a real valuable item', () => {
    const highRows = rows.filter((r) => r.newTier === 'high');
    expect(highRows.length).toBeGreaterThan(0); // the redesign must still be able to alert sometimes, not go silent forever
    const highPrecision = highRows.filter((r) => r.verdict === 'valuable').length / highRows.length;
    expect(highPrecision).toBe(1); // real result on this corpus: 3/3
  });

  it('the exact two Shadow-recovered posts that motivated this redesign now reach at least MEDIUM', () => {
    // Direct, named check on the exact two texts from the 24h audit that prompted this redesign
    // (real Radar 1 never even retrieved these — see saudi-lexicon.ts's RECOMMENDATION_QUERIES).
    const targets = [
      'وش افضل لابتوب وماك لحفظ للأستخدام الدراسي',
      'وش افضل مكيف موفر ل الطاقه',
    ];
    for (const fragment of targets) {
      const row = rows.find((r) => r.text.includes(fragment));
      expect(row).toBeDefined();
      expect(row!.verdict).toBe('valuable'); // sanity: this really is one of the founder-labeled valuable rows
      expect(['medium', 'high']).toContain(row!.newTier);
    }
  });
});
