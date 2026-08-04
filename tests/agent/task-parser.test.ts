/**
 * Saudi Agent Benchmark — natural-language task parser (deterministic, AR + EN).
 * Verifies free-text shopping tasks are parsed into structured ShoppingTasks with
 * correct category/size/priorities/budget/connectivity, and that unresolvable
 * fields are reported (fail-loud), never guessed.
 */
import { parseShoppingTask } from "../../src/lib/agent/task-parser";

describe("Task parser — Arabic flagship AC task", () => {
  const t = parseShoppingTask("أبغى مكيف لغرفة 30 متر في الرياض، هادئ وموفر للكهرباء، تحت 4000 ريال");
  it("extracts category, room size, city", () => {
    expect(t.category).toBe("air_conditioner");
    expect(t.room_size_m2).toBe(30);
    expect(t.city).toBe("Riyadh");
  });
  it("extracts priorities and budget", () => {
    expect(t.priorities).toEqual(expect.arrayContaining(["quiet", "low_electricity"]));
    expect(t.budget_total).toBe(4000);
  });
  it("reports no unresolved fields for a complete AC task", () => {
    expect(t.unresolved).toBeUndefined();
  });
});

describe("Task parser — English + other categories", () => {
  it("English AC task", () => {
    const t = parseShoppingTask("I need a quiet, energy saving AC for a 24 m2 bedroom under 3500 SAR");
    expect(t.category).toBe("air_conditioner");
    expect(t.room_size_m2).toBe(24);
    expect(t.priorities).toEqual(expect.arrayContaining(["quiet", "low_electricity"]));
    expect(t.budget_total).toBe(3500);
  });
  it("TV gaming task", () => {
    const t = parseShoppingTask("تلفزيون للألعاب والأفلام تحت 3000");
    expect(t.category).toBe("tv");
    expect(t.priorities).toEqual(expect.arrayContaining(["gaming", "movies"]));
    expect(t.budget_total).toBe(3000);
  });
  it("laptop gaming + portability + ram", () => {
    const t = parseShoppingTask("لابتوب للألعاب خفيف 16 جيجا رام تحت 5000");
    expect(t.category).toBe("laptop");
    expect(t.priorities).toEqual(expect.arrayContaining(["gaming", "portability"]));
    expect((t as { ram_min?: number }).ram_min).toBe(16);
    expect(t.budget_total).toBe(5000);
  });
  it("recognizes refrigerator and washing machine categories", () => {
    expect(parseShoppingTask("ثلاجة كبيرة").category).toBe("refrigerator");
    expect(parseShoppingTask("غسالة أوتوماتيك").category).toBe("washing_machine");
  });
  it("recognizes all config-factory appliance categories", () => {
    expect(parseShoppingTask("غسالة صحون 14 مكان").category).toBe("dishwasher");
    expect(parseShoppingTask("مايكرويف 30 لتر").category).toBe("microwave");
    expect(parseShoppingTask("مكنسة روبوت").category).toBe("vacuum");
    expect(parseShoppingTask("منقي هواء للغرفة").category).toBe("air_purifier");
    expect(parseShoppingTask("ماكينة قهوة اسبريسو").category).toBe("coffee_maker");
    expect(parseShoppingTask("غلاية كهربائية").category).toBe("kettle");
    expect(parseShoppingTask("قلاية هوائية 8 لتر").category).toBe("air_fryer");
    expect(parseShoppingTask("محمصة خبز").category).toBe("toaster");
    expect(parseShoppingTask("خلاط قوي").category).toBe("blender");
    expect(parseShoppingTask("فرن كهربائي مدمج").category).toBe("oven");
  });
  it("disambiguates dishwasher from washing machine (both contain غسالة)", () => {
    expect(parseShoppingTask("غسالة صحون").category).toBe("dishwasher");
    expect(parseShoppingTask("غسالة ملابس").category).toBe("washing_machine");
  });
  it("parses a large/family intent", () => {
    expect(parseShoppingTask("غسالة صحون كبيرة للعائلة").priorities).toEqual(expect.arrayContaining(["large"]));
  });
  it("tablet with cellular + storage", () => {
    const t = parseShoppingTask("ابغى تابلت للانتاجية يدعم شريحة 256 جيجا");
    expect(t.category).toBe("tablet");
    expect(t.connectivity_needed).toBe("cellular");
    expect(t.storage_min).toBe(256);
    expect(t.use).toEqual(expect.arrayContaining(["productivity"]));
  });
});

