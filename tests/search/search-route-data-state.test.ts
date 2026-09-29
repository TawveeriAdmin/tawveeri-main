// tests/search/search-route-data-state.test.ts — F-005 explicit result-state contract
// (2026-09-29 internal audit). Before this fix, an Algolia failure was caught and only
// console.error'd — the response still carried `errors: null` with a bare `products: []`,
// indistinguishable from a genuine "nothing matches" zero. HTTP 200 + `errors: null` while
// a data source had failed is exactly the defect the audit's F-005 finding named. This test
// pins the structural properties in source (same style as
// tests/search/search-route-dedup-order.test.ts, which established the precedent for this
// route: too large and network-dependent for a full request-level mock, so its safety-
// relevant control flow is instead pinned as static source assertions) rather than
// re-testing full route.ts request/response behaviour with a new mock harness.
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.join(process.cwd(), 'src/app/api/search/route.ts'), 'utf8');

describe('search route — explicit dataState/sourceIssues contract (F-005)', () => {
  it('declares an algoliaFailed flag that starts false', () => {
    expect(src).toMatch(/let algoliaFailed = false;/);
  });

  it('the Algolia catch block sets algoliaFailed = true (never swallows the failure silently)', () => {
    const catchIdx = src.indexOf("console.error('[Algolia] error:', e);");
    expect(catchIdx).toBeGreaterThan(0);
    const nextLines = src.slice(catchIdx, catchIdx + 200);
    expect(nextLines).toContain('algoliaFailed = true;');
  });

  it('sourceIssues is derived from algoliaFailed and dbError, not hardcoded', () => {
    expect(src).toMatch(/const sourceIssues: string\[\] = \[/);
    const declIdx = src.indexOf('const sourceIssues: string[] = [');
    const block = src.slice(declIdx, declIdx + 300);
    expect(block).toContain("algoliaFailed ? ['algolia']");
    expect(block).toContain("dbError ? ['supabase']");
  });

  it('dataState covers all four contract states and both axes (source failure x result count)', () => {
    const declIdx = src.indexOf("const dataState: 'full' | 'degraded' | 'zero_after_success' | 'cannot_trust' =");
    expect(declIdx).toBeGreaterThan(0);
    const block = src.slice(declIdx, declIdx + 400);
    // no source issues -> full or zero_after_success depending on result count
    expect(block).toContain("'full' : 'zero_after_success'");
    // a source issue -> degraded (results present) or cannot_trust (no results) -- this is
    // the branch that used to not exist at all, i.e. the fix itself.
    expect(block).toContain("'degraded' : 'cannot_trust'");
  });

  it('dataState and sourceIssues are both present on the actual response object, not just computed and discarded', () => {
    const resultObjIdx = src.indexOf('const result: ScrapedSearchResult');
    const objLiteralStart = src.indexOf('} = {', resultObjIdx);
    const objLiteralEnd = src.indexOf('\n  };', objLiteralStart);
    const objLiteral = src.slice(objLiteralStart, objLiteralEnd);
    expect(objLiteral).toMatch(/\bdataState,/);
    expect(objLiteral).toMatch(/\bsourceIssues,/);
  });

  it('the existing errors field is untouched (additive change, not a breaking rename)', () => {
    expect(src).toContain('errors:            dbError ? { search: dbError } : null,');
  });
});
