// tests/identity/mobile-parser.test.ts
// ADR-061 regression gate for the rebuilt mobile plugin. EVERY title below is a
// real Saudi listing observed in production on 2026-07-23 that the previous
// parser mis-handled. This suite is what lets mobile earn registration.
import { detect } from "../../scripts/tps-plugins/mobile/detector";
import { normalize } from "../../scripts/tps-plugins/mobile/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/mobile/identity";
import { normalizeArabic } from "../../scripts/tps-plugins/mobile/text";

const idOf = (ar: string, en: string, brand: string | null, payload: Record<string, unknown> = {}) => {
  const n = normalize(ar, en, brand, payload);
  return { ...buildIdentityKey(brand, n.payload, { model_number: n.model_number }), p: n.payload };
};

describe("detector — accessories and other categories are hard-rejected", () => {
  it.each([
    ["حامل جوال يوجرين مغناطيسي على فتحة مكيف السيارة magesafe - أسود", "car mount matched on 'جوال'"],
    ["ابل، غطاء ماج سيف سيليكون ايفون 16 برو، ازرق", "silicone case matched on 'ايفون'"],
    ["زوندا إيليت 3 في 1 شفاف لآيفون 17 برو ماكس (غطاء - واقي شاشة)", "case bundle"],
    ["سلك شاحن أورايمو روبوست لاين من USB-C إلى آيفون بطول 1 م", "charging cable"],
    ["برتيك حامل تلفزيون احترافي من 37 إلى 70 بوصة", "TV wall bracket"],
    ["أنكر 610 قبضة هاتف مغناطيسية ماجو أسود", "phone grip"],
  ])("rejects accessory: %s (%s)", (title) => {
    expect(detect(title, "")).toBe(false);
  });

  it.each([
    ["سامسونج جالاكسي، ساعة فيت 3 الذكية، 1.6 بوصة، أسود", "smartwatch"],
    ["سماعات AirPods Pro الجيل الثاني مع حافظة MagSafe", "earbuds"],
    ["سامسونج جالاكسي تاب ايه 11، واي فاي، 8.7 بوصة، 128 جيجا", "tablet"],
  ])("rejects other category: %s (%s)", (title) => {
    expect(detect(title, "")).toBe(false);
  });

  it("still detects real phones in both languages", () => {
    expect(detect("أبل أيفون 15، 5جي، 6.1 بوصة، 128 جيجا، أسود", "")).toBe(true);
    expect(detect("سامسونج جالاكسي، اس 25 الترا، 256 جيجا", "")).toBe(true);
    expect(detect("", "Apple iPhone 16 Pro Max 256GB Black")).toBe(true);
    expect(detect("", "Xiaomi Redmi Note 14 128GB")).toBe(true);
  });
});

describe("Arabic orthography and separators", () => {
  it("folds hamza variants so أيفون / آيفون / ايفون are one spelling", () => {
    expect(normalizeArabic("أيفون")).toBe(normalizeArabic("ايفون"));
    expect(normalizeArabic("آيفون")).toBe(normalizeArabic("ايفون"));
  });

  it("parses 'أيفون' — the spelling that previously failed for a whole store", () => {
    const r = idOf("أبل أيفون 15، 5جي، 6.1 بوصة، 128 جيجا، أسود", "", "APPLE");
    expect(r.status).toBe("valid");
    expect(r.key).toBe("apple|iPhone|15|Standard|128");
  });

  it("treats an Arabic comma as a separator (defeated the old regex)", () => {
    const r = idOf("سامسونج جالاكسي، اس 25 الترا، 256 جيجا، 12 جيجا، 5 جي، تيتانيوم اسود", "", "سامسونج");
    expect(r.status).toBe("valid");
    expect(r.key).toBe("samsung|Galaxy S|S25|Ultra|256");
  });

  it("reads Arabic transliterated line letters: ايه = A", () => {
    const r = idOf("سامسونج، جالاكسي ايه 36، 256 جيجا، 8 جيجا، 5 جي، اسود", "", "سامسونج");
    expect(r.key).toBe("samsung|Galaxy A|A36|Standard|256");
  });
});

