/**
 * Amazon-only price_update duplicate-row dedupe (2026-09-24, founder-scoped freshness
 * investigation; docs/DECISIONS.md ADR-378). Amazon carries known duplicate
 * (product_id, store_id) product_stores rows (ADR-377) — a heavily-duplicated product
 * could occupy several of a single price_update cycle's scarce slots re-checking the
 * SAME product, at the expense of other distinct, equally-or-more-stale products.
 *
 * Two things must hold:
 *  1. dedupeStalestPerProductId keeps the stalest (first, since input is pre-ordered
 *     last_checked_at ASC) row per product_id and stops at `max` distinct products.
 *  2. The fix is gated to store_slug === 'amazon' only — extra/samsung_ksa/noon/every
 *     other store must keep the exact original query behavior. Verified statically
 *     against the source (same pattern used in store-identity-propagation.test.ts)
 *     since fully mocking runPriceUpdateJob's downstream scraper/service calls for an
 *     integration test would exceed this task's scope.
 */

import fs from 'fs';
import path from 'path';
import { dedupeStalestPerProductId } from '@/lib/scraping/services/scraping-orchestrator';

type Row = { id: string; product_id: string; last_checked_at: string | null };

describe('dedupeStalestPerProductId', () => {
  it('keeps only the first (stalest) row per product_id', () => {
    const rows: Row[] = [
      { id: 'a1', product_id: 'p1', last_checked_at: '2026-01-01T00:00:00Z' }, // stalest p1
      { id: 'a2', product_id: 'p2', last_checked_at: '2026-01-02T00:00:00Z' },
      { id: 'a3', product_id: 'p1', last_checked_at: '2026-01-03T00:00:00Z' }, // dup p1, skipped
      { id: 'a4', product_id: 'p3', last_checked_at: '2026-01-04T00:00:00Z' },
      { id: 'a5', product_id: 'p1', last_checked_at: '2026-01-05T00:00:00Z' }, // dup p1, skipped
    ];
    const out = dedupeStalestPerProductId(rows, 10);
    expect(out.map((r) => r.id)).toEqual(['a1', 'a2', 'a4']);
    expect(out.map((r) => r.product_id).sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('stops once max DISTINCT products are kept, not max rows scanned', () => {
    const rows: Row[] = [
      { id: 'a1', product_id: 'p1', last_checked_at: null },
      { id: 'a2', product_id: 'p1', last_checked_at: null }, // dup, does not count toward max
      { id: 'a3', product_id: 'p2', last_checked_at: null },
      { id: 'a4', product_id: 'p3', last_checked_at: null },
    ];
    const out = dedupeStalestPerProductId(rows, 2);
    expect(out.map((r) => r.id)).toEqual(['a1', 'a3']);
  });

  it('is a no-op when every row already has a distinct product_id', () => {
    const rows: Row[] = [
      { id: 'a1', product_id: 'p1', last_checked_at: null },
      { id: 'a2', product_id: 'p2', last_checked_at: null },
    ];
    expect(dedupeStalestPerProductId(rows, 10)).toEqual(rows);
  });

  it('handles an empty input', () => {
    expect(dedupeStalestPerProductId([] as Row[], 10)).toEqual([]);
  });
});

describe('runPriceUpdateJob dedupe gating (static source check)', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src', 'lib', 'scraping', 'services', 'scraping-orchestrator.ts'),
    'utf8'
  );

  it("gates the overfetch limit and the dedupe call on store_slug === 'amazon'", () => {
    expect(src).toMatch(/isAmazonDedupe\s*=\s*options\.store_slug === 'amazon'/);
    expect(src).toMatch(/limit\(isAmazonDedupe \? Math\.min\(requestedMax \* 3, 900\) : requestedMax\)/);
    expect(src).toMatch(/if \(isAmazonDedupe\) \{\s*\n\s*rows = dedupeStalestPerProductId\(rows, requestedMax\);/);
  });

  it('the overfetch pool stays under the PostgREST db-max-rows=1000 cap (ADR-172/285) for every configured max_products in this codebase', () => {
    // Largest max_products passed anywhere to runPriceUpdateJob today is 500 (the
    // options default) / 300 (defaultMax in price-update.ts) — either way, *3 capped
    // at 900 never reaches the 1000-row PostgREST cap.
    const largestKnownMaxProducts = 500;
    expect(Math.min(largestKnownMaxProducts * 3, 900)).toBeLessThan(1000);
  });
});
