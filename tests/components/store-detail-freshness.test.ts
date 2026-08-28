/**
 * QUALITY PROGRAM P1 §19.2 item 1 (2026-08-28): the store detail page's own product
 * listing query never selected `last_checked_at`/`last_seen_at` (columns that exist on
 * `product_stores`, scripts/database/01-schema.sql) even though these are exactly the
 * timestamps `selectBestPriceStore()`/`isFreshObservation()` need to gate this page's
 * "Best Price"/"Hot Deal" badges — the same storefront-layer gap §17.1 fixed on the main
 * search grid. Structural pin (not a full render test, given this component's heavy
 * data-fetching/auth/cart dependency surface) confirming the query now selects both
 * columns and the mapping threads one through as `observed_at`.
 */
import fs from "fs";
import path from "path";

const src = fs.readFileSync(
  path.join(process.cwd(), "src", "app", "[locale]", "(public)", "stores", "[slug]", "store-detail-client.tsx"),
  "utf8"
);

describe("store-detail-client.tsx — product-listing query now carries freshness data", () => {
  it("selects last_checked_at and last_seen_at from product_stores", () => {
    expect(src).toMatch(/last_checked_at,\s*\n\s*last_seen_at,/);
  });

  it("ProductStoreEntry declares both columns", () => {
    expect(src).toMatch(/last_checked_at: string \| null;/);
    expect(src).toMatch(/last_seen_at: string \| null;/);
  });

  it("the product_stores mapping computes observed_at from last_checked_at, falling back to last_seen_at", () => {
    expect(src).toMatch(/observed_at: record\.last_checked_at \?\? record\.last_seen_at \?\? null,/);
  });

  it("StoreProduct's product_stores entries declare observed_at (structurally compatible with ProductCardProduct)", () => {
    expect(src).toMatch(/observed_at\?: string \| null;/);
  });
});
