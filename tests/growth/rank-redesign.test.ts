/**
 * Radar 2.0 — rankOpportunity() regression pins (ADR-280, 2026-08-31).
 *
 * This file used to pin rankOpportunity() as BYTE-BEHAVIORALLY UNCHANGED (Phase 1's founder
 * requirement). That constraint no longer holds: the founder authorized an end-to-end redesign
 * of Radar 1 on real evidence, and rankOpportunity() is now the promoted decision-evidence
 * scoring (decision-evidence-score.ts) instead of the old points formula. The golden values below
 * are the NEW, intentional, backtested behavior — not accidental drift. See rank.ts's own header
 * note on rankOpportunity() for the real backtest numbers (n=59 real founder-labeled texts:
 * 27.5% -> 77.8% precision, same 82.4% recall).
 *
 * computeOpportunityScore() (a separate, parallel, measurement-only function) is genuinely
 * untouched by this redesign — its own pins stay unchanged below.
 */
import { heuristicClassification } from '@/lib/growth/demand-radar/classify';
import { rankOpportunity, computeOpportunityScore } from '@/lib/growth/demand-radar/rank';
import type { RadarCandidate } from '@/lib/growth/demand-radar/types';

const mk = (text: string, minsAgo = 10): RadarCandidate => ({
  source: 'mock',
  sourcePostId: 'p1',
  sourceUrl: 'https://example.com/p1',
  authorHandle: 'u1',
  threadKey: null,
  text,
  lang: 'ar',
  postedAt: new Date(Date.now() - minsAgo * 60000).toISOString(),
});

describe('rank.ts golden pins — post-redesign (ADR-280)', () => {
  it('unsupported category is still a hard IGNORE regardless of intent (hard gates unchanged by the redesign)', () => {
    const cls = { ...heuristicClassification(mk('ابي غسالة')), category: 'washing_machine' };
    const r = rankOpportunity(mk('ابي غسالة'), cls, 'no', 'فئة غير مدعومة');
    expect(r.tier).toBe('ignore');
  });

  it('the founder-reviewed contest example now correctly reaches IGNORE (was medium under the old points formula — a bare want-verb with no decision evidence now scores below the medium floor)', () => {
    const text = 'يارب افوز في القرعة وابي جوال جديد يكفيني';
    const cls = heuristicClassification(mk(text));
    expect(cls.exclusion).toBe('contest'); // classify.ts's own field still names it correctly...
    const r = rankOpportunity(mk(text), cls, 'yes', 'test-stub'); // ...rankOpportunity still never reads cls.exclusion directly
    expect(r.tier).toBe('ignore');
  });

  it('the founder-reviewed post-purchase example now correctly reaches IGNORE (was medium under the old points formula)', () => {
    const text = 'اشتريت لي جوال جديد';
    const cls = heuristicClassification(mk(text));
    expect(cls.exclusion).toBe('post_purchase_story');
    expect(cls.buyingStage).toBe('post_purchase');
    const r = rankOpportunity(mk(text), cls, 'yes', 'test-stub');
    expect(r.tier).toBe('ignore');
  });

  it('a genuine recommendation-request question reaches MEDIUM at minimum, unlike the two noise examples above with the exact same "want-verb" surface shape', () => {
    const text = 'وش تنصحوني بغسالة توفر كهرباء لعائلة كبيرة؟';
    const cls = { ...heuristicClassification(mk(text)), category: 'washing_machine' };
    const r = rankOpportunity(mk(text), cls, 'yes', 'test-stub');
    expect(['medium', 'high']).toContain(r.tier);
  });

  it('computeOpportunityScore is a genuinely separate code path, untouched by this redesign — its signature proves it cannot consume answerability', () => {
    // rankOpportunity(candidate, classification, answerability, reason) — 4 args
    expect(rankOpportunity.length).toBe(4);
    // computeOpportunityScore(candidate, classification) — 2 args, structurally
    // cannot take an answerability input even if a caller wanted it to.
    expect(computeOpportunityScore.length).toBe(2);
  });
});
