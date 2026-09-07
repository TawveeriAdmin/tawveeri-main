/**
 * MEASURED DEFECT (2026-08-10, D→E mission Part F — founder follow-up "fix the شاشة
 * miscategorization too"): `CATEGORY_DETECTION_ORDER` checked 'monitor' BEFORE 'smartwatch'
 * and returns on the first match — so a smartwatch titled "...Smart Watch with Heart
 * Rate/Sleep Monitor, Fitness Watch..." was categorized `monitor`, not `smartwatch`, and
 * leaked into "شاشة" (screen/monitor) search results. A live data audit found 320 of 1225
 * products tagged category='monitor' (26%) were actually smartwatches, corrected via a
 * one-off scoped database update (not part of this codebase — see ADR-236's addendum).
 * This test pins the CODE fix: smartwatch is now checked before monitor.
 */
import { determineCategory, classifyFromTitle, isAccessoryOnlyAudioTitle } from "@/lib/scraping/utils/category-utils";

describe("determineCategory — smartwatch must win over monitor's generic 'monitor' keyword", () => {
  it("classifies the exact measured production title as smartwatch, not monitor", () => {
    const title =
      "7 Interchangeable Bands Smart Watches for Women Men,1.83\" HD Smart Watch with Heart Rate/Sleep Monitor,Fitness Watch with Bluetooth Call,120+ Sport Modes Activity Tracker Bands Gift Set";
    expect(determineCategory(title)).toBe("smartwatch");
    expect(classifyFromTitle(title)).toBe("smartwatch");
  });

  it("classifies other smartwatch titles containing 'monitor' as smartwatch", () => {
    expect(determineCategory("Fitness Tracker Smart Watch with Heart Rate Monitor")).toBe("smartwatch");
    expect(determineCategory("Huawei Watch Fit 4 - 24/7 Health Monitoring Smartwatch")).toBe("smartwatch");
    expect(determineCategory("F100 Smart Watch, ECG Blood Glucose Monitor")).toBe("smartwatch");
  });

  it("a genuine computer monitor is still classified monitor (no regression)", () => {
    expect(determineCategory("Samsung 24\" Essential Monitor S3 S33GF FHD 100Hz")).toBe("monitor");
    expect(determineCategory("ViewSonic 24 Inch Gaming Monitor VX2425-HD-PRO, FHD IPS Display")).toBe("monitor");
    expect(determineCategory("شاشة كمبيوتر lg 21.5 بوصة FHD 75Hz")).toBe("monitor");
  });
});

/**
 * MEASURED DEFECT (2026-08-21): `determineCategory` matched 'smartphone'/'audio' on the
 * DEVICE NAME embedded inside an accessory title — "غطاء ايفون 16 برو" contains "ايفون";
 * "حافظة سماعات الأذن" contains "سماعات" — so a phone case or earbuds case was written to
 * `products.category` as the device itself. Live-measured: 65/568 (11.4%) of `smartphone`
 * and 14/923 (1.5%) of `audio` were accessories. This pins the fix: an accessory-headed
 * title falls through to `accessories` instead of the device category it merely names.
 */
describe("determineCategory — accessory titles must not be classified as the device they fit", () => {
  it("a real iPhone case is accessories, not smartphone", () => {
    expect(determineCategory("زوندا، غطاء ايفون 16 برو شفاف ماج سيف - أبيض")).toBe("accessories");
    expect(determineCategory("ابل، غطاء ماج سيف سيليكون ايفون 16 برو ماكس، فوشيا")).toBe("accessories");
    expect(determineCategory("iPhone 16 Pro case magsafe clear")).toBe("accessories");
    expect(determineCategory("حافظة سيليكون آيفون 17 برو ماكس مع ماج سيف – أرجواني")).toBe("accessories");
  });

  it("a real earbuds/headphone case is accessories, not audio", () => {
    expect(determineCategory("ريتشي , حافظة سماعات الأذن , أسود")).toBe("accessories");
    expect(determineCategory("بايكرون , حافظة من السيليكون لسماعات Airpod Pro , أزرق")).toBe("accessories");
    expect(determineCategory("ريتشي غطاء سماعة الأذن للحماية الكاملة")).toBe("accessories");
  });

  it("a genuine phone is still classified smartphone (no regression)", () => {
    expect(determineCategory("Apple iPhone 16 Pro Max 256GB")).toBe("smartphone");
    expect(determineCategory("سامسونج جالاكسي اس 25 الترا 512 جيجا")).toBe("smartphone");
    expect(determineCategory("Xiaomi Redmi Note 13 Pro 5G")).toBe("smartphone");
  });

  it("genuine audio devices are still classified audio (no regression)", () => {
    expect(determineCategory("Apple AirPods Pro 2nd Generation with MagSafe Case")).toBe("audio");
    expect(determineCategory("JBL Partybox 720 Bluetooth Speaker")).toBe("audio");
    expect(determineCategory("سماعة بلوتوث لاسلكية سوني")).toBe("audio");
  });
});

