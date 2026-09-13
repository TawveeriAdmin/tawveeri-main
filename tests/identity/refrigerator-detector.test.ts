// tests/identity/refrigerator-detector.test.ts
// Official Gateway Closure mission (2026-09-13): bare "mount" in the ACCESSORY exclusion
// list wrongly rejected real Samsung KSA refrigerator titles that use "Top Mount"/"Bottom
// Mount" as their standard door-configuration name (freezer-on-top vs. freezer-on-bottom),
// not a mounting-bracket accessory. Narrowed to "wall mount".
import { detect } from "../../scripts/tps-plugins/refrigerator/detector";
import { normalize } from "../../scripts/tps-plugins/refrigerator/parser";

describe("detector — 'Top/Bottom Mount' door configuration is not a mounting accessory", () => {
  it("detects a Top Mount Freezer Refrigerator (real Samsung KSA title, RT58K7110BS/ZA)", () => {
    expect(detect("", "Top Mount Freezer Refrigerator 583L Water dispenserTwin Cooling Rt7000k Black Za (RT58K7110BS/ZA)")).toBe(true);
  });
  it("detects a One Door Refrigerator (no regression)", () => {
    expect(detect("", "One Door Refrigerator Precise Cooling 330L Ri80h24 Silver (RZ40H32P1TZA)")).toBe(true);
  });
  it("still rejects a genuine wall-mount accessory", () => {
    expect(detect("", "Refrigerator wall mount bracket, universal")).toBe(false);
  });
});

describe("parser — 'One Door' resolves the single_door type (real Samsung KSA title, RZ40H32P1TZA)", () => {
  it("resolves fridge_type=single_door from 'One Door' phrasing", () => {
    const n = normalize("", "One Door Refrigerator Precise Cooling 330L Ri80h24 Silver (RZ40H32P1TZA)", "Samsung");
    expect(n.payload.fridge_type).toBe("single_door");
  });
});
