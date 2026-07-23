// tests/identity/merchant-listing-identity.test.ts
// Every URL below is a REAL production value observed on 2026-07-23. This suite
// is the regression gate for ADR-059 merchant listing identity contracts.
import {
  resolveListingIdentity, stableListingKey, canonicalListingUrl, isSaudiMarket,
} from "@/lib/identity/merchant-listing-identity";

describe("jarir — childSku is a VARIANT, path carries the market", () => {
  const parent = "https://www.jarir.com/sa-en/apple-ipad-a16-tablet-pc-jpm1424.html";

  it("keeps childSku variants distinct", () => {
    const a = stableListingKey(1, `${parent}?childSku=654165`, "jarir");
    const b = stableListingKey(1, `${parent}?childSku=999999`, "jarir");
    expect(a).not.toBe(b);
    expect(a).toBe("1::jarir:jpm1424|childSku=654165");
  });

  it("is immune to campaign noise around the variant", () => {
    expect(stableListingKey(1, `${parent}?utm_source=g&childSku=654165&gclid=x`, "jarir"))
      .toBe(stableListingKey(1, `${parent}?childSku=654165`, "jarir"));
  });

  it("reads the trailing numeric id when there is no jpm code", () => {
    const r = resolveListingIdentity(1, "https://www.jarir.com/sa-en/arabic-books-588602.html", "jarir");
    expect(r.productId).toBe("588602");
    expect(r.market).toBe("sa");
  });

  it("detects non-Saudi GCC markets (they are evidence, not Saudi catalog)", () => {
    const ae = resolveListingIdentity(1, "https://www.jarir.com/ae-en/honor-x5c-plus-smartphones-jpm1576.html?childSku=667296", "jarir");
    expect(ae.market).toBe("ae");
    expect(isSaudiMarket(ae.market)).toBe(false);
    expect(isSaudiMarket(resolveListingIdentity(1, "https://www.jarir.com/qa-ar/x-jpm1.html", "jarir").market)).toBe(false);
  });
});

describe("amazon — identity is the ASIN, every param is session state", () => {
  const a = "https://www.amazon.sa/-/en/Super-General-KSGA18NE1/dp/B0CVMTTDMM/ref=sr_1_1?dib=eyJ2IjoiMSJ9.AAA&dib_tag=se&keywords=%D9%85%D9%83%D9%8A%D9%81&qid=1784765305&sr=8-1";
  const b = "https://www.amazon.sa/-/en/Super-General-KSGA18NE1/dp/B0CVMTTDMM/ref=sr_1_9?dib=eyJ2IjoiMSJ9.ZZZ&qid=1784999999&sr=8-9&s=electronics";

  it("collapses search-session variants of the same ASIN", () => {
    expect(stableListingKey(2, a, "amazon")).toBe(stableListingKey(2, b, "amazon"));
    expect(stableListingKey(2, a, "amazon")).toBe("2::amazon:B0CVMTTDMM");
  });

  it("keeps different ASINs apart", () => {
    expect(stableListingKey(2, "https://www.amazon.sa/-/en/x/dp/B0H5D5CYBF/ref=sr_1_2", "amazon"))
      .not.toBe(stableListingKey(2, a, "amazon"));
  });

  it("marks amazon.sa as the Saudi market", () => {
    expect(resolveListingIdentity(2, a, "amazon").market).toBe("sa");
  });
});

describe("extra — key on the product code, not the drifting category path", () => {
  it("treats the same product code under different category paths as ONE listing", () => {
    // 5,040 codes vs 5,108 URL paths in production: the path drifts.
    const p1 = "https://www.extra.com/en-sa/small-appliances/home-environment-care/vacuum-cleaner/kyvol-kit/p/100332926";
    const p2 = "https://www.extra.com/en-sa/c/kyvol-kit-renamed/p/100332926";
    expect(stableListingKey(4, p1, "extra")).toBe(stableListingKey(4, p2, "extra"));
    expect(stableListingKey(4, p1, "extra")).toBe("4::extra:100332926");
  });

  it("handles alphanumeric marketplace codes", () => {
    const r = resolveListingIdentity(4, "https://www.extra.com/en-sa/c/xiaomi-brush/p/MP00047519", "extra");
    expect(r.productId).toBe("MP00047519");
    expect(r.market).toBe("sa"); // extra uses <lang>-<country>
  });
});

