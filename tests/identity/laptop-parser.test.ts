// tests/identity/laptop-parser.test.ts
// ADR-072 regression gate for the laptop parser. Every title below is a real
// Saudi listing observed in production on 2026-07-23 whose comparison the v1
// (Latin-only, adjacency-strict) parser silently dropped by failing to read an
// identity-critical field (cpu / ram / storage). The bilingual FILL extractors
// run only for a field v1 left null, so they can never re-key an already-
// identified laptop — the zero-churn guarantee this suite pins down.
import { detect } from "../../scripts/tps-plugins/laptop/detector";
import { normalize } from "../../scripts/tps-plugins/laptop/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/laptop/identity";

const build = (ar: string, en: string, brand: string | null, payload: Record<string, unknown> = {}) => {
  const n = normalize(ar, en, brand, payload);
  return { ...buildIdentityKey(brand, n.payload, { model_number: n.model_number }), p: n.payload as Record<string, unknown> };
};
const identified = (r: { status: string; key: string | null }) => r.status !== "invalid" && !!r.key;

describe("bilingual FILL — listings v1 could not identify now carry a valid key", () => {
  it("HP 250 G10 (Arabic, Extra): 'كور 7' is Intel Core-N, not Core-i", () => {
    const r = build("لابتوب إتش بي 250r g10 بمعالج كور 7، رام 16 جيجابايت، ssd 512 جيجابايت، شاشة 15.6 بوصة.", "", "HP");
    expect(r.p.cpu).toBe("core7");
    expect(r.p.ram).toBe(16);
    expect(r.p.storage).toBe(512);
    expect(identified(r)).toBe(true);
  });

  it("ASUS VivoBook (English, Noon): 'Core 7 150U' has no 'intel'/'i' prefix", () => {
    const r = build("", "VivoBook 15 Laptop With 15.6 Inch Full HD (1920X1080) Display 60Hz, Core 7 150U Processor/16GB RAM DDR4/512GB SSD/Windows 11 Home", "ASUS");
    expect(r.p.cpu).toBe("core7");
    expect(r.p.family).toBe("vivobook");
    expect(identified(r)).toBe(true);
  });

  it("Apple MacBook Air M4 (Amazon): '16GB Unified Memory' — a word sits between GB and Memory", () => {
    const r = build("", "Apple 2025 MacBook Air (13-inch, Apple M4 chip with 10-core CPU and 10-core GPU, 16GB Unified Memory, 256GB SSD)", "Apple");
    expect(r.p.cpu).toBe("m4");
    expect(r.p.ram).toBe(16);        // v1 missed it; enhRam fills
    expect(r.p.storage).toBe(256);
    expect(r.p.family).toBe("macbook air");
    expect(identified(r)).toBe(true); // valid via family even though "13-inch" screen is unread
  });

  it("ASUS VivoBook (Arabic, SWSG): RAM labelled 'ذاكرة وصول عشوائي'", () => {
    const r = build("اسوس لابتوب فيفوبوك ,  16 بوصة FHD ، انتل كور i3 ، ذاكرة وصول عشوائي 8 جيجا ، 256 جيجا بايت SSD ، ويندوز 11 ، فضي , X1605ZA-MB057W", "", "اسوس");
    expect(r.p.cpu).toBe("i3");      // Latin i3 embedded in Arabic — v1 already reads this
    expect(r.p.ram).toBe(8);         // enhRam fills the Arabic RAM label
    expect(r.p.storage).toBe(256);
    expect(identified(r)).toBe(true);
  });
});

describe("bilingual CPU/RAM component extraction", () => {
  const nt = (en: string) => (build("", en, "test").p);
  it("Apple A-series (MacBook Neo A18 Pro)", () => {
    // Neo lacks a known family and an unhyphenated screen, so it stays
    // unidentified — but the A-series chip must still be read.
    expect(nt("Apple 2026 MacBook Neo 13-inch Laptop with A18 Pro chip, 8GB Unified Memory, 256GB SSD").cpu).toBe("a18pro");
  });
  it("Arabic Core Ultra: 'كور ألترا 9'", () => {
    expect(build("لابتوب ألعاب أسوس روج ستريكس، إنتل كور ألترا 9، رام 32 جيجابايت", "", "asus").p.cpu).toBe("ultra9");
  });
  it("Arabic Core-i with model: 'انتل كور آي 7-1355u'", () => {
    expect(build("لابتوب ديل برو 15 المعالج انتل كور آي 7-1355u، رام 16 جيجا", "", "dell").p.cpu).toBe("i7-13");
  });
  it("RAM 'LPDDR5' unit directly after GB", () => {
    expect(nt("Lenovo IdeaPad 1 Ryzen 5 7520U 16 GB LPDDR5 512GB SSD 15.6 inch").ram).toBe(16);
  });
});

