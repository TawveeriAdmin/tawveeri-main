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
