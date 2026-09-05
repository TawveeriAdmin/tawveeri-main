// Truth Hardening mission (2026-09-05) — Product Gap connection (ADR-291). Pure classifier: no
// provider call, no DB write, no insertion — see catalog-gap.ts's own doc comment for why
// synchronous/automatic merchant discovery is NOT implemented this pass.
import { classifyZeroResult } from '@/lib/agent/catalog-gap';

describe('classifyZeroResult — Product Gap classification (signal only, ADR-291)', () => {
  it('PARSER_FAILURE when no category could be resolved at all', () => {
    expect(classifyZeroResult({ rawQuery: 'شي غريب مالي خبر عنه', resolvedCategory: null, categoryEnforcedZero: false })).toBe('PARSER_FAILURE');
  });

  it('CATALOG_MISSING when category resolved AND a specific brand+model was named — the highest-value recovery case', () => {
    expect(classifyZeroResult({ rawQuery: 'Galaxy S27 Ultra 512GB', resolvedCategory: 'mobile', categoryEnforcedZero: true })).toBe('CATALOG_MISSING');
  });

  it('CATALOG_MISSING wins over SEARCH_RELEVANCE_FAILURE when both signals are present — exact identity is the priority case (Section 35)', () => {
    expect(classifyZeroResult({ rawQuery: 'iphone 17 pro max', resolvedCategory: 'mobile', categoryEnforcedZero: true })).toBe('CATALOG_MISSING');
  });

  it('SEARCH_RELEVANCE_FAILURE when category resolved, our own gate zeroed it, but no specific model was named', () => {
    expect(classifyZeroResult({ rawQuery: 'ابي جوال صغير ورخيص', resolvedCategory: 'mobile', categoryEnforcedZero: true })).toBe('SEARCH_RELEVANCE_FAILURE');
  });

  it('INSUFFICIENT_EVIDENCE as the honest default — never overclaims a catalog gap or a relevance defect without evidence', () => {
    expect(classifyZeroResult({ rawQuery: 'جوال', resolvedCategory: 'mobile', categoryEnforcedZero: false })).toBe('INSUFFICIENT_EVIDENCE');
  });
});