describe("almanea — host-independent, because production runs on a dev host", () => {
  it("survives a hostname migration without orphaning price history", () => {
    // 100% of 36,380 rows currently come from m.dev-almanea.com.
    const dev = "https://m.dev-almanea.com/samsung-z-fold6-256gb-12gb-5g-navy-p-170100501030110";
    const prod = "https://www.almanea.com/samsung-z-fold6-256gb-12gb-5g-navy-p-170100501030110";
    expect(stableListingKey(5, dev, "almanea")).toBe(stableListingKey(5, prod, "almanea"));
    expect(stableListingKey(5, dev, "almanea")).toBe("5::almanea:170100501030110");
  });

  it("keeps different Almanea products apart", () => {
    expect(stableListingKey(5, "https://m.dev-almanea.com/honor-x6c-p-170112701030052", "almanea"))
      .not.toBe(stableListingKey(5, "https://m.dev-almanea.com/oraimo-p-170130260999001", "almanea"));
  });
});

describe("noon and swsg", () => {
  it("noon keys on its product code", () => {
    const r = resolveListingIdentity(3, "https://www.noon.com/saudi-en/galaxy-a16-dual-sim-4g-black-4gb-ram-128gb/N70126887V/p/", "noon");
    expect(r.productId).toBe("N70126887V");
    expect(r.market).toBe("sa");
    expect(r.key).toBe("3::noon:N70126887V");
  });

  it("swsg keeps the capacity/colour slug — it IS the identity", () => {
    const black = stableListingKey(8, "https://swsg.co/ar/all-categories/moblie-accessories/smart-phones/iphone-17-256gb-black.html", "swsg");
    const white = stableListingKey(8, "https://swsg.co/ar/all-categories/moblie-accessories/smart-phones/iphone-17-256gb-white.html", "swsg");
    expect(black).toBe("8::swsg:iphone-17-256gb-black");
    expect(black).not.toBe(white);
  });
});

describe("safety and fallbacks", () => {
  it("falls back to a canonical URL for a merchant with no contract", () => {
    expect(stableListingKey(99, "https://new-store.sa/p/item?utm_source=x&color=red", "newstore"))
      .toBe("99::https://new-store.sa/p/item?color=red");
  });

  it("keeps unknown params for unknown merchants — we cannot know what carries identity", () => {
    expect(canonicalListingUrl("https://s.sa/p?variant=256gb&seller=abc")).toContain("variant=256gb");
    expect(canonicalListingUrl("https://s.sa/p?variant=256gb&seller=abc")).toContain("seller=abc");
  });

  it("falls back to the URL when a contracted merchant's URL has no readable id", () => {
    const k = stableListingKey(4, "https://www.extra.com/en-sa/some/landing/page", "extra");
    expect(k).toBe("4::https://www.extra.com/en-sa/some/landing/page");
  });

  it("returns null rather than inventing identity when there is no URL", () => {
    expect(stableListingKey(1, null, "jarir")).toBeNull();
    expect(stableListingKey(1, "   ", "jarir")).toBeNull();
  });

  it("treats an unknown market as in-scope so no catalog is silently deleted", () => {
    expect(isSaudiMarket(null)).toBe(true);
    expect(isSaudiMarket("sa")).toBe(true);
    expect(isSaudiMarket("ae")).toBe(false);
  });

  it("never throws on a malformed URL", () => {
    expect(() => resolveListingIdentity(1, "not a url", "jarir")).not.toThrow();
  });
});