/**
 * MEASURED DEFECT (2026-08-21, P2 sub-task audit): bare English "speaker" (no "bluetooth")
 * was not in `CATEGORY_KEYWORDS.audio` at all — live production audit found 9+ genuine
 * standalone speakers (JBL Portable/Partybox, Sony SRS-XV500, Xiaomi Sound Pocket…)
 * miscategorized under `accessories`. A naive full-title fix was rejected: it would ALSO
 * reclassify a real gaming console ("ROG Ally X XBOX Gaming Console … Dolby Speaker TYPE
 * C…") and a mini projector from their correct category to `audio`, since both only mention
 * a built-in speaker as a feature deep in their spec list, and `gaming`/`camera`/`kitchen`/
 * `appliance` are checked AFTER `audio` in `CATEGORY_DETECTION_ORDER` — unlike monitor/
 * laptop/tv/tablet, which are protected by being checked BEFORE `audio`. The fix is
 * head-anchored: only accept a bare "speaker" when the word sits in the title's own head
 * (a genuine speaker PRODUCT names itself there), never when it is buried in a spec/
 * compatibility list.
 */
describe("determineCategory — bare 'speaker' (no 'bluetooth') regression", () => {
  it("classifies real, measured standalone-speaker titles as audio", () => {
    expect(determineCategory("Jbl Portable Speaker Go Essential Black")).toBe("audio");
    expect(determineCategory("Jbl Partybox Encore 2 Portable Party Speaker 100w Black")).toBe("audio");
    expect(determineCategory("Sony Wireless Party Speaker 24 Ghz Srsxv500")).toBe("audio");
    expect(determineCategory("Xiaomi Sound Pocket Mini Speaker 5w Black S28d")).toBe("audio");
    expect(determineCategory("Trands Portable Wireless Speaker 5w Trsp912")).toBe("audio");
  });

  it("does NOT reclassify a real gaming console or projector that merely mentions a built-in speaker deep in its spec list (regression guard for the exact false positive found during the audit)", () => {
    const rogAllyX = "ROG Ally X XBOX Gaming Console With 7 Inch Full HD(1920X1080) Display 120Hz, AMD Ryzen Z2 Extreme Processor/24GB RAM DDR5/1TB SSD/AMD Radeon Graphics/Windows 11 Home/Dolby Speaker TYPE C & Finger Print Sensor/ English/Arabic Black";
    expect(determineCategory(rogAllyX)).toBe("gaming");
    const projector = "Mini Projector 4K, HAPPRUN H1 Full HD Projector with Bluetooth – Native 1080P Portable Outdoor Projector with Speaker, Compatible with Smartphone, HDMI, USB, AV, TV Stick, PS5 for Home Cinema, Bedroom";
    expect(determineCategory(projector)).not.toBe("audio");
  });

  it("a speaker case/stand/mount is still accessories, even with 'speaker' in the head (accessory veto still applies first)", () => {
    expect(determineCategory("Speaker Stand Mount for Amazon Echo Dot, Wall Mount Holder")).toBe("accessories");
    expect(determineCategory("حافظة سماعة الأذن للحماية الكاملة")).toBe("accessories");
  });

  it("a monitor/laptop/tv/tablet with 'Built-in Speakers' is unaffected — its own category still wins (no regression)", () => {
    expect(determineCategory("24-Inch FHD IPS Gaming Monitor, 165Hz, 1ms, Built-in Speakers")).toBe("monitor");
    expect(determineCategory("STARGOLD 32 Inch Smart TV Full HD, Built-in 16W Box Speakers")).toBe("tv");
  });
});

/**
 * MEASURED DEFECT (2026-08-27, quality-program P0-B — the AirPods Pro 2 SAR-79 incident):
 * a Baykron "Airpods Pro 2nd Gen Silicone Case" (an accessory, ~SAR 79) was staged under
 * the SAME identity_key as the real Apple AirPods Pro 2 (~SAR 899-1,049), corrupting that
 * canonical's price and store_count. `isAccessoryTitleHead`'s 30-char window cannot
 * separate this from a genuine "سماعات AirPods Pro ... مع حافظة MagSafe" — both place
 * their accessory word at almost the same character offset. `isAccessoryOnlyAudioTitle`
 * disambiguates by requiring the ABSENCE of a genuine device noun (earbuds/headphone/
 * speaker/microphone/سماعة/…), and by requiring the device noun (when present) to appear
 * BEFORE the accessory word — not merely named as the accessory's compatibility target
 * ("Case for Wireless Earbuds").
 *
 * Validated against real production data before being wired into
 * `scripts/tps-core/progressive-engine.ts`: 898 storefront `products` rows and 326 live
 * `tps_current_offers` rows (category=audio) — zero false positives on genuine earbuds,
 * headphones, or microphones (Apple AirPods 3/4, Soundcore, JOYROOM, Hollyland, BOYA, DJI,
 * FIFINE, FDUCE all correctly NOT flagged).
 */
