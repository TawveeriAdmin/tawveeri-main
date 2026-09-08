// ADR-317 — evidence instrumentation only. Pins extractModelMpnEvidence()'s field separation
// (model_number vs mpn vs asin vs upc, never collapsed) and its non-aggressive normalization
// (hyphens/slashes/suffixes preserved verbatim).
import { extractModelMpnEvidence } from "../../scripts/tps-plugins/ac/model-mpn-evidence";

describe("extractModelMpnEvidence", () => {
  it("extracts a labeled 'Item model number' as model_number, not mpn", () => {
    const specs = { "Item model number\n ‎\n : ‎": "‎ FWAC-H18CF" };
    const r = extractModelMpnEvidence(specs);
    expect(r.model_number?.normalized_value).toBe("FWAC-H18CF");
    expect(r.mpn).toBeNull();
  });

  it("extracts a labeled 'Manufacturer Reference' as mpn, kept distinct from model_number", () => {
    const specs = { "Manufacturer reference\n ‎": "SVPOR16" };
    const r = extractModelMpnEvidence(specs);
    expect(r.mpn?.normalized_value).toBe("SVPOR16");
    expect(r.model_number).toBeNull();
  });

  it("preserves hyphens, slashes, and suffix tokens verbatim — no aggressive normalization", () => {
    const specs = { "Item model number": "DW18E6AA3XTS00" };
    const r = extractModelMpnEvidence(specs);
    expect(r.model_number?.normalized_value).toBe("DW18E6AA3XTS00");
    const specs2 = { "Item model number": "AR24DSFZAWK/MG" };
    const r2 = extractModelMpnEvidence(specs2);
    expect(r2.model_number?.normalized_value).toBe("AR24DSFZAWK/MG");
  });

  it("extracts ASIN and UPC into their own distinct fields", () => {
    const specs = { ASIN: "B0CTFHYF2H", UPC: "756179351725" };
    const r = extractModelMpnEvidence(specs);
    expect(r.asin?.normalized_value).toBe("B0CTFHYF2H");
    expect(r.upc_or_gtin?.normalized_value).toBe("756179351725");
  });

  it("never populates system/indoor/outdoor model — honest absence, not a guess", () => {
    const specs = { "Item model number": "X-100" };
    const r = extractModelMpnEvidence(specs);
    expect(r.system_model).toBeNull();
    expect(r.indoor_model).toBeNull();
    expect(r.outdoor_model).toBeNull();
  });

  it("handles null/empty specifications without throwing", () => {
    expect(extractModelMpnEvidence(null).model_number).toBeNull();
    expect(extractModelMpnEvidence({}).model_number).toBeNull();
  });

  it("does not extract from unrelated keys (e.g. 'Special features', 'Colour')", () => {
    const specs = { "Special features": "Turbo Cooling", "Colour": "White" };
    const r = extractModelMpnEvidence(specs);
    expect(r.model_number).toBeNull();
    expect(r.mpn).toBeNull();
  });
});
