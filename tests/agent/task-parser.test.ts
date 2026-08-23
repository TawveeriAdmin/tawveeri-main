/**
 * Saudi Agent Benchmark — natural-language task parser (deterministic, AR + EN).
 * Verifies free-text shopping tasks are parsed into structured ShoppingTasks with
 * correct category/size/priorities/budget/connectivity, and that unresolvable
 * fields are reported (fail-loud), never guessed.
 */
import { parseShoppingTask, sizeSatisfiesComparator } from "../../src/lib/agent/task-parser";

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

  // MEASURED DEFECT (2026-08-10, D→E mission Part C live verification): the founder's own
  // Part C example phrase "ابيه 16 رام" — bare digit + رام, no جيجا/gb unit word between —
  // did not parse a ram_min signal at all, which meant it fell through to a literal 2-result
  // catalog search instead of NEEDS_DISCOVERY/advisory. "16 رام" (no جيجا) is at least as
  // common in Saudi colloquial phrasing as "16 جيجا رام".
  it("laptop ram: bare 'N رام' (no جيجا/gb unit word) still parses — the founder's own Part C phrase", () => {
    expect((parseShoppingTask("ابيه لابتوب 16 رام") as { ram_min?: number }).ram_min).toBe(16);
    expect((parseShoppingTask("لابتوب رام 8") as { ram_min?: number }).ram_min).toBe(8);
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

// Intent Router follow-up #2 (ADR-270 consolidated list, ADR-271's own MEASURED gap,
// 2026-08-23): «قيقا»/«قيغا» is the everyday-typed dialect spelling of «جيجا» — previously
// unrecognized by parseStorageMin, so a mobile/tablet/laptop query using it carried NO
// storage_min signal at all («جوال ايفون 128 قيغا» parsed storage_min: undefined).
describe("Task parser — storage dialect spelling (قيقا/قيغا)", () => {
  it("«قيغا» parses the same as «جيجا»", () => {
    expect(parseShoppingTask("جوال 128 قيغا").storage_min).toBe(128);
  });
  it("«قيقا» parses the same as «جيجا»", () => {
    expect(parseShoppingTask("جوال 128 قيقا تحت 3500").storage_min).toBe(128);
  });
  it("does not regress the existing جيجا/gb spellings", () => {
    expect(parseShoppingTask("جوال 128 جيجا").storage_min).toBe(128);
    expect(parseShoppingTask("phone 128gb").storage_min).toBe(128);
  });
});

// Intent Router follow-up #3 (ADR-270 consolidated list, "»65 inch«-style comparator
// parsing", 2026-08-23): equality-only before this fix — «تلفزيون فوق 65 بوصة» extracted
// requested=65 with no way to record that ">65" and "=65" are different claims.
describe("Task parser — screen-size comparator", () => {
  it("a plain size with no comparator word defaults to eq", () => {
    const t = parseShoppingTask("تلفزيون 65 بوصة");
    expect(t.screen_size_requested).toBe(65);
    expect(t.screen_size_comparator).toBe("eq");
  });
  it("«فوق»/«أكثر من» before the size → gt", () => {
    expect(parseShoppingTask("تلفزيون سامسونج فوق 65 بوصة").screen_size_comparator).toBe("gt");
    expect(parseShoppingTask("تلفزيون أكثر من 55 بوصة").screen_size_comparator).toBe("gt");
  });
  it("«أقل من»/«تحت» before the size → lt", () => {
    expect(parseShoppingTask("تلفزيون أقل من 55 بوصة").screen_size_comparator).toBe("lt");
    expect(parseShoppingTask("تلفزيون تحت 43 بوصة").screen_size_comparator).toBe("lt");
  });
  it("«فأكثر»/«أو أكثر» after the size → gte; «فأقل»/«أو أقل» after → lte", () => {
    expect(parseShoppingTask("تلفزيون 65 بوصة فأكثر").screen_size_comparator).toBe("gte");
    expect(parseShoppingTask("تلفزيون 65 بوصة أو أكثر").screen_size_comparator).toBe("gte");
    expect(parseShoppingTask("تلفزيون 55 بوصة فأقل").screen_size_comparator).toBe("lte");
  });
  it("a comparator word ELSEWHERE in the sentence, unrelated to the size, is not misread", () => {
    // "أرخص من قبل" (cheaper than before) has "من" nearby but no size-adjacent comparator.
    const t = parseShoppingTask("ابي تلفزيون 55 بوصة وسعره أرخص من قبل");
    expect(t.screen_size_comparator).toBe("eq");
  });
  it("non-TV categories never carry a screen-size comparator", () => {
    const t = parseShoppingTask("لابتوب فوق 15 بوصة");
    expect(t.screen_size_comparator).toBeUndefined();
  });
});

describe("sizeSatisfiesComparator", () => {
  it("eq: only an exact match satisfies", () => {
    expect(sizeSatisfiesComparator(65, "eq", 65)).toBe(true);
    expect(sizeSatisfiesComparator(55, "eq", 65)).toBe(false);
  });
  it("gt: strictly greater only — the exact requested value does NOT satisfy", () => {
    expect(sizeSatisfiesComparator(75, "gt", 65)).toBe(true);
    expect(sizeSatisfiesComparator(65, "gt", 65)).toBe(false); // the exact ADR-270 gap this closes
    expect(sizeSatisfiesComparator(55, "gt", 65)).toBe(false);
  });
  it("gte/lt/lte", () => {
    expect(sizeSatisfiesComparator(65, "gte", 65)).toBe(true);
    expect(sizeSatisfiesComparator(55, "lt", 65)).toBe(true);
    expect(sizeSatisfiesComparator(65, "lt", 65)).toBe(false);
    expect(sizeSatisfiesComparator(65, "lte", 65)).toBe(true);
  });
});

// Intent Router follow-up #3, budget-floor half ("and budget where not already handled" —
// `parseBudget` is ceiling-only by construction; «فوق»/«أكثر من» was entirely unparsed).
describe("Task parser — budget floor (budget_min)", () => {
  it("«فوق 2000»/«أكثر من 2000 ريال» parse budget_min, never budget_total's ceiling meaning", () => {
    const t1 = parseShoppingTask("مكيف فوق 2000 ريال");
    expect(t1.budget_min).toBe(2000);
    const t2 = parseShoppingTask("لابتوب أكثر من 3000");
    expect(t2.budget_min).toBe(3000);
  });
  it("a plain ceiling query never sets budget_min", () => {
    expect(parseShoppingTask("مكيف تحت 2000 ريال").budget_min).toBeUndefined();
  });
});

// Intent Router item 5 (ADR-270 consolidated list #4/#5, 2026-08-23): «غسالة 12 كيلو» /
// «ثلاجة 450 لتر» / «غسالة صحون 14 طقم» previously carried NO capacity field at all — this
// closes the exact gap ADR-270's own follow-up list named for washer kg and fridge liters,
// plus the same-class dishwasher place-setting gap.
describe("Task parser — capacity (washer kg / fridge liters / dishwasher place settings)", () => {
  it("washer: «غسالة 12 كيلو» parses capacity_kg_requested", () => {
    expect(parseShoppingTask("غسالة 12 كيلو").capacity_kg_requested).toBe(12);
    expect(parseShoppingTask("غسالة 8 كجم للعائلة").capacity_kg_requested).toBe(8);
  });
  it("fridge: «ثلاجة 450 لتر» parses capacity_liters_requested", () => {
    expect(parseShoppingTask("ثلاجة 450 لتر").capacity_liters_requested).toBe(450);
  });
  it("dishwasher: «غسالة صحون 14 طقم» parses capacity_settings_requested", () => {
    expect(parseShoppingTask("غسالة صحون 14 طقم").capacity_settings_requested).toBe(14);
    expect(parseShoppingTask("غسالة صحون 12 مكان").capacity_settings_requested).toBe(12);
  });
  it("fields are category-gated — a capacity phrase on the WRONG category is never set", () => {
    // "12 كيلو" said about a laptop (nonsensical, but must not leak into the washer field)
    expect(parseShoppingTask("لابتوب 12 كيلو").capacity_kg_requested).toBeUndefined();
    expect(parseShoppingTask("تلفزيون 450 لتر").capacity_liters_requested).toBeUndefined();
  });
  it("a bare category with no capacity stated leaves the field unset", () => {
    expect(parseShoppingTask("غسالة رخيصة").capacity_kg_requested).toBeUndefined();
    expect(parseShoppingTask("ثلاجة كبيرة").capacity_liters_requested).toBeUndefined();
    expect(parseShoppingTask("غسالة صحون هادئة").capacity_settings_requested).toBeUndefined();
  });
  it("out-of-plausible-range values are rejected, not silently accepted", () => {
    expect(parseShoppingTask("غسالة 99 كيلو").capacity_kg_requested).toBeUndefined();
    expect(parseShoppingTask("ثلاجة 5 لتر").capacity_liters_requested).toBeUndefined();
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

  // MEASURED DEFECT (2026-08-10, D→E mission Part F — re-verification sweep after the
  // English routing fix): bare "phone" was never recognized as the mobile category at all —
  // only "smartphone"/"iphone"/"galaxy s" — even though it is at least as common in English
  // shopping queries ("phone with 128gb storage under 1500" returned zero results in
  // production because category never resolved, not because of the routing bug fixed
  // earlier this session).
  it('recognizes bare "phone" as mobile, without false-firing inside headphone', () => {
    expect(parseShoppingTask("phone with 128gb storage under 1500").category).toBe("mobile");
    expect(parseShoppingTask("best phone under 2000").category).toBe("mobile");
    // "headphone" is caught by the (earlier-checked) audio category regex before mobile's
    // \bphone\b ever runs — but confirm the end result is still never "mobile".
    expect(parseShoppingTask("wireless headphones under 500").category).not.toBe("mobile");
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

// MEASURED DEFECT (Waffar decision-engine audit): «شباك رخيص»/«سبليت»/«مخفي»/«كاسيت»/«دولابي»
// all resolved category=air_conditioner but the sub-type word itself vanished — `decideAc()`
// had no field to read it from. This regression pins the parser half of the fix: the type must
// land on `ac_type`, using the SAME canonical vocabulary `scripts/tps-plugins/ac/parser.ts`
// writes to `attributes.ac_type` (window/split/ducted/cassette/cabinet).
describe("Task parser — AC type regression", () => {
  it("extracts ac_type for every stated Arabic sub-type", () => {
    expect(parseShoppingTask("شباك رخيص").ac_type).toBe("window");
    expect(parseShoppingTask("مكيف سبليت").ac_type).toBe("split");
    expect(parseShoppingTask("مكيف مخفي").ac_type).toBe("ducted");
    expect(parseShoppingTask("مكيف كاسيت").ac_type).toBe("cassette");
    expect(parseShoppingTask("مكيف دولابي").ac_type).toBe("cabinet");
  });
  it("extracts ac_type for the English equivalents", () => {
    expect(parseShoppingTask("cheap window ac").ac_type).toBe("window");
    expect(parseShoppingTask("split ac unit").ac_type).toBe("split");
    expect(parseShoppingTask("ducted ac system").ac_type).toBe("ducted");
    expect(parseShoppingTask("cassette ac").ac_type).toBe("cassette");
  });
  it("leaves ac_type undefined when no type is stated (no regression)", () => {
    expect(parseShoppingTask("مكيف رخيص لغرفة 30 متر").ac_type).toBeUndefined();
    expect(parseShoppingTask("مكيف تحت 4000").ac_type).toBeUndefined();
  });
  // Deliberately NOT gated on `category === "air_conditioner"` (see the doc comment on
  // `ac_type` in `parseShoppingTask`): "شباك رخيص" alone resolves no category at all
  // deterministically (`parseCategory` requires "مكيف"/"تكييف" — a bare type word is
  // genuinely ambiguous, e.g. «شباك التذاكر» "ticket window", and is correctly left for the
  // route's semantic fallback to classify from full sentence context, same as any other
  // uncategorized text). `ac_type` still needs to survive that gap because it is read
  // nowhere except `decideAc`, which never runs unless category resolves to
  // `air_conditioner` — so a stray `ac_type` on an unrelated category is inert, not a leak.
  it("still extracts ac_type when the bare type word leaves category unresolved (no gating regression)", () => {
    const t = parseShoppingTask("شباك رخيص");
    expect(t.category).toBe("");
    expect(t.ac_type).toBe("window");
  });
});

// MEASURED DEFECT (Waffar sub-type audit, 2026-08-21): the same "explicit sub-type mentioned,
// completely ignored" pattern found in AC also existed in refrigerator/washing_machine/tv/AC-
// tech — none of these fields had a task-parser entry at all before this fix.
describe("Task parser — AC compressor tech regression (انفرتر/غير انفرتر)", () => {
  it("extracts wants_inverter=true for explicit inverter requests", () => {
    expect(parseShoppingTask("مكيف انفرتر رخيص").wants_inverter).toBe(true);
    expect(parseShoppingTask("مكيف إنفرتر").wants_inverter).toBe(true);
    expect(parseShoppingTask("inverter ac cheap").wants_inverter).toBe(true);
  });
  it("extracts wants_inverter=false ONLY for the explicit non-inverter vocabulary, never bare «عادي»", () => {
    expect(parseShoppingTask("مكيف غير انفرتر").wants_inverter).toBe(false);
    expect(parseShoppingTask("non-inverter ac").wants_inverter).toBe(false);
    expect(parseShoppingTask("مكيف أون أوف").wants_inverter).toBe(false);
    // «عادي» alone is deliberately NOT read as non-inverter (too ambiguous — mirrors the
    // ingest parser's own restraint, see parseAcInverterPref's doc comment).
    expect(parseShoppingTask("مكيف عادي رخيص").wants_inverter).toBeUndefined();
  });
  it("leaves wants_inverter undefined with no tech word stated (no regression)", () => {
    expect(parseShoppingTask("مكيف رخيص لغرفة 30 متر").wants_inverter).toBeUndefined();
  });
});

describe("Task parser — refrigerator type regression", () => {
  it("extracts fridge_type for every stated Arabic/English configuration", () => {
    expect(parseShoppingTask("ثلاجة باب واحد رخيصة").fridge_type).toBe("single_door");
    expect(parseShoppingTask("ثلاجة side by side رخيصة").fridge_type).toBe("side_by_side");
    expect(parseShoppingTask("ثلاجة فرنش رخيصة").fridge_type).toBe("french_door");
    expect(parseShoppingTask("ثلاجة فريزر علوي رخيصة").fridge_type).toBe("top_mount");
    expect(parseShoppingTask("ثلاجة فريزر سفلي رخيصة").fridge_type).toBe("bottom_mount");
  });
  it("leaves fridge_type undefined with no configuration stated (no regression)", () => {
    expect(parseShoppingTask("ثلاجة رخيصة كبيرة").fridge_type).toBeUndefined();
  });
  it("does NOT read a bare size preference («ثلاجة صغيرة») as single_door", () => {
    expect(parseShoppingTask("ثلاجة صغيرة رخيصة").fridge_type).toBeUndefined();
  });
});

describe("Task parser — washing machine type regression", () => {
  it("extracts washer_type for front/top load, Arabic and English", () => {
    expect(parseShoppingTask("غسالة أمامية رخيصة").washer_type).toBe("front_load");
    expect(parseShoppingTask("غسالة علوية رخيصة").washer_type).toBe("top_load");
    expect(parseShoppingTask("front load washer").washer_type).toBe("front_load");
    expect(parseShoppingTask("top load washer").washer_type).toBe("top_load");
  });
  it("leaves washer_type undefined with no configuration stated (no regression)", () => {
    expect(parseShoppingTask("غسالة رخيصة كبيرة").washer_type).toBeUndefined();
  });
});

describe("Task parser — TV panel regression", () => {
  it("extracts tv_panel for the stated panel tech, most-specific first", () => {
    expect(parseShoppingTask("تلفزيون OLED رخيص").tv_panel).toBe("oled");
    expect(parseShoppingTask("تلفزيون QLED رخيص").tv_panel).toBe("qled");
    expect(parseShoppingTask("تلفزيون Neo QLED رخيص").tv_panel).toBe("neo_qled");
    expect(parseShoppingTask("تلفزيون Mini LED رخيص").tv_panel).toBe("mini_led");
    expect(parseShoppingTask("تلفزيون LED رخيص").tv_panel).toBe("led");
  });
  it("leaves tv_panel undefined with no panel tech stated (no regression)", () => {
    expect(parseShoppingTask("تلفزيون 65 بوصة رخيص").tv_panel).toBeUndefined();
  });
});