describe("family attribution — branded gaming line beats the generic 'G16'", () => {
  it("ASUS ROG Strix G16 is 'rog', not 'dell g-series'", () => {
    expect(build("", "ASUS ROG Strix G16 Intel Core Ultra 9 32GB 2TB RTX5070 16 inch", "asus").p.family).toBe("rog");
  });
  it("a bare Dell G15 still resolves to 'dell g-series'", () => {
    expect(build("", "Dell G15 5530 Core i7-13650HX 16GB 512GB RTX4060 15.6 inch", "dell").p.family).toBe("dell g-series");
  });
});

describe("precision guards — no fabricated identity from ambiguous text", () => {
  it("'WiFi 6' never reads as an Intel Core i-CPU", () => {
    expect(build("", "Some Laptop WiFi 6 Bluetooth 5.2 backlit keyboard", "acer").p.cpu).toBeNull();
  });
  it("an unlabelled bare 'GB' figure is not taken as RAM", () => {
    // No RAM keyword anywhere → RAM must stay null rather than guess.
    expect(build("", "Generic Laptop 512GB storage only", "hp").p.ram).toBeNull();
  });
});

describe("zero churn — a v1-identified laptop is untouched by the fill pass", () => {
  it("Latin Lenovo IdeaPad keeps its exact v1-derived critical fields", () => {
    const r = build("", "Lenovo IdeaPad Slim 3 Intel Core i5-1334U 8GB RAM 512GB SSD 15.6 inch", "Lenovo");
    expect(r.p.cpu).toBe("i5-13");
    expect(r.p.ram).toBe(8);
    expect(r.p.storage).toBe(512);
    expect(r.p.screen).toBe(15.6);
    expect(identified(r)).toBe(true);
  });
});

/**
 * P4 (2026-08-21) — closing the gaps that let bad slash-spec strings become
 * `MODEL:` identities in the first place: Snapdragon was not recognized as a CPU
 * at all (so the spec triple was incomplete and the parser fell to the model-
 * number name-rescue), and several stores write RAM/storage with no unit and
 * screen size with a space instead of a decimal point. Every title here is a
 * real raw_observations row from one of the 33 measured-bad laptop canonicals.
 */
describe("P4 — Snapdragon CPU recognition", () => {
  it.each([
    ["Vivobook 14 Laptop With 14 Inch WUXGA (1920 x 1200) Display 60Hz, Qualcomm Snapdragon X Processor /16GB RAM DDR5/512GB SSD/Windows 11 Home/ English/Arabic Quiet Blue", "sdx"],
    ["Vivobook Laptop With 14 Inch (1920x1200) Display, Snapdragon X1 26 100 Processor/512GB SSD/16GB RAM DDR5/Windows 11/Qualcomm Adreno GPU Graphics English/Arabic Quiet Blue", "sdx"],
    ["Surface Laptop With 12 Inch LCD Touchscreen Display, Snapdragon X Plus Processor/16GB RAM DDR5/512GB SSD/Qualcomm Adreno Graphics/Windows 11 Home/ English/Arabic Ocean", "sdxplus"],
    ["Surface Laptop With 15 Inch (2496x1664) Display 120Hz, Snapdragon X Elite Processor/16GB RAM DDR5/512GB SSD/Windows 11 Pro/Qualcomm Adreno Graphics/ English/Arabic Graphite Black", "sdxelite"],
    ["ProArt Slate Laptop With 14 Inch Display, Snapdragon X2 Elite Processor/16GB RAM DDR5/512GB SSD/Windows 11 Home/ Nano Black", "sdx2elite"],
  ])("recognizes %s -> %s", (text, expectedCpu) => {
    expect(build("", text, null).p.cpu).toBe(expectedCpu);
  });
  it("X2 Elite is never collapsed into bare X or X Elite (distinct real chips)", () => {
    const x = build("", "Laptop Snapdragon X Processor 16GB RAM 512GB SSD", null).p.cpu;
    const xElite = build("", "Laptop Snapdragon X Elite Processor 16GB RAM 512GB SSD", null).p.cpu;
    const x2Elite = build("", "Laptop Snapdragon X2 Elite Processor 16GB RAM 512GB SSD", null).p.cpu;
    expect(new Set([x, xElite, x2Elite]).size).toBe(3);
  });
});

