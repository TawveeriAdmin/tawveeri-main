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

/**
 * P6 (2026-08-21) — the appliance factory previously hardcoded `model_number: null`
 * always, so every appliance canonical was identified by brand|type|capacity, never
 * a real manufacturer model number, even when the retailer's own structured payload
 * field carried one. Survey evidence (11 categories, 400-observation samples each,
 * payload-field-only extraction) found this safe and valuable across every category
 * tested (zero false-positive model collisions). Deliberately PAYLOAD-ONLY — the
 * title name-rescue path was measured producing false positives on appliance-specific
 * spec phrasing (a toaster titled "...Stainless Steel-1050W-..." extracted that
 * fragment over the real "ET244-B5" in the same title) and is NOT wired in here.
 */
describe("appliance identity — real model_number as PRIMARY tier (P6)", () => {
  const coffeeMaker = APPLIANCE_BUNDLES["coffee_maker"].plugin;
  const toaster = APPLIANCE_BUNDLES["toaster"].plugin;
  const dishwasher = APPLIANCE_BUNDLES["dishwasher"].plugin;

  it("a genuine payload model number becomes the PRIMARY identity (vacuum)", () => {
    const norm = vacuum.normalize("", "Hitachi Duck Vacuum Cleaner 5L 1800W Silver, CV-W1800SI", "Hitachi", { model: "CV-W1800SI", brand: "Hitachi" });
    expect(norm.model_number).toBe("CV-W1800SI");
    const id = vacuum.buildIdentityKey("Hitachi", norm.payload, { model_number: norm.model_number });
    expect(id.key).toBe("hitachi|MODEL:CV-W1800SI");
    expect(id.status).toBe("valid");
  });

  it("real DeLonghi coffee-maker MPN (dot-segmented form)", () => {
    const norm = coffeeMaker.normalize("", "DeLonghi Coffee Maker, 1.8L, 15Bar, Titanium, DLECAM380.95.TB", "DeLonghi", { model: "DLECAM380.95.TB", brand: "DeLonghi" });
    expect(norm.model_number).toBe("DLECAM380.95.TB");
  });

  it("real Toshiba dishwasher MPN from the payload field", () => {
    const norm = dishwasher.normalize("", "توشيبا غسالة صحون 14 مكان 8 برامج ستانلس ستيل", "Toshiba", { model: "DW-14F7ME", brand: "Toshiba" });
    expect(norm.model_number).toBe("DW-14F7ME");
  });

  it("zero churn: no payload model number falls through to brand|type|capacity unchanged", () => {
    const norm = vacuum.normalize("", "Xiaomi Robot Vacuum Cleaner, 550ml", "Xiaomi", { brand: "Xiaomi" });
    expect(norm.model_number).toBeNull();
    const id = vacuum.buildIdentityKey("Xiaomi", norm.payload, { model_number: norm.model_number });
    expect(id.key).toBe("xiaomi|robot|NA");
    expect(id.status).toBe("low_confidence_candidate");
  });

  it("does NOT use the title name-rescue path — a spec fragment never becomes the model", () => {
    // No `model`/`modelNumber` payload field at all — model_number must stay null,
    // never fall back to scanning the title for a shape-passing token.
    const norm = toaster.normalize("", "BLACK+DECKER Toaster- Stainless Steel-1050W- Silver – ET244-B5", "BLACK+DECKER", {});
    expect(norm.model_number).toBeNull();
  });

  it("confidence is boosted when a real model number is present", () => {
    const withModel = coffeeMaker.scoreConfidence("delonghi", { brand: "delonghi", type: null, capacity: null }, "DLECAM380.95.TB", []);
    const withoutModel = coffeeMaker.scoreConfidence("delonghi", { brand: "delonghi", type: null, capacity: null }, null, []);
    expect(withModel.confidence).toBeGreaterThan(withoutModel.confidence);
  });

  it("names() renders a MODEL:-keyed appliance as 'Brand Model Noun'", () => {
    expect(vacuum.buildIdentityKey).toBeDefined();
    expect(APPLIANCE_BUNDLES["vacuum"].names("hitachi|MODEL:CV-W1800SI")).toEqual({
      nameAr: "مكنسة hitachi CV-W1800SI",
      nameEn: "hitachi CV-W1800SI vacuum cleaner",
    });
  });
});

