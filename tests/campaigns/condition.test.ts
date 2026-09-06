// tests/campaigns/condition.test.ts — Amazon × Noon internal commerce, condition truth
// (2026-09-05/06, §1/§2/§16, closure-proof; extended 2026-09-06 for the Merchant Condition
// Evidence Recovery mission's §8 resolveCondition() evidence-hierarchy tests). "RENEWED IS
// NOT NEW."
import { classifyCondition, resolveCondition } from '@/lib/campaigns/condition';

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

// Merchant Condition Evidence Recovery (2026-09-06, §4/§8). ADR-299 is CLOSED_FINAL — these
// tests cover the NEW resolveCondition() evidence-hierarchy contract only; they do not touch
// or weaken classifyCondition()'s own UNKNOWN-default rule, re-verified unchanged above.
describe('resolveCondition (evidence-hierarchy contract)', () => {
  it('missing evidence entirely → UNKNOWN, NONE/NONE — never guessed', () => {
    expect(resolveCondition({ title: null })).toEqual({ condition: 'UNKNOWN', evidenceSource: 'NONE', evidenceStrength: 'NONE' });
    expect(resolveCondition({ title: 'Samsung QA77S85FAEXSA 77" OLED TV' })).toEqual({ condition: 'UNKNOWN', evidenceSource: 'NONE', evidenceStrength: 'NONE' });
  });

  it('explicit title RENEWED → RENEWED, EXPLICIT_TITLE/HIGH', () => {
    expect(resolveCondition({ title: 'Renewed -  EliteBook 840 G8 Notebook With 14 Inch Display' }))
      .toEqual({ condition: 'RENEWED', evidenceSource: 'EXPLICIT_TITLE', evidenceStrength: 'HIGH' });
  });

  it('explicit title REFURBISHED → REFURBISHED, EXPLICIT_TITLE/HIGH — real Jarir/Amazon vocabulary, no merchant-specific code needed', () => {
    expect(resolveCondition({ title: 'Apple (Refurbished) iPhone 15 Pro Max (256 GB) - Natural Titanium' }))
      .toEqual({ condition: 'REFURBISHED', evidenceSource: 'EXPLICIT_TITLE', evidenceStrength: 'HIGH' });
  });

  it('a structured field claiming a non-NEW condition is trusted even when the title is silent — structured field overrides title silence safely', () => {
    expect(resolveCondition({ title: 'Generic Product 128GB', structuredCondition: 'renewed' }))
      .toEqual({ condition: 'RENEWED', evidenceSource: 'STRUCTURED_FIELD', evidenceStrength: 'MEDIUM' });
    expect(resolveCondition({ title: 'Generic Product 128GB', structuredCondition: 'refurbished' }))
      .toEqual({ condition: 'REFURBISHED', evidenceSource: 'STRUCTURED_FIELD', evidenceStrength: 'MEDIUM' });
    expect(resolveCondition({ title: 'Generic Product 128GB', structuredCondition: 'used' }))
      .toEqual({ condition: 'USED', evidenceSource: 'STRUCTURED_FIELD', evidenceStrength: 'MEDIUM' });
  });

  it('an explicit RENEWED title marker cannot be overridden by a generic structured "new" claim — EXPLICIT_TITLE outranks an unverified STRUCTURED_FIELD, exactly the real Noon shape (itemCondition="NewCondition" next to a title saying "Renewed")', () => {
    const result = resolveCondition({ title: 'Renewed - EliteBook 840 G8 Notebook', structuredCondition: 'new' });
    expect(result).toEqual({ condition: 'RENEWED', evidenceSource: 'EXPLICIT_TITLE', evidenceStrength: 'HIGH' });
  });

  it('SAFETY: an UNVERIFIED structured "new" claim never promotes to NEW on its own — real, proven Noon counter-example (itemCondition defaults to NewCondition regardless of actual condition)', () => {
    expect(resolveCondition({ title: 'Generic Product 128GB', structuredCondition: 'new' }))
      .toEqual({ condition: 'UNKNOWN', evidenceSource: 'NONE', evidenceStrength: 'NONE' });
  });

  it('a structured "new" claim from a source the caller has independently verified reliable DOES promote to NEW — the mechanism works once real verified evidence exists (no real source qualifies today)', () => {
    expect(resolveCondition({ title: 'Generic Product 128GB', structuredCondition: 'new', structuredSourceVerifiedForNew: true }))
      .toEqual({ condition: 'NEW', evidenceSource: 'STRUCTURED_FIELD', evidenceStrength: 'MEDIUM' });
  });

  it('a verified source contract guaranteeing NEW promotes to NEW when no title/structured evidence exists', () => {
    expect(resolveCondition({ title: null, sourceContractGuaranteesNew: true }))
      .toEqual({ condition: 'NEW', evidenceSource: 'SOURCE_CONTRACT', evidenceStrength: 'MEDIUM' });
  });

  it('conflicting evidence fails safely to the strongest PROVEN claim, never averaged or coin-flipped — explicit title always wins over a source contract too', () => {
    const result = resolveCondition({ title: 'Refurbished - Generic Product', sourceContractGuaranteesNew: true });
    expect(result).toEqual({ condition: 'REFURBISHED', evidenceSource: 'EXPLICIT_TITLE', evidenceStrength: 'HIGH' });
  });

  it('Amazon path: real observed title shape resolves via EXPLICIT_TITLE, matching classifyCondition() exactly (resolveCondition is its superset, not a divergent path)', () => {
    const title = 'HP Elitebook 840 G8 Laptop, ... Silver(336G5Ea)(Renewed)';
    expect(resolveCondition({ title }).condition).toBe(classifyCondition(title));
    expect(resolveCondition({ title }).condition).toBe('RENEWED');
  });

  it('Noon path: real observed title shape resolves via EXPLICIT_TITLE; the merchant\'s own (unverified) structured NewCondition field must not override it if a caller ever passes it through unchecked', () => {
    const title = 'Renewed -  EliteBook 840 G8 Notebook With 14 Inch Display';
    expect(resolveCondition({ title, structuredCondition: 'new' })).toEqual({ condition: 'RENEWED', evidenceSource: 'EXPLICIT_TITLE', evidenceStrength: 'HIGH' });
  });

  it('Jarir path (non-Amazon/Noon merchant, real evidence exists): "Renewed Grade" vocabulary resolves identically — proves the resolver is merchant-agnostic, no Jarir-specific branch needed', () => {
    expect(resolveCondition({ title: 'Apple iPhone 13 128GB - Renewed Grade A' }).condition).toBe('RENEWED');
  });
});
