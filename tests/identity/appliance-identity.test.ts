// tests/identity/appliance-identity.test.ts
// ADR-076 regression gate. A capacity-less appliance key (brand|type|NA) must be
// low_confidence, not valid — otherwise every model of a type merges into one
// false comparison. Measured: all Xiaomi robot vacuums merged (165 → 849 SAR).
import { APPLIANCE_BUNDLES } from "../../scripts/tps-plugins/appliance";

const vacuum = APPLIANCE_BUNDLES["vacuum"].plugin;

describe("appliance identity — capacity is required to corroborate", () => {
  it("a robot vacuum WITHOUT capacity is low_confidence (catalogue-only, never merges)", () => {
    const r = vacuum.buildIdentityKey("Xiaomi", { brand: "xiaomi", type: "robot", capacity: null });
    expect(r.key).toBe("xiaomi|robot|NA");
    expect(r.status).toBe("low_confidence_candidate");
  });

  it("an appliance WITH capacity stays valid (corroboration-eligible)", () => {
    const r = vacuum.buildIdentityKey("Xiaomi", { brand: "xiaomi", type: "robot", capacity: 550 });
    expect(r.key).toBe("xiaomi|robot|550");
    expect(r.status).toBe("valid");
  });

  it("no brand is invalid", () => {
    expect(vacuum.buildIdentityKey(null, { brand: null, type: "robot", capacity: 550 }).status).toBe("invalid");
  });

  it("no discriminator at all is invalid", () => {
    expect(vacuum.buildIdentityKey("Xiaomi", { brand: "xiaomi", type: null, capacity: null }).status).toBe("invalid");
  });
});

// ── ADR-254: cooker/oven partition — every fixture is a REAL production raw name ──
const cooker = APPLIANCE_BUNDLES["cooker"].plugin;
const oven = APPLIANCE_BUNDLES["oven"].plugin;

describe("cooker registration (ADR-254) — the Saudi freestanding gas cooker", () => {
  it("detects the canonical Saudi cooker name shape («فرن غاز 60*90، 5 عين، أمان كامل»)", () => {
    expect(cooker.detect("ميديا فرن غاز 60*90سم، 5 عين غاز، شبك ثقيل، مروحة داخلية، استيل - 36LMG5G02", "")).toBe(true);
    expect(cooker.detect("فرن غاز ستاروي 60 * 90 سم 5 عيون ستيل منصب ثقيل مع مروحة تبريد", "")).toBe(true);
    expect(cooker.detect("", "Midea Gas Cooker 5 Burners Silver 36LMG5G022")).toBe(true);
    expect(cooker.detect("بوتاجاز غاز 4 شعلات", "")).toBe(true);
  });
  it("REJECTS built-in phrasing — that is the oven category («إلبا فرن غاز بلت ان 90 سم»)", () => {
    expect(cooker.detect("إلبا فرن غاز بلت ان 90 سم، اشعال ذاتي، مروحة تبريد، شواية، ستيل - 51X-109", "")).toBe(false);
    expect(cooker.detect("اريستون فرن مدمج 60 سم", "")).toBe(false);
  });
  it("rejects hobs, hoods, heaters, camping stoves", () => {
    expect(cooker.detect("موقد سطحي غاز 60 سم", "")).toBe(false);
    expect(cooker.detect("شفاط مطبخ 90 سم", "")).toBe(false);
    expect(cooker.detect("طباخ رحلات محمول", "")).toBe(false);
  });
  it("dimensions are order-independent: 60*90 and 90*60 key identically (larger dim)", () => {
    const a = cooker.normalize("فرن غاز ويل غاز، 90*60 سم، 5 شعلات، 116 لتر، استيل", "", "ويل غاز");
    const b = cooker.normalize("ميديا فرن غاز 60*90سم، 5 عين غاز، استيل", "", "ميديا");
    expect(a.payload.capacity).toBe(90);
    expect(b.payload.capacity).toBe(90);
    expect(a.payload.type).toBe("burners_5");
    expect(b.payload.type).toBe("burners_5");
  });
  it("dual-fuel (4 غاز + 2 كهرباء) is its own identity type, not a 4-burner", () => {
    const r = cooker.normalize("فرن غاز ويل غاز، 90 * 60 سم، 4 شعلة غاز + 2 شعلة كهرباء، 116 لتر", "", "ويل غاز");
    expect(r.payload.type).toBe("mixed_fuel");
  });
  it("«أمان كامل» (the market's own differentiator) is captured as a feature flag", () => {
    const r = cooker.normalize("لاجيرمانيا فرن غاز 60*90 سم، 5 عين، مروحة، امان كامل، شواية، استيل - C95C8", "", "لاجيرمانيا");
    expect(r.payload.full_safety).toBe(true);
    expect(r.payload.fan).toBe(true);
    expect(r.payload.grill).toBe(true);
  });
  it("identity key: brand|burner-config|larger-dim, valid only with the dimension", () => {
    const p = cooker.normalize("فرن غاز ستار واي 90*60 سم 5 عيون ستيل", "", "starway");
    const k = cooker.buildIdentityKey("starway", p.payload);
    expect(k.key).toMatch(/\|burners_5\|90$/);
    expect(k.status).toBe("valid");
  });
  it("customer names render honestly (no 'built-in' wording, no raw type labels)", () => {
    const { nameAr, nameEn } = APPLIANCE_BUNDLES["cooker"].names("starway|burners_5|90");
    expect(nameAr).toBe("طباخ غاز starway 5 شعلات 90 سم");
    expect(nameEn).toBe("starway gas cooker 5-burner 90 cm");
    expect(nameAr).not.toMatch(/بلت|burners_/);
  });
});

describe("oven v2 (ADR-254) — built-in ONLY, cookers no longer mislabeled", () => {
  it("still detects genuine built-ins (AR and EN)", () => {
    expect(oven.detect("بوش فرن بلت إن 60 سم", "")).toBe(true);
    expect(oven.detect("اريستون فرن مدمج 60 سم", "")).toBe(true);
    expect(oven.detect("", "Bosch Built-in Oven 60 cm HBG776NB1M")).toBe(true);
    expect(oven.detect("إلبا فرن غاز بلت ان 90 سم", "")).toBe(true); // built-in GAS oven stays oven
  });
  it("NO LONGER claims freestanding cookers («فرن غاز 60*90») or bare electric ovens", () => {
    expect(oven.detect("فرن غاز ستاروي 60 * 90 سم 5 عيون ستيل", "")).toBe(false);
    expect(oven.detect("ميديا فرن غاز 60*90سم، 5 عين غاز", "")).toBe(false);
    expect(oven.detect("بوتاجاز غاز 4 شعلات", "")).toBe(false);
    expect(oven.detect("فرن كهربائي 60 سم", "")).toBe(false); // ambiguous → honestly undetected
  });
});
