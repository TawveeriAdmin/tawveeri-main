// tests/scraping/jarir-gtin.test.ts
import { extractGtinFromHtml } from "@/lib/scraping/stores/jarir-scraper";

describe("extractGtinFromHtml (Jarir product page)", () => {
  it("extracts a valid gtin13 from JSON-LD", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"X","gtin13":"5099206062856"}</script>`;
    expect(extractGtinFromHtml(html)).toBe("5099206062856");
  });

  it("extracts a valid ean field", () => {
    expect(extractGtinFromHtml(`{"ean":"745883793044"}`)).toBe("745883793044");
  });

  it("ignores a checksum-INVALID gtin (never fabricates identity)", () => {
    expect(extractGtinFromHtml(`{"gtin13":"5099206062850"}`)).toBeNull();
  });

  it("returns null when no GTIN is present", () => {
    expect(extractGtinFromHtml(`<html><body>no barcode here</body></html>`)).toBeNull();
  });
});