describe("isAccessoryOnlyAudioTitle — accessory-vs-device disambiguation (2026-08-27, P0-B)", () => {
  it("flags the exact production-confirmed accessory (English)", () => {
    expect(isAccessoryOnlyAudioTitle("Baykron Airpods Pro 2nd Gen Silicone Case - Black")).toBe(true);
  });

  it("flags the exact production-confirmed accessory (Arabic, fused كفر compound)", () => {
    expect(isAccessoryOnlyAudioTitle("بايكرون,  كفرايربودز برو الجيل الثاني  , أحمر")).toBe(true);
  });

  it("does not flag a genuine Apple AirPods Pro 3 listing that legitimately mentions a charging case", () => {
    expect(isAccessoryOnlyAudioTitle(
      "Apple AirPods Pro 3 Earbuds, Active Noise Cancelling, Bluetooth (Device)/MagSafe Charging Case, USB-C, Built-in Microphone, White"
    )).toBe(false);
  });

  it("does not flag a genuine Apple AirPods 4 listing with USB-C charging case wording", () => {
    expect(isAccessoryOnlyAudioTitle(
      "Apple AirPods 4 Wireless Earbuds, Bluetooth Headphones, Personalized Spatial Audio, USB-C Charging Case, H2 Chip"
    )).toBe(false);
  });

  it("does not flag a genuine Soundcore listing with case wording", () => {
    expect(isAccessoryOnlyAudioTitle(
      "Soundcore P40i by Anker, Noise Cancelling Wireless Earbuds, Heavy Bass, 60H Playtime, 2-in-1 Case and Phone Stand"
    )).toBe(false);
  });

  it("does not flag a genuine JOYROOM listing with case wording", () => {
    expect(isAccessoryOnlyAudioTitle(
      "JOYROOM JR-T03S TWS Semi In-Ear Earphones Wireless Earbuds And Equipped With Anti-Fingerprint Silicon Case"
    )).toBe(false);
  });

  it("does not flag a genuine microphone that legitimately ships with a charging case", () => {
    expect(isAccessoryOnlyAudioTitle(
      "BOYA Mini 2 Wireless Lavalier Mic with AI Noise Cancellation & App Control, 30H Battery Life with Charging Case"
    )).toBe(false);
    expect(isAccessoryOnlyAudioTitle("DJI Mic Mini (2 TX + 1 RX + Charging Case), 48h Use, Noise Cancelling")).toBe(false);
  });

  it("resolves the ambiguous case correctly: product name before the accessory word (Arabic)", () => {
    expect(isAccessoryOnlyAudioTitle(
      "سماعات AirPods Pro الجيل الثاني مع حافظة MagSafe من النوع C باللون الأبيض"
    )).toBe(false);
  });

  it("flags other silicone/protective/hard/carrying case accessories", () => {
    expect(isAccessoryOnlyAudioTitle("Universal Hard Carrying Case for Wireless Earbuds - Black")).toBe(true);
    expect(isAccessoryOnlyAudioTitle("Protective Silicone Cover for AirPods Pro 2")).toBe(true);
    expect(isAccessoryOnlyAudioTitle("USB-C Charging Cable for AirPods Pro")).toBe(true);
    expect(isAccessoryOnlyAudioTitle("Tempered Glass Screen Protector for AirPods Pro Case")).toBe(true);
  });

  it("flags Arabic titles containing حافظة with no device noun", () => {
    expect(isAccessoryOnlyAudioTitle("كفر حماية لسماعة بلوتوث ايربودز برو")).toBe(true);
  });

  it("does not flag a bare genuine product name with no accessory word at all", () => {
    expect(isAccessoryOnlyAudioTitle("Apple Airpods Pro 2")).toBe(false);
  });

  it("does not flag a real device that also mentions a cover feature, device noun first", () => {
    expect(isAccessoryOnlyAudioTitle("Anker Soundcore Wireless Earbuds with Silicone Cover Included")).toBe(false);
  });

  it("returns false for empty/null input", () => {
    expect(isAccessoryOnlyAudioTitle("")).toBe(false);
    expect(isAccessoryOnlyAudioTitle(null)).toBe(false);
    expect(isAccessoryOnlyAudioTitle(undefined)).toBe(false);
  });
});

