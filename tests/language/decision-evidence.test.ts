// Shared decision-evidence primitive (integrated review, 2026-08-30) — the
// canonical source both policy-v2.ts and need-signals.ts consume. Extracted
// from policy-v2.ts's own private lists; this suite pins the same real-text
// behavior that file's backtest already validated, at the primitive level.
import { detectDecisionEvidence, hasDecisionEvidence } from '@/lib/language/decision-evidence';

describe('detectDecisionEvidence — real Saudi shopping text', () => {
  it('recognizes recommendation-request phrasing', () => {
    expect(detectDecisionEvidence('وش تنصحوني لابتوب ل دراسة؟').recommendationRequest).toBe(true);
  });

  it('recognizes an explicit availability question — the signal no formula had until this session', () => {
    const s = detectDecisionEvidence('أحتاج مكيف جري ٣٦٠٠٠ سبليت جداري هل موجود لديكم');
    expect(s.availabilityQuestion).toBe(true);
  });

  it('recognizes a bare declarative want as its OWN weaker signal, distinct from decision evidence', () => {
    const s = detectDecisionEvidence('ابي جوال');
    expect(s.declarativeWantOnly).toBe(true);
    expect(hasDecisionEvidence('ابي جوال')).toBe(false);
  });

  it('a declarative want alongside real decision evidence is NOT double-counted as "declarative only"', () => {
    const s = detectDecisionEvidence('ابي جوال بميزانية 2000 ريال');
    expect(s.budgetStated).toBe(true);
    expect(s.declarativeWantOnly).toBe(false); // budget signal already fired — this isn't a bare want
    expect(hasDecisionEvidence('ابي جوال بميزانية 2000 ريال')).toBe(true);
  });

  it('use-case and comparison signals fire independently', () => {
    expect(detectDecisionEvidence('لابتوب للجامعة').useCaseStated).toBe(true);
    expect(detectDecisionEvidence('ايفون او سامسونج ايهم افضل').explicitComparison).toBe(true);
  });

  it('named competing products requires TWO distinct brands, not one', () => {
    expect(detectDecisionEvidence('ابي ايفون').namedCompetingProducts).toBe(false);
    expect(detectDecisionEvidence('ايفون ولا سامسونج').namedCompetingProducts).toBe(true);
  });

  it('text with no signal at all is neither decision evidence nor a declarative want', () => {
    const s = detectDecisionEvidence('مبروك عليكم اليوم الوطني');
    expect(hasDecisionEvidence('مبروك عليكم اليوم الوطني')).toBe(false);
    expect(s.declarativeWantOnly).toBe(false);
  });
});
