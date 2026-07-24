// tests/identity/mobile-parser.test.ts
// ADR-061 regression gate for the rebuilt mobile plugin. EVERY title below is a
// real Saudi listing observed in production on 2026-07-23 that the previous
// parser mis-handled. This suite is what lets mobile earn registration.
import { detect } from "../../scripts/tps-plugins/mobile/detector";
import { normalize } from "../../scripts/tps-plugins/mobile/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/mobile/identity";
import { scoreConfidence } from "../../scripts/tps-plugins/mobile/validator";
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

  // ADR-071: each of these was a MEASURED false claim costing a comparison slot
  // in the largest Saudi category.
  it.each([
    ["أسوس فيفو بوك S14 فليب، بمعالج i5-13420H، ذاكرة 16 جيجابايت", "Asus VivoBook matched the 'فيفو' (vivo) signal"],
    ["OLED55B56LA 55 inch LG OLED B5 4K 120Hz Smart TV Magic Remote webOS", "LG TV matched bare 'magic' (Magic Remote)"],
    ["سمارت تاج 2 سامسونج جالكسي، اسود - EI-T5600BBEGWW", "SmartTag tracker matched 'جالكسي'"],
    ["سامسونج , حافظ جهاز Z flip 5 , شفاف", "a case — 'حافظ' lacks the ta-marbuta of 'حافظه'"],
    ["بنك الطاقة شاومي 10 كيلو 33 واط - أزرق", "Xiaomi power bank"],
    ["شاومي ستيك تي في 4k الجيل الثاني بث ذكي", "Xiaomi TV stick"],
    ["ممسحة مكنسة شاومي متوافق مع مكانس e10/e12", "Xiaomi vacuum mop"],
    ["شاومي باد 8، واي فاي، 256 جيجا، أزرق", "Xiaomi Pad is a tablet"],
    ["شاشة ألعاب منحنية شاومي WQHD، مقاس 34 بوصة، 180 هرتز - G34W", "34-inch gaming monitor matched the Xiaomi token"],
    ["تكنو ميجا باد 11، 4 جي، 256 جيجا، أخضر", "Tecno Megapad is a tablet, not a phone"],
  ])("rejects non-phone: %s (%s)", (title) => {
    expect(detect(title, "")).toBe(false);
  });

  it("still detects real phones in both languages", () => {
    expect(detect("أبل أيفون 15، 5جي، 6.1 بوصة، 128 جيجا، أسود", "")).toBe(true);
    expect(detect("سامسونج جالاكسي، اس 25 الترا، 256 جيجا", "")).toBe(true);
    expect(detect("", "Apple iPhone 16 Pro Max 256GB Black")).toBe(true);
    expect(detect("", "Xiaomi Redmi Note 14 128GB")).toBe(true);
  });

  it("the 20\"+ monitor guard must NOT reject a fractional phone size like 6.67 بوصة", () => {
    // Regression: an early guard read the "67" of "6.67 بوصة" as a 67-inch display
    // and rejected real 6.6x-inch phones. A phone screen size is never whole-≥20.
    expect(detect("شاومي 14T برو، 5 جي، 6.67 بوصة، 512 جيجا، رمادي", "")).toBe(true);
    expect(detect("شاومي ريدمي نوت 14 برو بلس، 6.67 بوصة، 256 جيجا", "")).toBe(true);
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

describe("ADR-081 — storage-optional NO_STORAGE canonical (flagship base-model listings)", () => {
  const conf = (ar: string, brand: string) => {
    const n = normalize(ar, "", brand, {});
    return scoreConfidence(brand, n.payload, n.model_number, n.ambiguity_flags);
  };
  it("a storage-less base model is a valid NO_STORAGE canonical", () => {
    expect(idOf("", "Samsung Galaxy S25 Ultra", "Samsung").key).toBe("samsung|Galaxy S|S25|Ultra|NO_STORAGE");
    expect(idOf("", "Apple iPhone 17 Pro Max", "Apple").key).toBe("apple|iPhone|17|Pro Max|NO_STORAGE");
  });
  it("bilingual bare listings of the same model corroborate (one NO_STORAGE key)", () => {
    expect(idOf("سامسونج جالكسي اس 25 الترا", "", "سامسونج").key)
      .toBe(idOf("", "Samsung Galaxy S25 Ultra", "Samsung").key);
  });
  it("NO_STORAGE never merges with a storage-specific variant (precision preserved)", () => {
    expect(idOf("", "Apple iPhone 17 Pro Max", "Apple").key)
      .not.toBe(idOf("", "Apple iPhone 17 Pro Max 256GB", "Apple").key);
  });
  it("carries the uncertainty as reduced confidence (<=60 vs 100 fully-specified)", () => {
    expect(conf("Samsung Galaxy S25 Ultra", "Samsung").confidence).toBeLessThanOrEqual(60);
    expect(conf("Samsung Galaxy S25 Ultra 256GB", "Samsung").confidence).toBe(100);
  });
  it("does NOT rescue a partially-parsed model — the model must be fully identified", () => {
    // no generation → still invalid, never a bare NO_STORAGE guess
    const r = idOf("", "Samsung Galaxy phone", "Samsung");
    expect(r.status).toBe("invalid");
  });
});

describe("additional product lines and storage formats", () => {
  it("reads the Huawei nova Y line (bare-nova rule needs a digit right after 'nova')", () => {
    expect(idOf("هواوي نوفا واي 73، 4 جي، 256 جيجا، أزرق", "", "هواوي").key)
      .toBe("huawei|Huawei nova Y|73|Standard|256");
    expect(idOf("", "Huawei nova Y73 256GB", "Huawei").key)
      .toBe("huawei|Huawei nova Y|73|Standard|256");
  });

  it("does not confuse a bare nova model with the nova Y line", () => {
    expect(idOf("", "Huawei nova 14 Pro 256GB", "Huawei").key)
      .toBe("huawei|Huawei nova|14|Pro|256");
  });

  it("reads Tecno Pova Slim — a named model with no generation number", () => {
    expect(idOf("تكنو بوفا سليم، 5 جي، 256 جيجا، أسود", "", "تكنو").key)
      .toBe("tecno|Tecno Pova|Slim|Standard|256");
    // a numbered Pova must not be captured as Slim
    expect(idOf("تكنو بوفا 6 برو 256 جيجا", "", "تكنو").key)
      .toBe("tecno|Tecno Pova|6|Pro|256");
  });

  it("reads a combined 'storage + RAM' figure — '256 + 8 جيجا' → storage 256, RAM 8", () => {
    const r = idOf("تكنو KL8 سبارك 30 5G 256 + 8 جيجا DS ميدنايت شادو", "", "تكنو");
    expect(r.p.storage_gb).toBe(256);
    expect(r.p.ram_gb).toBe(8);
    expect(r.key).toBe("tecno|Tecno Spark|30|Standard|256");
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

describe("ADR-071 — product lines that were missing entirely", () => {
  it("parses Tecno Pova, Tecno's largest Saudi line (36 measured misses)", () => {
    expect(idOf("تكنو بوفا 7 ، 5 جي 256 جيجا 8 جيجا، اسود", "", "تكنو").key)
      .toBe("tecno|Tecno Pova|7|Standard|256");
  });

  it("parses Pova Curve, a NAMED model with no generation number", () => {
    expect(idOf("تكنو بوفا كيرف، 5 جي، 256 جيجا، أسود", "", "تكنو").key)
      .toBe("tecno|Tecno Pova|Curve|Standard|256");
  });

  it("parses Xiaomi's A-series, which the detector never even claimed", () => {
    expect(idOf("شاومي ايه 5، 4 جي، 128 جيجا، 4 جيجا رام، أسود", "", "شاومي").key)
      .toBe("xiaomi|Xiaomi A|5|Standard|128");
  });

  it("keeps Redmi and Xiaomi A-series apart", () => {
    expect(idOf("شاومي ايه 5، 128 جيجا", "", "شاومي").key)
      .not.toBe(idOf("ريدمي 5، 128 جيجا", "", "شاومي").key);
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
