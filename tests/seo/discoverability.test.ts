/**
 * SAUDI SHOPPER LANGUAGE & DEMAND DISCOVERY mission (2026-08-11), search/AI-discovery phase.
 * Pins the structured-data and category buying-guide additions found via a repo audit
 * (buildWebSiteJsonLd defined but never rendered; no Organization/FAQPage schema anywhere;
 * category pages purely transactional with zero educational content).
 */
import { buildWebSiteJsonLd, buildOrganizationJsonLd } from "@/lib/seo/json-ld";
import { getCategoryGuide } from "@/lib/seo/category-guide";

describe("buildWebSiteJsonLd / buildOrganizationJsonLd — site-entity identity", () => {
  it("WebSite carries a SearchAction pointing at /search for both locales", () => {
    for (const locale of ["ar", "en"]) {
      const ld = buildWebSiteJsonLd(locale);
      expect(ld["@type"]).toBe("WebSite");
      expect(ld.potentialAction["@type"]).toBe("SearchAction");
      expect(ld.potentialAction.target.urlTemplate).toContain(`/${locale}/search?q=`);
    }
  });

  it("Organization never fabricates a CR/VAT/address field it does not have", () => {
    const ld = buildOrganizationJsonLd("ar");
    expect(ld["@type"]).toBe("Organization");
    expect(ld).not.toHaveProperty("taxID");
    expect(ld).not.toHaveProperty("vatID");
    expect(ld).not.toHaveProperty("address");
    expect(ld).not.toHaveProperty("telephone");
    expect(ld.areaServed).toEqual({ "@type": "Country", name: "Saudi Arabia" });
  });
});

describe("getCategoryGuide — buying-guide content, grounded not fabricated", () => {
  it("every navigable category the mission was asked to cover has bespoke content, not only the universal fallback", () => {
    for (const key of ["air_conditioner", "mobile", "laptop", "tablet", "tv", "refrigerator", "washing_machine", "dishwasher"]) {
      const ar = getCategoryGuide(key, "ar");
      const en = getCategoryGuide(key, "en");
      // universal fallback alone is 2 items — a category with bespoke content has more.
      expect(ar.length).toBeGreaterThan(2);
      expect(en.length).toBeGreaterThan(2);
    }
  });

  it("a category with no bespoke entry still gets the universal, truthful Q&As (never empty, never fabricated)", () => {
    const guide = getCategoryGuide("some_future_category_not_yet_authored", "ar");
    expect(guide.length).toBe(2);
    expect(guide[0].q).toContain("السعر");
  });

  it("Arabic and English guides return the same NUMBER of points per category (parity)", () => {
    for (const key of ["air_conditioner", "mobile", "laptop", "refrigerator"]) {
      expect(getCategoryGuide(key, "ar").length).toBe(getCategoryGuide(key, "en").length);
    }
  });

  it("no guide entry is empty text (a Q with no real A would be worse than not showing it)", () => {
    for (const key of ["air_conditioner", "mobile", "laptop", "tablet", "tv", "refrigerator", "washing_machine", "dishwasher", "monitor", "audio", "smartwatch"]) {
      for (const locale of ["ar", "en"]) {
        for (const item of getCategoryGuide(key, locale)) {
          expect(item.q.length).toBeGreaterThan(5);
          expect(item.a.length).toBeGreaterThan(20);
        }
      }
    }
  });
});
