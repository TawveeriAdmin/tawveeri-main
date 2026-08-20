/**
 * `tvSizeOf()` — the shared TV-size eligibility gate (src/lib/agent/product-eligibility.ts).
 * Whitelist follow-up to the Waffar TV P0 (2026-08-20): the size whitelist was extended
 * with REAL, evidenced sizes found in production (42/83/86/97/115), never guessed. These
 * tests pin that evidence and the deliberate exclusions (34" — a real computer-monitor
 * size, not a TV one) so the whitelist can't silently drift back to a guessed range.
 */
import { tvSizeOf } from "../../src/lib/agent/product-eligibility";

describe("tvSizeOf — evidence-based size whitelist (2026-08-20 follow-up)", () => {
  it("a real 86-inch TV passes (multi-brand model-code convention: LG 86QNED…, Skyworth 86…)", () => {
    expect(tvSizeOf({ display_name_ar: "تلفزيون إل جي 86QNED82A6A", display_name_en: "", attributes: {} })).toBe(86);
    expect(tvSizeOf({ display_name_ar: "تلفزيون سكاي ورث 86Q7700G", display_name_en: "", attributes: {} })).toBe(86);
  });

  it("a real 83/97/115-inch TV passes (same evidenced model-code convention)", () => {
    expect(tvSizeOf({ display_name_ar: "تلفزيون إل جي OLED83C56LA", display_name_en: "", attributes: {} })).toBe(83);
    expect(tvSizeOf({ display_name_ar: "تلفزيون إل جي OLED97G66LW", display_name_en: "", attributes: {} })).toBe(97);
    expect(tvSizeOf({ display_name_ar: "تلفزيون سامسونج QA115QN90FUXSA", display_name_en: "", attributes: {} })).toBe(115);
    expect(tvSizeOf({ display_name_ar: "تلفزيون تي سي إل 115C7K", display_name_en: "", attributes: {} })).toBe(115);
  });

  it('a real 42-inch TV passes (the original whitelist jumped 40→43, skipping the real, common 42" size — Dansat "DTD42BF … 42-Inch Screen Size")', () => {
    expect(tvSizeOf({
      display_name_ar: "", attributes: {},
      display_name_en: "Dansat DTD42BF FHD 4K Android 13 Smart Television with Wallmount, 42-Inch Screen Size, Black",
    })).toBe(42);
  });

  it("a 34-inch gaming/computer monitor never passes — 34 is a real monitor size, not a TV one, and stays out of the whitelist deliberately", () => {
    expect(tvSizeOf({
      display_name_ar: "شاشة ألعاب منحنية شاومي WQHD، مقاس 34 بوصة، معدل تحديث 180 هرتز، 1 مللي ثانية، أسود - G34WQi",
      display_name_en: "", attributes: {},
    })).toBeNull();
  });

  it("a genuinely un-sized TV title stays excluded — Unknown beats incorrect, not a bug", () => {
    expect(tvSizeOf({
      display_name_ar: "", attributes: {},
      display_name_en: "Nikai FHD LED Smart TV, Built-In Wi-Fi, 2 HDMI, Quad Core Processor, Ultra-Slim Design, Sleep Timer, Auto Power Off, NTV4300SLEDT 2 Years Warranty",
    })).toBeNull();
  });

  it("a physical package-dimension string is not misread as a screen size, when a real size is also stated", () => {
    // "111x8x64.7cm" is a box/product dimension, not a screen size — this row's real
    // size (50-inch) is what should be picked up, not 111.
    expect(tvSizeOf({
      display_name_ar: "", attributes: {},
      display_name_en: "Skyworth 50-inch QLED+ Google TV, 120Hz Refresh Rate, Model 50Q6800H, 2025, Smart TV with Dolby Vision & Atmos, 3 HDMI Ports, 111x8x64.7cm, Black",
    })).toBe(50);
  });

  /**
   * KNOWN, DOCUMENTED LIMIT of the size gate alone (not a bug in this function): a
   * 32-inch gaming/computer monitor mislabeled category='tv' at the DATA layer still
   * passes this check, because 32-inch is ALSO a real, common TV size (e.g. a genuine
   * "Xiaomi TV F 32, 32 Inch" exists in production). The size gate can only ask "is a
   * plausible TV size present" — it structurally cannot distinguish a genuine 32"
   * television from a mislabeled 32" monitor. That distinction is a DATA problem,
   * fixed by correcting the row's own category (see the 2026-08-20 legacy tps_version
   * 1.0 cleanup), not something a numeric gate can ever resolve on its own.
   */
  it("documents the 32-inch size/category ambiguity this gate cannot resolve by itself", () => {
    const mislabeledMonitor = tvSizeOf({
      display_name_ar: "إل جي 32 بوصة UltraGear شاشة ألعاب منحنية 1000R، دقة QHD، 180 هرتز، أسود، 32GS60QC-B",
      display_name_en: "", attributes: {},
    });
    const genuineTv = tvSizeOf({ display_name_ar: "", display_name_en: "Xiaomi TV F 32, 32 Inch (81 cm), HD, Smart TV, Fire TV, Dolby Audio™, DTS Virtual:X, DTS-HD, Alexa Voice Control, Works with Apple AirPlay", attributes: {} });
    expect(mislabeledMonitor).toBe(32);
    expect(genuineTv).toBe(32);
  });
});
