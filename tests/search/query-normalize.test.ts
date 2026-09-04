// tests/search/query-normalize.test.ts
// ADR-064 gate. Fixtures are the exact Saudi queries that returned ZERO results
// against the live index on 2026-07-23.
import { normalizeSearchQuery, SAUDI_SEARCH_SYNONYMS } from "@/lib/search/query-normalize";

describe("query normalization", () => {
  it("folds Arabic-Indic digits — the proven zero-result cause", () => {
    // "آيفون ١٧ برو ماكس" returned 0 hits while "ايفون 17" worked.
    expect(normalizeSearchQuery("آيفون ١٧ برو ماكس")).toBe("ايفون 17 برو ماكس");
    expect(normalizeSearchQuery("٢٥٦ جيجا")).toBe("256 جيجا");
  });

  it("splits an Arabic word glued to a number (no-space queries) — ADR-112", () => {
    // "ايفون17" returned 1 hit; Saudi shoppers routinely omit the space.
    expect(normalizeSearchQuery("ايفون17")).toBe("ايفون 17");
    expect(normalizeSearchQuery("شاشة65بوصة")).toBe("شاشة 65 بوصة");
    expect(normalizeSearchQuery("جوال15برو")).toBe("جوال 15 برو");
  });

  it("NEVER splits a Latin model code (would shatter S25 / A17 / SM-X200)", () => {
    expect(normalizeSearchQuery("s25 ultra")).toBe("s25 ultra");
    expect(normalizeSearchQuery("SM-X200")).toBe("SM-X200");
    expect(normalizeSearchQuery("iphone17")).toBe("iphone17");
  });

  it("folds hamza forms so every spelling reaches the same catalogue text", () => {
    const target = normalizeSearchQuery("ايفون");
    for (const v of ["أيفون", "آيفون", "ٱيفون"]) expect(normalizeSearchQuery(v)).toBe(target);
  });

  it("strips diacritics and tatweel", () => {
    expect(normalizeSearchQuery("جـــوال")).toBe("جوال");
    expect(normalizeSearchQuery("مُكيِّف")).toBe("مكيف");
  });

  it("leaves ة alone — the engine's Arabic analyzer folds it on both sides", () => {
    expect(normalizeSearchQuery("غسالة")).toBe("غسالة");
  });

  it("collapses whitespace without dropping or adding words", () => {
    expect(normalizeSearchQuery("  ايفون   17  برو  ")).toBe("ايفون 17 برو");
  });

  it("never rewrites what the shopper asked for", () => {
    // Only character folding — word count must be preserved.
    const q = "samsung galaxy s25 ultra 256gb";
    expect(normalizeSearchQuery(q).split(" ")).toHaveLength(q.split(" ").length);
    expect(normalizeSearchQuery(q)).toBe(q);
  });

  it("is idempotent and safe on empty input", () => {
    const once = normalizeSearchQuery("آيفون ١٧");
    expect(normalizeSearchQuery(once)).toBe(once);
    expect(normalizeSearchQuery("")).toBe("");
  });
});

describe("Saudi shopping vocabulary", () => {
  it("covers the colloquial words that returned zero results", () => {
    const flat = SAUDI_SEARCH_SYNONYMS.flat();
    for (const word of ["جوال", "شاشة", "رخيص", "اتوماتيك"]) expect(flat).toContain(word);
  });

  it("links each colloquial word to the term the catalogue actually uses", () => {
    const groupFor = (w: string) => SAUDI_SEARCH_SYNONYMS.find((g) => g.includes(w)) ?? [];
    expect(groupFor("جوال")).toEqual(expect.arrayContaining(["mobile", "phone"]));
    expect(groupFor("شاشة")).toEqual(expect.arrayContaining(["tv", "تلفزيون"]));
    expect(groupFor("مكيف")).toEqual(expect.arrayContaining(["air conditioner"]));
  });

  it("has no duplicate term across groups — that would make relevance ambiguous", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const g of SAUDI_SEARCH_SYNONYMS) for (const t of g) {
      if (seen.has(t)) dupes.push(t); else seen.add(t);
    }
    expect(dupes).toEqual([]);
  });

  it("every group is usable — at least two interchangeable terms", () => {
    for (const g of SAUDI_SEARCH_SYNONYMS) expect(g.length).toBeGreaterThanOrEqual(2);
  });

  // 30-day production study (2026-08-30): the catalog carries 69 Honor products
  // (Honor Pad 10 alone drew 20 real merchant exits from a correctly-spelled
  // search) but real shopper spellings — تابلت هورنر, Honer تابلت, Horno ipad,
  // Ipad Horno — matched none of them. Genuine retrieval failure, not a
  // catalog gap; fixed the same way every other colloquial-vocabulary gap in
  // this file was fixed, via a synonym group, never fuzzy matching.
  it("links every real shopper misspelling of Honor to the catalogue spelling", () => {
    const groupFor = (w: string) => SAUDI_SEARCH_SYNONYMS.find((g) => g.includes(w)) ?? [];
    for (const misspelling of ["هونر", "هورنر", "هونور", "honer", "horno"]) {
      expect(groupFor(misspelling)).toEqual(expect.arrayContaining(["honor"]));
    }
  });

  // Amazon Decision Layer V2 (2026-09-04) §10: "كاتل" sits one edit from "كابل"
  // (cable) so Algolia's default typo tolerance pulled cable-accessory noise into an
  // electric-kettle query. "غلاية"/"غلاية كهربائية" themselves already return genuine
  // catalog results (confirmed live) — the gap is purely that "كاتل" never reached
  // them. An explicit synonym (not a typo-tolerance change) is additive and specific:
  // it does not touch how any OTHER word's fuzzy matching behaves.
  it("links كاتل to the electric-kettle vocabulary, not left to typo tolerance alone", () => {
    const groupFor = (w: string) => SAUDI_SEARCH_SYNONYMS.find((g) => g.includes(w)) ?? [];
    expect(groupFor("كاتل")).toEqual(expect.arrayContaining(["غلاية", "kettle"]));
  });
});
