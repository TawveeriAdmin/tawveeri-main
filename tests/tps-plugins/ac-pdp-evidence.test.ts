// ADR-315 (TYPE_2 pilot) — pins extractPdpEvidence()'s positive extraction AND, critically,
// its false-positive guards (instruction #6 of the founder's authorization): a description
// mentioning an attribute must not automatically mean the product itself has it.
import { extractPdpEvidence } from "../../scripts/tps-plugins/ac/pdp-evidence";

describe("extractPdpEvidence — positive extraction, real-shape description text", () => {
  it("extracts hot_cold cooling mode stated in description", () => {
    const r = extractPdpEvidence(
      "18000 وحدة حرارية بارد وحار، مبرد R410A، مستوى الضجيج 56 ديسيبل",
      null
    );
    expect(r.cooling_mode?.value).toBe("hot_cold");
    expect(r.cooling_mode?.source_field).toBe("description");
  });

  it("extracts Inverter technology stated in feature-bullet-derived description", () => {
    const r = extractPdpEvidence(
      null,
      "Powerful cooling with Inverter compressor technology for energy savings and quiet operation."
    );
    expect(r.technology?.value).toBe("Inverter");
  });

  it("extracts cool_only when description says cooling only, Arabic", () => {
    const r = extractPdpEvidence("تبريد فقط، ضاغط دوار قوي", null);
    expect(r.cooling_mode?.value).toBe("cool_only");
  });

  it("returns nulls when description has no AC-relevant signal at all", () => {
    const r = extractPdpEvidence("Fast cooling, high-density filter, removable grille, sturdy build.", null);
    expect(r.technology).toBeNull();
    expect(r.cooling_mode).toBeNull();
  });

  it("never attempts capacity_btu extraction from description (deliberately out of scope this pilot)", () => {
    const r = extractPdpEvidence("18000 BTU cooling capacity, Inverter technology", null);
    expect(r.capacity_btu).toBeNull();
  });
});

describe("extractPdpEvidence — false-positive guards (instruction #6)", () => {
  it("REJECTS 'Inverter' when the sentence says compatible-with, not the product's own attribute", () => {
    const r = extractPdpEvidence(
      null,
      "This remote control is compatible with Inverter and non-Inverter split AC units from major brands."
    );
    expect(r.technology).toBeNull();
    expect(r.rejected_candidates.some((c) => c.attribute === "technology")).toBe(true);
  });

  it("REJECTS a cooling-mode mention inside a 'package includes' accessory list", () => {
    const r = extractPdpEvidence(
      null,
      "Package includes: 1x cool only wall bracket adapter, 1x remote, user manual."
    );
    expect(r.cooling_mode).toBeNull();
    expect(r.rejected_candidates.some((c) => c.attribute === "cooling_mode")).toBe(true);
  });

  it("REJECTS a technology mention flagged explicitly as an optional feature", () => {
    const r = extractPdpEvidence(
      null,
      "Inverter upgrade kit sold separately as an optional feature for select models."
    );
    expect(r.technology).toBeNull();
  });

  it("REJECTS an accessory-context mention (Arabic)", () => {
    const r = extractPdpEvidence(
      "إكسسوار حامل انفرتر متوافق مع معظم الموديلات",
      null
    );
    expect(r.technology).toBeNull();
  });

  it("REJECTS 'also available as' referencing a different model/variant", () => {
    const r = extractPdpEvidence(
      null,
      "This model is cool only. Also available as a hot and cold variant under a different SKU."
    );
    // cool_only is legitimately this product's own attribute (no disqualifier near it) —
    // hot_cold must NOT override it since "also available as" disqualifies that second match.
    expect(r.cooling_mode?.value).toBe("cool_only");
  });

  it("KNOWN LIMITATION, disclosed not hidden: over-rejects a genuine attribute when a disqualifying word appears under negation ('Not an accessory')", () => {
    const r = extractPdpEvidence(
      null,
      "Not an accessory — Inverter technology built directly into the unit for reliable performance."
    );
    // The proximity guard cannot parse negation, so "accessory" here triggers rejection even
    // though "Not an accessory" actually means the attribute DOES belong to the product. This
    // is the guard's safe failure direction (losing a valid signal, never accepting a false
    // one) and is pinned here explicitly so it's a documented, known trade-off, not a silent
    // gap discovered later.
    expect(r.technology).toBeNull();
    expect(r.rejected_candidates.some((c) => c.attribute === "technology")).toBe(true);
  });

  it("accepts a genuine, unhedged statement with no disqualifying phrase nearby", () => {
    const r = extractPdpEvidence(
      null,
      "Enjoy powerful, energy-efficient cooling with advanced Inverter compressor technology and a 2-year warranty."
    );
    expect(r.technology?.value).toBe("Inverter");
  });
});
