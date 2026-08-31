// src/lib/growth/demand-radar/decision-evidence-score.ts (ADR-280) — the promoted scoring/
// exclusion module rank.ts (Radar 1, real) and shadow/policy-v2.ts (Shadow) both compose.
import {
  isGiveawayReplyContext, isHyperbolicWishNoDecision, scoreDecisionEvidence,
} from '@/lib/growth/demand-radar/decision-evidence-score';
import type { Classification } from '@/lib/growth/demand-radar/types';

function cls(overrides: Partial<Classification> = {}): Classification {
  return {
    category: 'mobile', intentClass: 'recommendation', intentStrength: 'strong', ksaRelevance: 'likely',
    isDirectQuestion: false, budgetSar: null, confidence: 0.9, via: 'heuristic',
    domain: 'product', buyingStage: 'research', intentType: 'help_request', exclusion: 'none',
    ...overrides,
  };
}

describe('isGiveawayReplyContext', () => {
  it('catches a real Radar 1 reject: hashtag giveaway-campaign reply', () => {
    expect(isGiveawayReplyContext('#فلة_وسيارات_هدايا_رسيس #رسيس_قول_وفعل انا ابي جوال فقط انسان قنوع')).toBe(true);
  });
  it('never fires on a bare want without a hashtag — the giveaway shape requires both', () => {
    expect(isGiveawayReplyContext('ابي جوال جديد الحين')).toBe(false);
  });
});

describe('isHyperbolicWishNoDecision', () => {
  it('catches repeated crying-emoji spam', () => {
    expect(isHyperbolicWishNoDecision('بموت ابي ايباد 😭😭😭😭!!!!')).toBe(true);
  });
  it('catches sibling-envy language', () => {
    expect(isHyperbolicWishNoDecision('ياحظكم مره ابغى ايباد اخواتي حصلو ايبادات الا انا')).toBe(true);
  });
  it('never fires on a single emoji — a genuine urgent buyer using one emoji is not hyperbole', () => {
    expect(isHyperbolicWishNoDecision('ابي جوال جديد الحين 😭')).toBe(false);
  });
});

describe('scoreDecisionEvidence', () => {
  it('scores a bare declarative want (no decision evidence) at only 1 point', () => {
    const r = scoreDecisionEvidence('ابي جوال', cls());
    expect(r.excluded).toBe(false);
    expect(r.score).toBe(1);
    expect(r.reasons).toEqual(['declarative_want_only']);
  });

  it('scores a recommendation-request question at 2+ points — the exact language class Radar 1 structurally missed before ADR-280', () => {
    const r = scoreDecisionEvidence('وش تنصحوني لابتوب ل دراسة؟', cls());
    expect(r.score).toBeGreaterThanOrEqual(2);
    expect(r.reasons).toContain('recommendation_request');
  });

  it('an availability question ("is this in stock") scores as strongly as a recommendation request', () => {
    const r = scoreDecisionEvidence('أحتاج مكيف جري ٣٦٠٠٠ سبليت جداري هل موجود لديكم', cls());
    expect(r.reasons).toContain('availability_question');
    expect(r.score).toBeGreaterThanOrEqual(2);
  });

  it('excludes a giveaway-reply candidate at the source, score 0', () => {
    const r = scoreDecisionEvidence('#فلة_وسيارات_هدايا_رسيس #اليوم_الوطني انا ابي جوال فقط انسان قنوع', cls());
    expect(r.excluded).toBe(true);
    expect(r.exclusionDetail).toBe('giveaway_reply_context');
    expect(r.score).toBe(0);
  });

  it('excludes a hyperbolic-wish candidate at the source, score 0', () => {
    const r = scoreDecisionEvidence('بموت ابي ايباد 😭😭😭😭!!!!', cls());
    expect(r.excluded).toBe(true);
    expect(r.exclusionDetail).toBe('hyperbolic_wish_no_decision');
  });

  it('reuses Checkpoint 5.1s existing six detectors — never re-derives them', () => {
    // A merchant ad-comparison-bait post (shadow-exclusion.ts's own detector).
    const r = scoreDecisionEvidence('🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ قبل ما تشتري شوف المقارنة', cls());
    expect(r.excluded).toBe(true);
    expect(r.exclusionDetail).toBe('merchant_ad_comparison_bait');
  });

  it('never throws on empty or unusual text', () => {
    expect(() => scoreDecisionEvidence('', cls())).not.toThrow();
    expect(() => scoreDecisionEvidence('   ', cls())).not.toThrow();
  });
});
