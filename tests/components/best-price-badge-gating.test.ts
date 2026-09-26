// tests/components/best-price-badge-gating.test.ts — ADR-388 source contract.
// Live contradiction (2026-09-26, Samsung 18000 product page): the store table read
// «متجر واحد — لا مقارنة بعد» while the only row wore an «أفضل سعر» badge. A superlative
// needs a comparison; both components now gate the badge on ≥ 2 store rows.
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('«أفضل سعر» badge requires at least two stores', () => {
  it('comparison-table.tsx gates isWinner on rows.length > 1', () => {
    const src = read('src/components/products/comparison-table.tsx');
    expect(src).toMatch(/const hasComparison = rows\.length > 1;/);
    const winners = src.match(/const isWinner = hasComparison && ps\.current_price === bestPriceValue;/g) ?? [];
    expect(winners.length).toBeGreaterThanOrEqual(2);
    expect(src).not.toMatch(/const isWinner = ps\.current_price === bestPriceValue;/);
  });

  it('store-comparison-panel.tsx gates isBestPrice on sortedStores.length > 1', () => {
    const src = read('src/components/search/store-comparison-panel.tsx');
    expect(src).toMatch(/const isBestPrice = sortedStores\.length > 1 && ps\.current_price === bestPriceValue;/);
  });
});
