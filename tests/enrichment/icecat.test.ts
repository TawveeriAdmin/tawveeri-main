// tests/enrichment/icecat.test.ts
import {
  normalizeGtin,
  isValidGtin,
  gtinKey,
  parseIcecatResponse,
  resolveGtin,
  __clearIcecatMemo,
} from "@/lib/enrichment/icecat";

// Real, GS1-checksum-valid identifiers used across the suite:
//   4006381333931 — valid EAN-13
//   036000291452  — valid UPC-A (12); its EAN-13 form is 0036000291452
const EAN13 = "4006381333931";
const UPCA = "036000291452";
const UPCA_AS_EAN13 = "0036000291452";

describe("isValidGtin (GS1 checksum)", () => {
  it("accepts valid EAN-13 / UPC-A", () => {
    expect(isValidGtin(EAN13)).toBe(true);
    expect(isValidGtin(UPCA)).toBe(true);
    expect(isValidGtin(UPCA_AS_EAN13)).toBe(true);
  });

  it("normalizes spaces/hyphens before validating", () => {
    expect(isValidGtin(" 4006381-333931 ")).toBe(true);
    expect(isValidGtin(4006381333931)).toBe(true);
  });

  it("rejects wrong check digits", () => {
    expect(isValidGtin("4006381333930")).toBe(false);
    expect(isValidGtin("4006381333932")).toBe(false);
  });

  it("rejects wrong lengths and junk", () => {
    expect(isValidGtin("123")).toBe(false);
    expect(isValidGtin("SSBX525-B5")).toBe(false); // a merchant SKU, not a GTIN
    expect(isValidGtin("")).toBe(false);
    expect(isValidGtin(null)).toBe(false);
    expect(isValidGtin(undefined)).toBe(false);
  });

  it("rejects all-zeros placeholders", () => {
    expect(isValidGtin("0000000000000")).toBe(false);
  });
});

describe("gtinKey (canonical GTIN-14)", () => {
  it("pads valid GTINs to 14 digits", () => {
    expect(gtinKey(EAN13)).toBe("04006381333931");
    expect(gtinKey(UPCA)).toBe("00036000291452");
  });

  it("collapses UPC-A and its EAN-13 leading-zero form to ONE key", () => {
    expect(gtinKey(UPCA)).toBe(gtinKey(UPCA_AS_EAN13));
  });

  it("returns null for invalid GTINs (never guesses)", () => {
    expect(gtinKey("123")).toBeNull();
    expect(gtinKey("4006381333930")).toBeNull();
  });
});

describe("parseIcecatResponse", () => {
  const okBody = {
    msg: "OK",
    data: {
      GeneralInfo: {
        Brand: "Apple",
        ProductCode: "MTP03",
        Title: "Apple iPhone 15 128GB",
        Category: { Name: { Value: "Smartphones" } },
        IcecatId: "12345",
      },
      Image: { HighPic: "https://images.icecat.biz/x.jpg" },
    },
  };

  it("parses an OK record into cited fields", () => {
    const p = parseIcecatResponse(okBody, EAN13);
    expect(p).toEqual({
      gtin: EAN13,
      brand: "Apple",
      mpn: "MTP03",
      title: "Apple iPhone 15 128GB",
      category: "Smartphones",
      imageUrl: "https://images.icecat.biz/x.jpg",
      icecatId: "12345",
      source: "icecat_open",
    });
  });

  it("returns null on a non-OK message (not found / access denied)", () => {
    expect(parseIcecatResponse({ msg: "GTIN not found", data: {} }, EAN13)).toBeNull();
  });

  it("returns null when GeneralInfo is absent", () => {
    expect(parseIcecatResponse({ msg: "OK", data: {} }, EAN13)).toBeNull();
  });

  it("returns null when both brand and title are missing (no citable identity)", () => {
    expect(parseIcecatResponse({ msg: "OK", data: { GeneralInfo: { ProductCode: "X" } } }, EAN13)).toBeNull();
  });

  it("never throws on malformed bodies", () => {
    expect(parseIcecatResponse(null, EAN13)).toBeNull();
    expect(parseIcecatResponse("garbage", EAN13)).toBeNull();
    expect(parseIcecatResponse(42, EAN13)).toBeNull();
  });
});

describe("resolveGtin", () => {
  const okBody = {
    msg: "OK",
    data: { GeneralInfo: { Brand: "Samsung", Title: "Galaxy S25" }, Image: {} },
  };
  const okFetch = (): Promise<Response> =>
    Promise.resolve({ ok: true, json: async () => okBody } as unknown as Response);

  beforeEach(() => __clearIcecatMemo());

  it("is dormant (null) when no username is configured", async () => {
    const saved = process.env.ICECAT_USERNAME;
    delete process.env.ICECAT_USERNAME;
    expect(await resolveGtin(EAN13, { fetchImpl: okFetch as typeof fetch })).toBeNull();
    if (saved !== undefined) process.env.ICECAT_USERNAME = saved;
  });

  it("returns null for an invalid GTIN without hitting the network", async () => {
    const spy = jest.fn(okFetch);
    expect(await resolveGtin("123", { username: "u", fetchImpl: spy as unknown as typeof fetch })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("resolves a valid GTIN via the injected fetch", async () => {
    const p = await resolveGtin(EAN13, { username: "u", fetchImpl: okFetch as typeof fetch });
    expect(p?.brand).toBe("Samsung");
    expect(p?.title).toBe("Galaxy S25");
    expect(p?.source).toBe("icecat_open");
  });

  it("returns null on network failure (never throws, never fabricates)", async () => {
    const boom = () => Promise.reject(new Error("network"));
    expect(await resolveGtin(EAN13, { username: "u", fetchImpl: boom as unknown as typeof fetch })).toBeNull();
  });

  it("memoizes — a repeated GTIN hits the network once", async () => {
    const spy = jest.fn(okFetch);
    await resolveGtin(EAN13, { username: "u", fetchImpl: spy as unknown as typeof fetch });
    await resolveGtin(EAN13, { username: "u", fetchImpl: spy as unknown as typeof fetch });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("normalizeGtin", () => {
  it("strips non-digits", () => {
    expect(normalizeGtin(" 400-638 1333931 ")).toBe("4006381333931");
    expect(normalizeGtin(null)).toBe("");
  });
});
