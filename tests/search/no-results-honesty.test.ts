// tests/search/no-results-honesty.test.ts — external review 2026-10-06 (item 4): the «no results» page showed «منتجات رائجة», which were the last 8 INSERTED
// products (not trending, unrelated to the query) and whose cards linked straight to the merchant — an unmeasured, un-attributed exit. It replaces the earlier
// trending-rail-suppression test (which only narrowed WHEN the rail showed). An empty result now shows no product rail at all.
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(process.cwd(), 'src/app/[locale]/(public)/search/search-client.tsx'), 'utf8');

describe('search empty state', () => {
  it('has no «trending» product rail and never fetches the newest products to fill an empty result', () => {
    expect(SRC).not.toMatch(/trendingProducts|setTrendingProducts|منتجات رائجة|Trending products/);
    expect(SRC).not.toMatch(/\.order\('created_at', \{ ascending: false \}\)\s*\.limit\(8\)/);
  });
  it('keeps the honest budget message and the closest-options lane for a budget-caused zero', () => {
    expect(SRC).toContain('data-testid="budget-zero-message"');
    expect(SRC).toContain('<ClosestOptions');
  });
});
