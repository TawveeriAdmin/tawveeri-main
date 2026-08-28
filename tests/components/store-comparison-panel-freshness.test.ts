/**
 * QUALITY PROGRAM P1 §17.4 item 1 (2026-08-28): `StoreComparisonPanel` used to
 * independently re-derive its "Best Price" badge from a raw price sort — the exact
 * companion gap §17.1 already fixed on `product-card.tsx` itself, just not here (a
 * shopper could open the "compare stores" panel and see a DIFFERENT store crowned best
 * than the card that opened it). Fixed by reusing the same, already-tested
 * `selectBestPriceStore()` — this is a structural pin (not a full render test, given the
 * component's heavy UI dependency surface) confirming the two surfaces can never diverge
 * again silently.
 */
import fs from "fs";
import path from "path";

const panelSrc = fs.readFileSync(
  path.join(process.cwd(), "src", "components", "search", "store-comparison-panel.tsx"),
  "utf8"
);

describe("StoreComparisonPanel — reuses the shared freshness-aware price selection", () => {
  it("imports selectBestPriceStore from product-card.tsx", () => {
    expect(panelSrc).toMatch(/import \{ selectBestPriceStore \} from '@\/components\/products\/product-card';/);
  });

  it("bestPriceValue is derived from selectBestPriceStore's result, not a raw price sort", () => {
    expect(panelSrc).toMatch(/const \{ bestPrice \} = selectBestPriceStore\(product\.product_stores\);/);
    expect(panelSrc).toMatch(/const bestPriceValue = bestPrice\?\.current_price/);
  });
});
