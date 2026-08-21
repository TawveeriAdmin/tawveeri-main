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
import { determineCategory, classifyFromTitle } from "@/lib/scraping/utils/category-utils";

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
