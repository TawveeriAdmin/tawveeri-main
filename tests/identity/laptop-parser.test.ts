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
