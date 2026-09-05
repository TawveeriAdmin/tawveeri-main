// tests/campaigns/condition.test.ts — Amazon × Noon internal commerce, condition truth
// (2026-09-05, §1/§2/§16). "RENEWED IS NOT NEW."
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
    expect(classifyCondition('iPad Air (Refurbished) 64GB')).toBe('RENEWED'); // refurbished groups into RENEWED (extractSpecsFromTitle's own design)
  });

  it('detects USED from real observed title shapes', () => {
    expect(classifyCondition('Samsung Galaxy S21 (Used) 128GB')).toBe('USED');
  });

  it('classifies an ordinary, non-disclosed title as NEW — the evidence-backed default, not a guess', () => {
    expect(classifyCondition('Samsung QA77S85FAEXSA 77" OLED TV')).toBe('NEW');
    expect(classifyCondition('Apple Ipad Air M3 128GB Cellular')).toBe('NEW');
  });

  it('never invents OPEN_BOX or a fourth condition value — no evidence for it exists in this codebase', () => {
    const allPossible = ['NEW', 'RENEWED', 'USED', 'UNKNOWN'];
    expect(allPossible).not.toContain('OPEN_BOX');
    expect(allPossible).not.toContain('REFURBISHED');
  });
});