// MEASURED DEFECT (2026-08-22): "kyvol|robot|NA" and "philips|robot|NA" each merged several
// genuine robot vacuum models with their own mopping-cloth/accessory-kit listings into one
// canonical (low_confidence_candidate per the guard above, but still corroborated on price —
// the identity guard stops a false MULTI-STORE comparison, not a false price floor from a
// mixed-evidence single canonical). The canonical's displayed lowest price (7-9 SAR) was the
// accessory's price, not any real vacuum's. Root cause: rejectAccessory already targeted
// "mop pad"/"accessory kit" but production titles use different word forms.
describe("vacuum detection — accessory word-form gap (2026-08-22 audit)", () => {
  it("rejects the measured production accessory titles", () => {
    expect(vacuum.detect("", "Kyvol, Accessories Kit Mopping Cloth (X3) For Robot Vacuum Cleaner D10")).toBe(false);
    expect(vacuum.detect("", "Kyvol, Washable Mopping Cloth (X3) For Robot Vacuum Cleaner E31")).toBe(false);
    expect(vacuum.detect("", "Philips Homerun Mopping Pads (X4) For Homerun Robot Vacuum & Mop XU3000/3100/3110")).toBe(false);
  });
  it("does NOT regress genuine robot vacuums that merely mention Mop/Mopping", () => {
    expect(vacuum.detect("", "Kyvol, Cybovac D10 Robot Vacuum Cleaner, 1500Pa Suction, 2-in-1 Vacuum & Mop, Black")).toBe(true);
    expect(vacuum.detect("", "Kyvol, Cybovac L20S Laser Robot Vacuum Cleaner, Sweeping & Mopping, Black")).toBe(true);
    expect(vacuum.detect("", "Philips Homerun 3000 Series Aqua Robot Vacuum Mop, Beluga")).toBe(true);
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

// ── ADR-254 fuel identity (founder audit order: gas / electric / mixed are all real
//    in production — 5,552 / 4,689 / 493 obs per 30d). Fixtures = real raw names. ──
describe("cooker fuel identity — gas, electric, and mixed can never merge", () => {
  const norm = (ar: string) => cooker.normalize(ar, "", null);
  it("ELECTRIC freestanding (ceramic ranges) is detected and fuel-typed", () => {
    expect(cooker.detect("سامسونج فرن كهرباء سيراميك 63*76 سم، 5 عين، تايلاندي، استيل - NE63C6317SS", "")).toBe(true);
    const r = norm("سامسونج فرن كهرباء سيراميك 63*76 سم، 5 عين، تايلاندي، استيل");
    expect(r.payload.type).toBe("electric_5");
    expect(r.payload.capacity).toBe(75); // max(63,76)=76 → round-5 → 75 size class
  });
  it("fuel-word separated from the noun by the brand still resolves electric", () => {
    const r = norm("فرن لاجيرمانيا، سيراميك، 60×90 سم، كهرباء 5 عين، 142 لتر، شواية، استيل");
    expect(r.payload.type).toBe("electric_5");
  });
  it("LG air-fry electric range is a cooker (قلاية is a feature, not a rejection)", () => {
    expect(cooker.detect("ال جي فرن كهربائي وقلاية هوائية 5 شعلات، 65×76 سم، واي فاي، سمارت، استيل", "")).toBe(true);
    const r = norm("ال جي فرن كهربائي وقلاية هوائية 5 شعلات، 65×76 سم، واي فاي، سمارت، استيل");
    expect(r.payload.type).toBe("electric_5");
    expect(r.payload.air_fry).toBe(true);
  });
  it("countertop mini electric ovens (لتر/واط, no burners) can NEVER enter cooker", () => {
    expect(cooker.detect("دوتس فرن كهربائي 75 لتر، 2800 واط، باب زجاجي مزدوج، اسود - COE0755BD2", "")).toBe(false);
    expect(cooker.detect("دوتس فرن كهربائي 100 لتر، 2800 واط، باب زجاجي مزدوج", "")).toBe(false);
  });
  it("brand collision: a «جليم غاز» ELECTRIC cooker types electric, not gas", () => {
    const r = norm("جليم غاز فرن كهربائي سيراميك 60*90 سم 5 عيون");
    expect(r.payload.type).toBe("electric_5");
  });
  it("mixed 4+2 stays mixed; gas-oven-with-electric-hob is mixed too", () => {
    expect(norm("جليم غاز فرن غاز + كهرباء ,4 عيون غاز + 2 عين كهرباء , أمان كامل").payload.type).toBe("mixed_fuel");
    expect(norm("فرن غاز ويل غاز، 90 * 60 سم، 5 شعلة كهرباء، 116 لتر برتغالي، أمان، استيل").payload.type).toBe("mixed_fuel");
  });
  it("pure gas keeps the v1 labels (zero churn against any materialized row)", () => {
    expect(norm("ميديا فرن غاز 60*90سم، 5 عين غاز، شبك ثقيل، مروحة داخلية، استيل").payload.type).toBe("burners_5");
  });
  it("identity keys differ by fuel at the same brand/size — the anti-merge guarantee", () => {
    const gas = norm("سامسونج فرن غاز 60*90 سم، 5 عيون، استيل");
    const elec = norm("سامسونج فرن كهرباء سيراميك 60*90 سم، 5 عين، استيل");
    const kGas = cooker.buildIdentityKey("samsung", gas.payload);
    const kElec = cooker.buildIdentityKey("samsung", elec.payload);
    expect(kGas.key).not.toBe(kElec.key);
    expect(kGas.key).toMatch(/\|burners_5\|90$/);
    expect(kElec.key).toMatch(/\|electric_5\|90$/);
  });
  it("fuel-aware customer names", () => {
    const names = APPLIANCE_BUNDLES["cooker"].names;
    expect(names("samsung|electric_5|75").nameAr).toBe("طباخ كهربائي samsung 5 شعلات 75 سم");
    expect(names("glem gas|mixed_fuel|90").nameAr).toBe("طباخ غاز وكهرباء glem gas 90 سم");
    expect(names("starway|burners_5|90").nameAr).toBe("طباخ غاز starway 5 شعلات 90 سم");
  });
});
