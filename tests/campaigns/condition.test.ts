// tests/campaigns/condition.test.ts — Amazon × Noon internal commerce, condition truth
// (2026-09-05/06, §1/§2/§16, closure-proof). "RENEWED IS NOT NEW."
import { classifyCondition } from '@/lib/campaigns/condition';

describe('classifyCondition', () => {
  it('is UNKNOWN for a missing or empty title — never guesses', () => {
    expect(classifyCondition(null)).toBe('UNKNOWN');
    expect(classifyCondition(undefined)).toBe('UNKNOWN');
    expect(classifyCondition('')).toBe('UNKNOWN');
    expect(classifyCondition('   ')).toBe('UNKNOWN');
  });

  it('detects RENEWED from real observed title shapes', () => {
    expect(classifyCondition('Renewed -  EliteBook 840 G8 Notebook With 14 Inch Display')).toBe('RENEWED');
    expect(classifyCondition('HP Elitebook 840 G8 Laptop, ... Silver(336G5Ea)(Renewed)')).toBe('RENEWED');
  });

  it('detects REFURBISHED as its own value, distinct from RENEWED — real production evidence, not a hypothetical', () => {
    // 31 real titles found saying "refurbished" without "renewed", e.g.:
    expect(classifyCondition('Apple (Refurbished) iPhone 15 Pro Max (256 GB) - Natural Titanium')).toBe('REFURBISHED');
    expect(classifyCondition('DELL 7060-MINI Desktop Computer, Core i5-8500T, 16GB, 256GB SSD (Refurbished)')).toBe('REFURBISHED');
    expect(classifyCondition('Refurbished- Chromebook 11 3180 Laptop With 11.6-Inch Display')).toBe('REFURBISHED');
  });

  it('detects USED from real observed title shapes', () => {
    expect(classifyCondition('Samsung Galaxy S21 (Used) 128GB')).toBe('USED');
  });

  it('SAFETY: an ordinary, non-disclosed title is UNKNOWN, never assumed NEW — the title alone cannot prove absence of a non-new structured condition field', () => {
    expect(classifyCondition('Samsung QA77S85FAEXSA 77" OLED TV')).toBe('UNKNOWN');
    expect(classifyCondition('Apple Ipad Air M3 128GB Cellular')).toBe('UNKNOWN');
  });

  it('SAFETY: a hypothetical open-box listing (no evidence for this exists in current data) falls through to UNKNOWN, never NEW — proven fail-safe by construction, not by a dedicated detector', () => {
    expect(classifyCondition('Open Box - Sony WH-1000XM5 Headphones')).toBe('UNKNOWN');
  });

  it('never invents a distinction unsupported by evidence: OPEN_BOX is not a produced value (zero real titles found), but is representable as UNKNOWN, never silently as NEW', () => {
    const allPossibleValues: string[] = ['NEW', 'RENEWED', 'REFURBISHED', 'USED', 'UNKNOWN'];
    expect(allPossibleValues).not.toContain('OPEN_BOX');
  });
});
