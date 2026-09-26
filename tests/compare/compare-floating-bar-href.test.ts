// tests/compare/compare-floating-bar-href.test.ts — ADR-386.
// The compare tray linked every thumbnail to /products/<slug>; a TPS canonical has no such
// page (its page IS the compare page) and a search card's title-derived slug matched no row.
import { resolveCompareItemHref } from "../../src/components/compare/compare-floating-bar";

describe("resolveCompareItemHref", () => {
  const fallback = "/ar/compare";

  it("a TPS canonical with a compare URL goes to its compare page, re-homed to the current locale", () => {
    expect(resolveCompareItemHref("en", { slug: "lg-split-freshdv-18000-inverter-cool_only", tps_compare_url: "/ar/compare/lg%7Csplit%7CFreshDV" }, fallback))
      .toBe("/en/compare/lg%7Csplit%7CFreshDV");
  });

  it("a single-store TPS canonical (no compare URL) still resolves via its identity key, never /products/<identity slug>", () => {
    expect(resolveCompareItemHref("ar", { slug: "samsung-split-18000-standard-no_mode", tps_identity_key: "samsung|split|NO_SERIES|18000|Standard|NO_MODE" }, fallback))
      .toBe("/ar/compare/samsung%7Csplit%7CNO_SERIES%7C18000%7CStandard%7CNO_MODE");
  });

  it("a storefront product uses its routable slug", () => {
    expect(resolveCompareItemHref("ar", { slug: "samsung-split-ac-18000-bturotary-compressorheat-and-cold" }, fallback))
      .toBe("/ar/products/samsung-split-ac-18000-bturotary-compressorheat-and-cold");
  });

  it("with nothing routable it falls back to the multi-compare page", () => {
    expect(resolveCompareItemHref("ar", {}, fallback)).toBe(fallback);
  });
});
