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

// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN QUERY regression (2026-08-09): «مكيف لغرفة 30 متر هادي تحت 4000» — founder-reported,
// live-verified production defect. «مكيف لغرفة 30 متر» alone returned 496 results; adding
// «هادي» (quiet, no-hamza spelling) and/or «تحت 4000» collapsed it to 0 via
// `categoryEnforcedZero`. Root cause: `parseBudget`'s wrapper phrasings («تحت»/«بحدود»/
// «يتعدى») and `parsePriorities`' trigger words were never added to the search route's
// BUDGET_WRAPPER/PREFERENCE_WRAPPER strip sets, so they survived as literal REQUIRED
// relevance-group text no AC title contains. These pin the parser-layer half of the fix;
// the route-level strip sets are covered by the live before/after capture in the commit.
describe("Task parser — Golden Query regression (2026-08-09)", () => {
  it("parses budget for every wrapper phrasing parseBudget claims to support", () => {
    expect(parseShoppingTask("مكيف تحت 4000").budget_total).toBe(4000);
    expect(parseShoppingTask("مكيف اقل من 4000").budget_total).toBe(4000);
    expect(parseShoppingTask("مكيف أقل من 4000").budget_total).toBe(4000);
    expect(parseShoppingTask("مكيف بحدود 4000").budget_total).toBe(4000); // attached morpheme, same class as بميزانيتي
    expect(parseShoppingTask("مكيف في حدود 4000").budget_total).toBe(4000);
    expect(parseShoppingTask("مكيف ما يتعدى 4000").budget_total).toBe(4000);
  });
  it("recognizes «هادي» (no-hamza colloquial spelling) as the quiet priority, same as «هادئ»", () => {
    expect(parseShoppingTask("مكيف هادي").priorities).toEqual(expect.arrayContaining(["quiet"]));
    expect(parseShoppingTask("مكيف هادئ").priorities).toEqual(expect.arrayContaining(["quiet"]));
  });
  it("parses the full Golden Query: category + room size + budget, regardless of quiet spelling", () => {
    for (const q of [
      "مكيف لغرفة 30 متر هادي تحت 4000",
      "مكيف لغرفة 30 متر هادئ تحت 4000",
      "مكيف لغرفة 30 متر هادي بحدود 4000",
    ]) {
      const t = parseShoppingTask(q);
      expect(t.category).toBe("air_conditioner");
      expect(t.room_size_m2).toBe(30);
      expect(t.budget_total).toBe(4000);
      expect(t.priorities).toEqual(expect.arrayContaining(["quiet"]));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10-JOURNEY ACCEPTANCE SWEEP regression (2026-08-09, founder Unified Intelligence
// mission): live production testing of the laptop/mobile decision journeys found real
// priority-RECOGNITION gaps (distinct from the search-route relevance-stripping gaps
// fixed in the same pass — those pin the search-route side; these pin the parser side).
// ─────────────────────────────────────────────────────────────────────────────
describe("Task parser — 10-journey acceptance sweep (2026-08-09)", () => {
  it("recognizes «بطاريته»/«بطاريتها» (possessive battery) as the battery priority, same as bare «بطارية»", () => {
    // MEASURED: بطارية → بطاريته shifts the final ة to ت before a possessive pronoun
    // attaches, so the bare substring «بطارية» is never present in the possessive form —
    // the golden acceptance query «جوال …وبطاريته قوية…» produced NO battery priority at
    // all before this fix.
    expect(parseShoppingTask("جوال بطاريته قوية").priorities).toEqual(expect.arrayContaining(["battery"]));
    expect(parseShoppingTask("جوال بطاريتها قوية").priorities).toEqual(expect.arrayContaining(["battery"]));
    expect(parseShoppingTask("جوال بطارية قوية").priorities).toEqual(expect.arrayContaining(["battery"])); // unchanged
  });
  it("«تصويره» (possessive camera/photography) already matched via substring containment — no regression", () => {
    expect(parseShoppingTask("جوال تصويره ممتاز").priorities).toEqual(expect.arrayContaining(["camera"]));
  });
  it("recognizes «دراسة»/«برمجة» (study/programming) as the productivity priority", () => {
    expect(parseShoppingTask("لابتوب للدراسة").priorities).toEqual(expect.arrayContaining(["productivity"]));
    expect(parseShoppingTask("لابتوب للبرمجة").priorities).toEqual(expect.arrayContaining(["productivity"]));
  });
  it("parses the full laptop decision journey: category + budget + priorities", () => {
    const t = parseShoppingTask("أبي لابتوب للدراسة والبرمجة وميزانيتي 3500 وخفيف");
    expect(t.category).toBe("laptop");
    expect(t.budget_total).toBe(3500);
    expect(t.priorities).toEqual(expect.arrayContaining(["productivity", "portability"]));
  });
  it("parses the full mobile decision journey: category + camera + battery + budget", () => {
    const t = parseShoppingTask("أبي جوال تصويره ممتاز وبطاريته قوية تحت 2500");
    expect(t.category).toBe("mobile");
    expect(t.budget_total).toBe(2500);
    expect(t.priorities).toEqual(expect.arrayContaining(["camera", "battery"]));
  });
  it("household size («لعائلة 6 أشخاص») is a soft «large» preference, never an invented exact capacity", () => {
    // Governing rule (founder direction): household size is USE CONTEXT, not a fabricated
    // liters/kg requirement — the parser must not invent a numeric capacity target from it.
    const washer = parseShoppingTask("أبي غسالة لعائلة 6 أشخاص هادية وموفرة وميزانيتي 3000");
    expect(washer.priorities).toEqual(expect.arrayContaining(["large", "quiet", "low_electricity"]));
    const fridge = parseShoppingTask("أبي ثلاجة لعائلة 6 أشخاص كبيرة وموفرة تحت 5000");
    expect(fridge.priorities).toEqual(expect.arrayContaining(["large", "low_electricity"]));
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

// NEGATION POLARITY (2026-08-09, D→E mission, Section 7 — the founder's own production
// failure). MEASURED: «ابي جوال تصويره ممتاز وبطاريته قوية وميزانيتي 3000 ريال وما يهمني
// الألعاب» recorded "gaming" as a POSITIVE priority — the exact opposite of what the shopper
// said. These pin the fix and the distinction the mission's own examples draw between a
// neutral dismissal («ما يهمني») and an active rejection («ما أبي»/«بدون»).
describe("Task parser — negation polarity (2026-08-09)", () => {
  it("THE FOUNDER'S EXACT SENTENCE: gaming is de-prioritized, never a positive priority", () => {
    const t = parseShoppingTask("ابي جوال تصويره ممتاز وبطاريته قوية وميزانيتي 3000 ريال وما يهمني الألعاب");
    expect(t.category).toBe("mobile");
    expect(t.budget_total).toBe(3000);
    expect(t.priorities).toEqual(expect.arrayContaining(["camera", "battery"]));
    expect(t.priorities).not.toContain("gaming"); // the regression: this used to be true
    expect(t.deprioritized_priorities).toEqual(expect.arrayContaining(["gaming"]));
  });

  it("«ما يهمني الوزن» — de-prioritizes portability, not a positive want", () => {
    const t = parseShoppingTask("لابتوب للألعاب ما يهمني الوزن");
    expect(t.priorities).not.toContain("portability");
    expect(t.deprioritized_priorities).toEqual(expect.arrayContaining(["portability"]));
    expect(t.priorities).toEqual(expect.arrayContaining(["gaming"])); // unrelated positive priority unaffected
  });

  it("«مو مهم الألعاب» — colloquial de-prioritize marker (not just «ما يهمني»)", () => {
    const t = parseShoppingTask("جوال تصويره ممتاز مو مهم الألعاب");
    expect(t.deprioritized_priorities).toEqual(expect.arrayContaining(["gaming"]));
    expect(t.priorities ?? []).not.toContain("gaming");
  });

  it("«ما أبي 5G» — EXCLUDE is a stronger polarity than de-prioritize, kept separate", () => {
    const t = parseShoppingTask("جوال ما أبي شريحة 5G");
    // connectivity words aren't in PRIORITY_KEYWORDS, so this specifically tests that an
    // "ما أبي" marker preceding an unrelated priority word (none here) does not crash and
    // that excluded_priorities is the field EXCLUDE polarity lands in when it does match —
    // proven directly below with a keyword EXCLUDE actually fires on.
    void t;
    const t2 = parseShoppingTask("جوال ما أبي الألعاب");
    expect(t2.excluded_priorities).toEqual(expect.arrayContaining(["gaming"]));
    expect(t2.priorities ?? []).not.toContain("gaming");
    expect(t2.deprioritized_priorities ?? []).not.toContain("gaming");
  });

  it("a positive priority elsewhere in the same sentence as a negated one is unaffected", () => {
    const t = parseShoppingTask("جوال تصويره ممتاز وما يهمني الألعاب وبطاريته قوية");
    expect(t.priorities).toEqual(expect.arrayContaining(["camera", "battery"]));
    expect(t.deprioritized_priorities).toEqual(["gaming"]);
  });

  it("no negation present — unchanged positive-priority behavior (no regression)", () => {
    const t = parseShoppingTask("لابتوب للألعاب خفيف");
    expect(t.priorities).toEqual(expect.arrayContaining(["gaming", "portability"]));
    expect(t.deprioritized_priorities).toBeUndefined();
    expect(t.excluded_priorities).toBeUndefined();
  });
});

// MEASURED FAILURE (2026-08-09, D→E mission Section 11 category sweep): «غير الميزانية إلى
// 4000» — a bare CONSTRAINT_CHANGE turn with no category noun and no «ريال» suffix — parsed
// budget_total as undefined in 5 of 6 category journeys (laptop, tablet, washer, refrigerator,
// TV all hit this independently), because parseBudget required its marker word to be followed
// directly by whitespace+digits, or digits directly followed by «ريال». Neither held here: «إلى»
// sits between «ميزانية» and the number, and the sentence never states a currency at all.
describe("Task parser — CONSTRAINT_CHANGE absolute-target budget regression (2026-08-09)", () => {
  it("parses «X إلى N» budget phrasing with no currency word and no category noun", () => {
    expect(parseShoppingTask("غير الميزانية إلى 4000").budget_total).toBe(4000);
    expect(parseShoppingTask("غير الميزانية إلى 3200").budget_total).toBe(3200);
    expect(parseShoppingTask("خليها الميزانية إلى 6000").budget_total).toBe(6000);
  });
  it("still parses the original directly-adjacent phrasing (no regression)", () => {
    expect(parseShoppingTask("مكيف ميزانية 4000").budget_total).toBe(4000);
    expect(parseShoppingTask("مكيف تحت 4000").budget_total).toBe(4000);
  });
});

// MEASURED GAP (2026-08-10, D→E mission Part A — one of the founder's own named example
// follow-ups, «أبيه أهدأ»): the comparative form «أهدأ» ("quieter") matched none of the
// base-form quiet spellings, so this priority was silently dropped.
describe("Task parser — comparative-form priority regression (2026-08-10)", () => {
  it("recognizes «أهدأ» (comparative \"quieter\") as the quiet priority, same as the base form «هادئ»", () => {
    expect(parseShoppingTask("طيب أبيه أهدأ").priorities).toEqual(expect.arrayContaining(["quiet"]));
    expect(parseShoppingTask("مكيف اهدا شوي").priorities).toEqual(expect.arrayContaining(["quiet"]));
  });
});