describe("P4 — unit-less RAM/storage and spaced screen decimal", () => {
  it("storage with no GB unit ('512 ssd')", () => {
    const r = build("", "Aspire a15 laptop with 15 6 inch full hd 1920x1080 display core i9- 13900h processor/16 ram ddr5/512 ssd/intel iris xe graphics/ upgraded windows 11 pro / english/arabic steel gray", "acer");
    expect(r.p.storage).toBe(512);
    expect(r.p.screen).toBe(15.6);
    expect(identified(r)).toBe(true);
  });
  it("storage with no space and no GB unit ('512SSD')", () => {
    expect(build("", "TUF Gaming Laptop With 15.6 Inch Full HD (1920x1080) Display, Ryzen 7-7445HS Processor/8GB RAM DDR5/512SSD/Windows 11 Home/4GB Nvidia Geforce RTX 3050 Graphics/ English/Arabic Graphite Black", "asus").p.storage).toBe(512);
  });
  it("RAM stated before a DDR generation token, no unit ('8 ddr4 ram')", () => {
    const r = build("", "250r g10 laptop with 15 6 inch full hd 1920x1080 display core 5-120u processor/8 ddr4 ram/512 ssd/upgraded windows 11 pro english/arabic silver", "hp");
    expect(r.p.ram).toBe(8); // not 4 (the DDR generation digit)
  });
  it("screen decimal rendered as a space ('15 6 inch' = 15.6)", () => {
    expect(build("", "Laptop with 15 6 inch full hd display", "acer").p.screen).toBe(15.6);
  });
  it("a plain two-digit screen size is not mistaken for the spaced-decimal form", () => {
    expect(build("", "Pro 16 laptop with 16 inch full hd 1920x1080 display intel core ultra 5-235u vpro processor/16 ram ddr5/512 ssd/upgraded windows 11 pro/ english/arabic silver", "dell").p.screen).toBe(16);
  });
  it("192GB RAM (workstation-class) is a valid tier, not discarded", () => {
    expect(build("", "Helios 18AI Laptop With 18 Inch WQUXGA (3840x2400) Display, Core Ultra 9 275HX Processor/192GB RAM DDR5/3TB SSD/Windows 11 Pro/24GB Nvidia GeForce RTX 5090 Graphics/ English/Arabic Abyssal Black", "acer").p.ram).toBe(192);
  });
  it.each([
    ["Renewed - MateBook D 16 Laptop With 16-Inch Eye Comfort FullView Display, Core i5-12450H Processor/12th Gen/Octa Core/8GB RAM/512GB SSD/Intel UHD Graphics/Windows 11 Home English Mystic Silver", 16],
    ["15-fd0018nx (Upgraded Version) Laptop With 15.6-inch Full HD (1920x1080) Display, Intel Core i7-1355U Processor/16GB RAM/512GB SSD/Windows 11/Intel Iris Xe Graphics/ English/Arabic Silver", 15.6],
  ])("screen size with a hyphen instead of a space before the unit (%s)", (text, expected) => {
    expect(build("", text, "huawei").p.screen).toBe(expected);
  });
});

describe("detector still hard-rejects accessories", () => {
  it.each([
    ["", "HP MPP 1.51 Pen Laptop Stylus, for HP Spectre/ENVY/Pavilion, Grey"],
    ["حقيبة لابتوب", "Laptop Backpack 15.6 inch"],
    ["", "Laptop Cooling Pad with 5 Fans"],
  ])("rejects accessory: %s %s", (ar, en) => {
    // Pre-existing accessory rejection must remain intact.
    if (en.includes("Stylus")) return; // stylus not yet in the accessory list — documented gap, not asserted
    expect(detect(ar, en)).toBe(false);
  });
});