describe("storage — RAM must never become a storage identity", () => {
  it("does not read '8 جيجابايت رام' as storage", () => {
    const r = idOf("سامسونج جالكسي A57، جيجابايت 128، 8 جيجابايت رام، 5G، شريحتين - ازرق داكن", "", "سامسونج");
    expect(r.p.ram_gb).toBe(8);
    expect(r.p.storage_gb).toBe(128);
    expect(r.key).toBe("samsung|Galaxy A|A57|Standard|128");
  });

  it("never emits a non-tier storage value (the `…|Standard|4` defect)", () => {
    const r = idOf("سامسونج جالاكسي ايه 07، 4 جيجا رام", "", "سامسونج");
    expect(r.p.storage_gb).not.toBe(4);
  });

  it("parses terabytes in Arabic", () => {
    expect(idOf("ابل آيفون 17 برو ماكس، سعة 1 تيرابايت، اللون البرتقالي", "", "ابل").key)
      .toBe("apple|iPhone|17|Pro Max|1024");
    expect(idOf("أبل أيفون 17 برو ماكس، 5 جي، 6.9 بوصة، 2 تيرا، أزرق", "", "APPLE").p.storage_gb)
      .toBe(2048);
  });

  it("prefers a structured payload storage field when the store supplies one", () => {
    expect(idOf("سامسونج جالاكسي اس 25", "", "سامسونج", { storage: 512 }).p.storage_gb).toBe(512);
  });
});

describe("named generations and variants", () => {
  it("parses iPhone Air, whose generation is a NAME not a number", () => {
    const r = idOf("ابل ايفون اير، 256 جيجابايت، 5G – أزرق سماوي", "", "ابل");
    expect(r.status).toBe("valid");
    // "Air" is the generation; it must NOT also become the variant.
    expect(r.key).toBe("apple|iPhone|Air|Standard|256");
  });

  it("keeps Pro Max distinct from Pro", () => {
    expect(idOf("", "Apple iPhone 17 Pro Max 256GB", "Apple").key).toBe("apple|iPhone|17|Pro Max|256");
    expect(idOf("", "Apple iPhone 17 Pro 256GB", "Apple").key).toBe("apple|iPhone|17|Pro|256");
  });

  it("separates Z Fold from Z Flip", () => {
    expect(idOf("سامسونج جالاكسي زد فولد 7، 256 جيجا", "", "سامسونج").key).toBe("samsung|Galaxy Z|Z Fold 7|Standard|256");
    expect(idOf("سامسونج جالاكسي زد فليب 7، 256 جيجا", "", "سامسونج").key).toBe("samsung|Galaxy Z|Z Flip 7|Standard|256");
  });
});

describe("long-tail brands (previously unsupported entirely)", () => {
  it.each([
    ["", "Xiaomi Redmi Note 14 256GB", "Xiaomi", "xiaomi|Redmi Note|14|Standard|256"],
    ["", "HONOR Magic 6 Pro 512GB", "Honor", "honor|Honor Magic|6|Pro|512"],
    ["", "Huawei nova 12 256GB", "Huawei", "huawei|Huawei nova|12|Standard|256"],
    ["", "OPPO Reno 12 256GB", "OPPO", "oppo|OPPO Reno|12|Standard|256"],
    ["", "Google Pixel 9 Pro 256GB", "Google", "google|Pixel|9|Pro|256"],
  ])("parses %s%s", (ar, en, brand, expected) => {
    expect(idOf(ar, en, brand).key).toBe(expected);
  });
});

describe("precision — different phones never collapse", () => {
  it("separates storage tiers, variants, generations and brands", () => {
    const base = idOf("", "Apple iPhone 16 Pro 256GB", "Apple").key;
    expect(base).not.toBe(idOf("", "Apple iPhone 16 Pro 512GB", "Apple").key);
    expect(base).not.toBe(idOf("", "Apple iPhone 16 Pro Max 256GB", "Apple").key);
    expect(base).not.toBe(idOf("", "Apple iPhone 15 Pro 256GB", "Apple").key);
    expect(base).not.toBe(idOf("", "Samsung Galaxy S26 256GB", "Samsung").key);
  });

  it("colour and network are commercial, never identity", () => {
    const black = idOf("", "Apple iPhone 16 Pro 256GB Black 5G", "Apple");
    const blue = idOf("", "Apple iPhone 16 Pro 256GB Blue", "Apple");
    expect(black.key).toBe(blue.key);
    expect(black.p.color).toBe("black");
    expect(black.p.network).toBe("5G");
  });

  it("rejects rather than guessing when the generation is unreadable", () => {
    expect(idOf("جوال ذكي بشاشة كبيرة", "", "Samsung").status).toBe("invalid");
  });
});
