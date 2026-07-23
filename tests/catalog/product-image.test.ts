// tests/catalog/product-image.test.ts
// ADR-063 regression gate. Every fixture is a real production payload value
// observed on 2026-07-23, when 0 of 1,215 products had an image despite 100%
// of observations carrying one.
import { pickProductImage, isUsableImageUrl } from "@/lib/catalog/product-image";

const JARIR = '["https://ak-asset.jarir.com/akeneo-prod/asset/1/e/2/c/1e2c3b09_588602.jpg"]';
const AMAZON = '["https://m.media-amazon.com/images/I/71nwL4QQOeS._AC_UL320_.jpg"]';
const EXTRA = '["https://media.extra.com/s/aurora/100332926_800/Kyvol-Kit?locale=en"]';
const ALMANEA = "https://imgs.dev-almanea.com/media/catalog/product/cache/3f5e/s/m/sm-f956bdbdmea.jpg";
const SWSG_PLACEHOLDER = '["https://swsg.co/data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP6zwAAAgcBAp"]';

describe("parsing the shapes stores actually publish", () => {
  it("reads a JSON-array string (jarir, amazon, extra)", () => {
    expect(pickProductImage([{ raw: JARIR }])).toContain("ak-asset.jarir.com");
    expect(pickProductImage([{ raw: AMAZON }])).toContain("m.media-amazon.com");
    expect(pickProductImage([{ raw: EXTRA }])).toContain("media.extra.com");
  });

  it("reads a bare URL string (almanea)", () => {
    expect(pickProductImage([{ raw: ALMANEA }])).toBe(ALMANEA);
  });

  it("reads a real array as well as a stringified one", () => {
    expect(pickProductImage([{ raw: ["https://m.media-amazon.com/images/I/x.jpg"] }]))
      .toBe("https://m.media-amazon.com/images/I/x.jpg");
  });
});

describe("placeholders and junk are rejected — a fake image is worse than none", () => {
  it("rejects SWSG's base64 lazy-load placeholder", () => {
    expect(isUsableImageUrl("https://swsg.co/data:image/png;base64,iVBORw0KGgo")).toBe(false);
    expect(pickProductImage([{ raw: SWSG_PLACEHOLDER }])).toBeNull();
  });

  it.each([
    ["data:image/png;base64,iVBORw0KGgo", "raw data URI"],
    ["ftp://example.com/x.jpg", "non-http scheme"],
    ["/relative/path.jpg", "relative path"],
    ["https://unknown-cdn.example.com/x.jpg", "unverified host renders broken"],
    ["https://ak-asset.jarir.com", "bare host, no image path"],
    ["", "empty"],
  ])("rejects %s (%s)", (url) => {
    expect(isUsableImageUrl(url)).toBe(false);
  });

  it("returns null rather than a broken image when nothing is usable", () => {
    expect(pickProductImage([{ raw: SWSG_PLACEHOLDER }, { raw: null }, { raw: "" }])).toBeNull();
  });
});

describe("selection matches the headline offer", () => {
  it("prefers the cheapest offer's image, so picture and price agree", () => {
    const chosen = pickProductImage([
      { raw: JARIR, price: 3999 },
      { raw: AMAZON, price: 2549 },
    ]);
    expect(chosen).toContain("m.media-amazon.com");
  });

  it("falls through to the next store when the cheapest has only a placeholder", () => {
    const chosen = pickProductImage([
      { raw: SWSG_PLACEHOLDER, price: 2400 },
      { raw: JARIR, price: 3999 },
    ]);
    expect(chosen).toContain("ak-asset.jarir.com");
  });

  it("treats a priceless offer as lowest priority, not highest", () => {
    const chosen = pickProductImage([
      { raw: JARIR, price: null },
      { raw: AMAZON, price: 2549 },
    ]);
    expect(chosen).toContain("m.media-amazon.com");
  });

  it("never throws on malformed input", () => {
    expect(() => pickProductImage([{ raw: "[not json" }, { raw: 42 }, { raw: {} }])).not.toThrow();
  });
});
