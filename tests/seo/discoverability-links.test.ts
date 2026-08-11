/**
 * TAWVEERI GLOBAL SHOPPING DISCOVERABILITY & AI COMMERCE mission (2026-08-11) — independent
 * mission, NOT the closed Saudi Shopper Language & Demand Discovery workstream (checkpoint #71).
 * Pins two severe, measured, live-confirmed defects found by a technical discoverability audit:
 *   1. Every category-page product card linked to a double-locale 404 compare URL
 *      (`/ar/ar/compare/...`, `/en/ar/compare/...`) in BOTH locales.
 *   2. The compare page's own declared canonical URL contained raw, un-percent-encoded `|`
 *      characters — invalid per RFC 3986, and never matched the actual fetched URL.
 */
import { normalizeCompareUrl } from "@/lib/catalog/getCategoryOverview";
import { buildAlternates } from "@/lib/seo/metadata";

describe("normalizeCompareUrl — category-page compare links must be locale-less", () => {
  it("strips a hardcoded /ar/ prefix from the DB-stored compare_url (the measured live defect)", () => {
    expect(normalizeCompareUrl("/ar/compare/samsung%7Cfront_load%7C25%7Cwasher", "irrelevant"))
      .toBe("/compare/samsung%7Cfront_load%7C25%7Cwasher");
  });

  it("strips a hardcoded /en/ prefix too (the same bug class, either locale)", () => {
    expect(normalizeCompareUrl("/en/compare/apple-iphone-16", "irrelevant")).toBe("/compare/apple-iphone-16");
  });

  it("a genuinely locale-less compare_url passes through unchanged (no double-stripping)", () => {
    expect(normalizeCompareUrl("/compare/apple-iphone-16", "irrelevant")).toBe("/compare/apple-iphone-16");
  });

  it("never mistakes a category/brand slug merely starting with 'ar' or 'en' for a locale segment", () => {
    // Guards against a naive `/^\/(ar|en)/` (no lookahead) that would corrupt an unrelated path —
    // this function requires the locale token to be followed by a real path separator.
    expect(normalizeCompareUrl("/artisan-brand/compare/x", "irrelevant")).toBe("/artisan-brand/compare/x");
  });

  it("falls back to a fresh locale-less URL built from the identity key when compare_url is null", () => {
    expect(normalizeCompareUrl(null, "apple|iphone|16|256gb")).toBe(`/compare/${encodeURIComponent("apple|iphone|16|256gb")}`);
  });

  it("the resulting URL, once a locale IS prepended by the caller, never double-prepends", () => {
    const url = normalizeCompareUrl("/ar/compare/samsung%7Cwasher", "irrelevant");
    for (const locale of ["ar", "en"]) {
      const href = `/${locale}${url}`;
      expect(href).toBe(`/${locale}/compare/samsung%7Cwasher`);
      expect(href).not.toContain(`/${locale}/ar/`);
    }
  });
});

describe("buildAlternates — compare-page canonical must be a valid, exact URL (RFC 3986)", () => {
  it("a raw, decoded key (containing literal | characters) must be percent-encoded before use", () => {
    const key = "samsung|front_load|25|washer";
    const alternates = buildAlternates(`/compare/${encodeURIComponent(key)}`, "ar");
    expect(alternates.canonical).not.toContain("|");
    expect(alternates.canonical).toContain("%7C");
    expect(alternates.canonical).toBe("https://tawveeri.com/ar/compare/samsung%7Cfront_load%7C25%7Cwasher");
  });

  it("the declared canonical exactly matches the URL a crawler would actually fetch", () => {
    const key = "lg|split|NO_SERIES|18000|Inverter|cool_only";
    const encoded = encodeURIComponent(key);
    const alternates = buildAlternates(`/compare/${encoded}`, "en");
    // The URL a browser/crawler requests always carries percent-encoding for reserved chars —
    // the canonical must be byte-for-byte identical to that, not the human-readable decoded form.
    expect(alternates.canonical.endsWith(`/compare/${encoded}`)).toBe(true);
  });

  it("emits an x-default hreflang alongside ar/en, pointing at the Arabic default locale", () => {
    const alternates = buildAlternates("/categories/air-conditioners", "en");
    expect(alternates.languages["x-default"]).toBe("https://tawveeri.com/ar/categories/air-conditioners");
    expect(alternates.languages.ar).toBe("https://tawveeri.com/ar/categories/air-conditioners");
    expect(alternates.languages.en).toBe("https://tawveeri.com/en/categories/air-conditioners");
  });
});
