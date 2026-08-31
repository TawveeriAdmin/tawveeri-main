/**
 * Radar 2.0 Phase 1 — behavioral no-op test (founder requirement: "current
 * tier decisions exactly," "current email behavior exactly"). Pins the exact
 * tier rankOpportunity() produces for a fixed set of representative
 * candidates, INCLUDING the two new founder-reviewed false-positive examples
 * (contest, post-purchase story) that motivated this whole phase.
 *
 * rankOpportunity() itself was not edited in Phase 1 — only a new, separate
 * function (computeOpportunityScore) was added alongside it in rank.ts. This
 * test is the proof: it demonstrates that even though Classification now
 * carries an `exclusion` field naming these as contest/post_purchase_story,
 * rankOpportunity()'s signature and logic are unchanged, so it cannot have
 * used that field — and pins today's actual (pre-existing) tier outcome for
 * each, whatever it happens to be, as a golden value that must not drift.
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

describe('rank.ts no-op regression — rankOpportunity() is byte-behaviorally unchanged', () => {
  it('a strong, answerable, confirmed-KSA, budgeted, fresh question is still HIGH (pre-existing golden case)', () => {
    const base = heuristicClassification(mk('ابي غسالة لعائلة كبيرة وميزانيتي 3000 وش تنصحون؟ الرياض'));
    const cls = {
      ...base, category: 'washing_machine', intentStrength: 'strong' as const,
      ksaRelevance: 'confirmed' as const, isDirectQuestion: true, budgetSar: 3000, confidence: 0.9,
    };
    const r = rankOpportunity(mk('ابي غسالة لعائلة 6 وميزانيتي 3000 وش تنصحون؟'), cls, 'yes', '385 منتجًا');
    expect(r.tier).toBe('high');
  });

  it('unsupported category is still a hard IGNORE regardless of intent (pre-existing golden case)', () => {
    const cls = { ...heuristicClassification(mk('ابي غسالة')), category: 'washing_machine' };
    const r = rankOpportunity(mk('ابي غسالة'), cls, 'no', 'فئة غير مدعومة');
    expect(r.tier).toBe('ignore');
  });

  it('the founder-reviewed contest example: rankOpportunity is unaffected by the NEW exclusion field', () => {
    const text = 'يارب افوز في القرعة وابي جوال جديد يكفيني';
    const cls = heuristicClassification(mk(text));
    expect(cls.exclusion).toBe('contest'); // the NEW field correctly identifies it...
    const r = rankOpportunity(mk(text), cls, 'yes', 'test-stub'); // ...but rankOpportunity never reads cls.exclusion
    // Golden value = today's REAL, unchanged production behavior (verified,
    // not assumed): the hamza-variant duplicate markers in lexicalIntent()
    // (ابي/أبي both present in INTENT_MARKERS) push this to intentStrength
    // 'strong', and it scores MEDIUM via the pre-existing evidence-stacking
    // path — proving two things at once: (1) rankOpportunity truly ignores
    // the new `exclusion` field (a real fix would need to consume it, which
    // Phase 1 deliberately does not do), and (2) this is exactly the kind of
    // real gap the new diagnostic in demand-radar-eval.ts now measures.
    expect(r.tier).toBe('medium');
  });

  it('the founder-reviewed post-purchase example: same proof, "اشتريت لي جوال جديد"', () => {
    const text = 'اشتريت لي جوال جديد';
    const cls = heuristicClassification(mk(text));
    expect(cls.exclusion).toBe('post_purchase_story');
    expect(cls.buyingStage).toBe('post_purchase');
    const r = rankOpportunity(mk(text), cls, 'yes', 'test-stub');
    expect(r.tier).toBe('medium'); // same reasoning as the contest case above
  });

  it('computeOpportunityScore is a genuinely separate code path — its signature proves it cannot consume answerability', () => {
    // rankOpportunity(candidate, classification, answerability, reason) — 4 args
    expect(rankOpportunity.length).toBe(4);
    // computeOpportunityScore(candidate, classification) — 2 args, structurally
    // cannot take an answerability input even if a caller wanted it to.
    expect(computeOpportunityScore.length).toBe(2);
  });
});
