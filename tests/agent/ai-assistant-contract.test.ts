// THE ai-assistant EVIDENCE CONTRACT (ADR-166).
//
// Reproduces the exact production failure of 2026-08-01: 6 of 7 answers suppressed, 5 by
// `saving-or-price-without-provenance`. The prices the model stated were REAL and SUPPLIED in
// the prompt — the route simply never declared them, so the validator correctly refused to
// certify them.
//
// The contract change must eliminate suppression of SUPPORTED answers while leaving genuine
// violations blocked. Both halves are asserted here, because a fix that only removed
// suppression could equally have been a weakened guard.
import { buildPublishedEvidence } from '@/lib/agent/published-evidence';
import { validateGeneratedAnswer } from '@/lib/vocabulary';

/** The evidence the route USED to publish: retailers and counts, and not one price. */
const OLD_BUNDLE = {
  figures: [{ value: 3, kind: 'retailer-count' as const, derivedFrom: 'live-query' as const }],
  retailers: ['أمازون السعودية', 'جرير'],
};

/** The evidence it publishes NOW — built by the SAME contract the decision engine uses. */
const NEW_BUNDLE = buildPublishedEvidence({
  recommendations: [
    { unit_price: 1899, store_count: 3, stores: ['أمازون السعودية', 'جرير', 'اكسترا'] },
    { unit_price: 2099, store_count: null, stores: null },
    { unit_price: 1799, store_count: null, stores: null },
  ],
  smart_pick: null,
});

// What the model actually produces from that prompt: the best price, at a supplied retailer.
const SUPPORTED_ANSWER = 'أفضل سعر 1899 ريال لدى جرير، ومتوفر في 3 متاجر.';

describe('TRUE ANSWERS PREVIOUSLY SUPPRESSED — now published', () => {
  it('reproduces the production suppression with the OLD bundle', () => {
    const v = validateGeneratedAnswer(SUPPORTED_ANSWER, OLD_BUNDLE);
    expect(v.outcome).toBe('rejected');
    expect(v.findings.map((f) => f.ruleId)).toContain('saving-or-price-without-provenance');
  });

  it('publishes the SAME answer with the completed contract', () => {
    const v = validateGeneratedAnswer(SUPPORTED_ANSWER, NEW_BUNDLE);
    expect(`${v.outcome} ${v.findings.map((f) => f.ruleId).join(',')}`.trim()).toBe('passed');
    expect(v.publish).toBe(true);
  });

  it('every supplied price is declared, each with provenance', () => {
    for (const price of [1899, 2099, 1799]) {
      expect(NEW_BUNDLE.figures).toContainEqual(
        expect.objectContaining({ value: price, kind: 'price', derivedFrom: 'live-query' }),
      );
    }
  });
});

describe('GENUINE VIOLATIONS STILL BLOCKED — the guard was completed, not weakened', () => {
  it.each([
    ['a price nobody observed', 'أفضل سعر 999 ريال لدى جرير.', 'saving-or-price-without-provenance'],
    ['a retailer we do not source', 'أفضل سعر 1899 ريال لدى كارفور.', 'excluded-retailer-as-comparison-source'],
    ['a retailer not supplied as evidence', 'The best price is 1899 SAR at noon.', 'excluded-retailer-as-comparison-source'],
    ['a refresh cadence', 'الأسعار تُحدّث يوميًا من المتاجر.', 'refresh-cadence'],
    ['a comprehensive-market claim', 'نتابع كل الأسعار في السعودية.', 'comprehensive-market'],
    ['a retired retailer count', 'Search products from 8 Saudi retailers.', 'retired-retailer-count-string'],
  ])('%s is still rejected under the NEW bundle', (_name, answer, ruleId) => {
    const v = validateGeneratedAnswer(answer, NEW_BUNDLE);
    expect(v.publish).toBe(false);
    expect(v.findings.map((f) => f.ruleId)).toContain(ruleId);
  });

  it('a store count larger than the evidence is still rejected', () => {
    // 3 retailers were supplied; claiming 9 is fabrication whatever the prices say.
    const v = validateGeneratedAnswer('متوفر في 9 متاجر.', NEW_BUNDLE);
    expect(v.publish).toBe(false);
    expect(v.findings.map((f) => f.ruleId)).toContain('fixed-retailer-count');
  });
});

describe('ONE CONTRACT, NOT A FORK', () => {
  it('the route builds its bundle with the shared builder', () => {
    const src = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src/app/api/ai-assistant/route.ts'), 'utf8',
    );
    expect(src).toContain('buildPublishedEvidence');
    // No hand-rolled figure literals left: a second bundle format would be a second policy.
    expect(src).not.toContain("kind: 'price'");
    expect(src).not.toContain("kind: 'retailer-count'");
  });

  it('fail-closed behaviour is untouched — malformed evidence still suppresses', () => {
    const v = validateGeneratedAnswer(SUPPORTED_ANSWER, undefined as never);
    expect(v.outcome).toBe('unavailable');
    expect(v.publish).toBe(false);
  });
});

describe('ONE FACT, ONE CUSTOMER-VISIBLE NUMBER (ADR-168)', () => {
  const { customerPrice, buildPublishedEvidence: build } = require('@/lib/agent/published-evidence');

  it('reproduces the rounding mismatch that suppressed 7 of 11', () => {
    // Prompt showed Math.round(10.994001) = 11; evidence declared 10.994001.
    const raw = build({ recommendations: [{ unit_price: 10.994001 }], smart_pick: null });
    expect(validateGeneratedAnswer('أفضل سعر 11 ريال.', raw).publish).toBe(false);
  });

  it('one shared helper makes prompt and evidence agree', () => {
    const fixed = build({ recommendations: [{ unit_price: customerPrice(10.994001) }], smart_pick: null });
    expect(validateGeneratedAnswer('أفضل سعر 11 ريال.', fixed).publish).toBe(true);
  });

  it('a price never observed is STILL rejected — rounding did not widen the rule', () => {
    const fixed = build({ recommendations: [{ unit_price: customerPrice(10.994001) }], smart_pick: null });
    for (const bogus of ['أفضل سعر 12 ريال.', 'أفضل سعر 999 ريال.', 'أفضل سعر 10 ريال.']) {
      expect(`${bogus} → ${validateGeneratedAnswer(bogus, fixed).publish}`).toBe(`${bogus} → false`);
    }
  });

  it('customerPrice is presentation only — it never mutates the observation', () => {
    const observed = 10.994001;
    expect(customerPrice(observed)).toBe(11);
    expect(observed).toBe(10.994001); // provenance untouched
  });
});