describe("Task parser — fail-loud on unresolvable input", () => {
  it("undetectable category → empty category + unresolved flag", () => {
    const t = parseShoppingTask("أبغى شيء حلو");
    expect(t.category).toBe("");
    expect(t.unresolved).toEqual(expect.arrayContaining(["category"]));
  });
  it("AC without a room size flags room_size_m2 unresolved", () => {
    const t = parseShoppingTask("مكيف موفر للكهرباء");
    expect(t.category).toBe("air_conditioner");
    expect(t.unresolved).toEqual(expect.arrayContaining(["room_size_m2"]));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression — the «ابي 3 مكيفات بميزانيتي 5000 ريال» production defect
// (docs/baselines/2026-08-04-ac-basket-query). Budget: the attached-morpheme form
// «بميزانيتي» and the Arabic-letter `\b` trap after «ريال» both silently dropped the
// budget, so no need signal fired and the advisor was never routed. Quantity: no field
// existed at all. These pin the extraction layer that measurement showed failing.
// ─────────────────────────────────────────────────────────────────────────────
describe("Task parser — basket query regression (2026-08-04)", () => {
  it("parses the exact failing production query: category + budget + quantity", () => {
    const t = parseShoppingTask("ابي 3 مكيفات بميزانيتي 5000 ريال");
    expect(t.category).toBe("air_conditioner");
    expect(t.budget_total).toBe(5000);
    expect(t.quantity).toBe(3);
  });
  it("parses «بميزانيتي N» and bare «N ريال» (Arabic-boundary trap)", () => {
    expect(parseShoppingTask("مكيف بميزانيتي 3000").budget_total).toBe(3000);
    expect(parseShoppingTask("مكيف 2500 ريال").budget_total).toBe(2500);
    expect(parseShoppingTask("ثلاجة بميزانية 4000 ريال").budget_total).toBe(4000);
  });
  it("parses Arabic-Indic numerals in the same sentence", () => {
    const t = parseShoppingTask("ابي ٣ مكيفات بميزانيتي ٥٠٠٠ ريال");
    expect(t.budget_total).toBe(5000);
    expect(t.quantity).toBe(3);
  });
  it("parses the English equivalent", () => {
    const t = parseShoppingTask("I want 3 air conditioners with a budget of 5000 SAR");
    expect(t.category).toBe("air_conditioner");
    expect(t.budget_total).toBe(5000);
    expect(t.quantity).toBe(3);
  });
  it("never misreads a spec/budget number as a quantity", () => {
    expect(parseShoppingTask("مكيف 24000 وحدة").quantity).toBeUndefined();      // BTU
    expect(parseShoppingTask("شاشة 65 بوصة").quantity).toBeUndefined();         // inches
    expect(parseShoppingTask("مكيف تحت 4000").quantity).toBeUndefined();        // budget
    expect(parseShoppingTask("ايفون 15").quantity).toBeUndefined();             // model
  });
  it("quantity requires the category noun to follow the number", () => {
    expect(parseShoppingTask("ابي 2 جوال").quantity).toBe(2);
    expect(parseShoppingTask("جوال 12 جيجا رام").quantity).toBeUndefined();
  });
});

describe("Task parser — plural category forms (matrix 2026-08-04)", () => {
  it("classifies bare plurals that previously returned no category", () => {
    expect(parseShoppingTask("ثلاجات").category).toBe("refrigerator");
    expect(parseShoppingTask("غسالات").category).toBe("washing_machine");
    expect(parseShoppingTask("شاشات").category).toBe("tv");
  });
  it("keeps the dishwasher/washer split for plural and ه-spelled forms", () => {
    expect(parseShoppingTask("غسالات صحون").category).toBe("dishwasher");
    expect(parseShoppingTask("غساله صحون").category).toBe("dishwasher");
    expect(parseShoppingTask("غساله").category).toBe("washing_machine");
    expect(parseShoppingTask("ثلاجه").category).toBe("refrigerator");
  });
});
