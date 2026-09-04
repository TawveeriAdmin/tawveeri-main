// tests/campaigns/original-value.test.ts
import { buildContextualInsightAr, buildContextualInsightEn } from '@/lib/campaigns/original-value';
import { checkClaimGuard } from '@/lib/campaigns/claim-guard';

describe('buildContextualInsight — Amazon Decision Layer V2 §3 original value layer', () => {
  it('returns null (no line, not a generic filler) when no comparable-count evidence exists', () => {
    expect(buildContextualInsightAr({ comparableProductCount: null })).toBeNull();
    expect(buildContextualInsightEn({ comparableProductCount: null })).toBeNull();
  });

  it('returns null for a zero/negative count rather than an empty-sounding claim', () => {
    expect(buildContextualInsightAr({ comparableProductCount: 0 })).toBeNull();
    expect(buildContextualInsightAr({ comparableProductCount: -1 })).toBeNull();
  });

  it('states the real count when evidence exists', () => {
    expect(buildContextualInsightAr({ comparableProductCount: 42 })).toContain('42');
    expect(buildContextualInsightEn({ comparableProductCount: 42 })).toContain('42');
  });

  it('never mentions Amazon, price, or a forbidden claim — passes claim-guard with no evidence flag', () => {
    const ar = buildContextualInsightAr({ comparableProductCount: 42 })!;
    const en = buildContextualInsightEn({ comparableProductCount: 42 })!;
    expect(checkClaimGuard([ar, en], false).compliant).toBe(true);
    expect(ar).not.toMatch(/amazon|أمازون|امازون/i);
    expect(en).not.toMatch(/amazon/i);
  });
});
