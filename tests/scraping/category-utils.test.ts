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