/**
 * MEASURED DEFECT (2026-09-07, Amazon AC depth audit): Amazon's `products.category =
 * 'air_conditioner'` storefront rows were 15/17 (88%) genuine AC PARTS/ACCESSORIES (drain
 * trays, cleaning brushes, ice packs, installation hoists, pipe expanders, chemical cleaners) —
 * every one stuffs "Air Conditioner" into its title for Amazon SEO/compatibility, the exact
 * same mechanism ADR-243 already fixed for phone cases mentioning "iPhone 16". `determineCategory`'s
 * accessory veto was scoped to smartphone/audio only, and the general `ACCESSORY_INDICATORS`
 * vocabulary (case/cover/charger/cable/stand/strap/…) contains none of these AC-part terms. This
 * pins the fix: real, measured Amazon titles for all 15 accessory rows found in production.
 */
describe("determineCategory — AC parts/accessories must not be classified as air_conditioner", () => {
  const realAmazonAcAccessoryTitles = [
    "2 Pack Air Conditioner Fin Cleaning Brush,Double Sided Stainless Steel Cleaner Brush for Deep Into HVAC Coil Fins to Effectively Removing Dirt and Debris Without Damaging",
    "6Pcs/Set Electric Drill Pipe Expander Air Conditioner Swaging Tools Repairing Kit",
    "8 Pcs Hand-held Groove Gap Cleaning Tools - Door Window Track Crevice Cleaning Brushes Blind Cleaner Duster, Window Magic Cleaning Brush for Shower Door, Car Vents, Air Conditioner, Keyboard, Shutter",
    "Air Conditioner Base Stainless Steel Floor Pallet Rack Raised for Warehouses Garage Kitchens Shops",
    "Air Conditioner Condensate Drain Tray Outdoor AC Support Tray Plastic Drainage Pan for AC Units Size 81x33x3cm Color 200cm & Easy to Install",
    "DiversiTech (6-2424L) A/C Secondary Condensate Drain Pan, Air Conditioner Drip Pan with Rolled Edges, 24 x 24 Plastic Tray, Black",
    "DOITOOL Reusable Ice Packs for Air Conditioner Fan, 4 Pack for Cooler, Lunch Cooler Bag Freezer Blocks",
    "Ice Cube Molds Trays Ice Packs 4Pcs Long Lasting Freezer Blocks Reusable Portable Cooler Freezer Ice Packs Keep Cool for Refrigerator Air Conditioner Fan (Pack of 4)",
    "Reusable Ice Packs Freezer Cube Mold Tray, 4 Packs for Air Conditioner Fan Ice Block Portable Cooler Freezer",
    "Errecom Clima-Net, Air Conditioner Cleaner for A/C Filters, Coils and Outdoor Units, 6 x 1 L bottle",
    "Heavy-Duty Manual Lift for Air Conditioner Installation 100kg Load Capacity Ideal for Positioning and Maneuvering Outdoor Units",
    "High Capacity Air Conditioner Installation Hoist - 100KG Load 10-25m Reach Manual Lift for Outdoor Use Perfect for HVAC Professionals and DIY Projects",
    "ISTOVO AC Water Draining Machine Air Conditioner Water Pump 400ml Household Size of 3 Lift with 10M Pump| WG-6",
    "Outdoor Air Conditioner Condensate Drain Tray 93x45x3cm Plastic Support for AC Units Condensation Recovery Pan Essential for Efficient Cooling System Maintenance",
    "Universal Air Conditioner with Drain Hose Plastic Condensate Tray PP5 Indoor Outdoor Unit Window Kit for Efficient Water Collection & Drainage.",
  ];

  it("classifies every measured production AC-accessory title as NOT air_conditioner", () => {
    for (const title of realAmazonAcAccessoryTitles) {
      expect(determineCategory(title)).not.toBe("air_conditioner");
    }
  });

  it("a genuine split/window/portable AC is still classified air_conditioner (no regression)", () => {
    expect(determineCategory("GWH18AGDXF-D3NTA1G-I 18000 BTU, 1.5 Ton Split Air Conditioner, White")).toBe("air_conditioner");
    expect(determineCategory("Star vision 16000 BTU Hot&Cold Portable Air Conditioner, Auto Fan, Self Diagnostic")).toBe("air_conditioner");
    expect(determineCategory("Split AC 11100 BTU Standard cool only")).toBe("air_conditioner");
    expect(determineCategory("Window AC 17200 BTU cool only")).toBe("air_conditioner");
    expect(determineCategory("مكيف سبليت ال جي 18000 وحدة انفرتر بارد فقط")).toBe("air_conditioner");
  });
});
