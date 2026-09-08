// Founder back-navigation audit (2026-09-08). See src/lib/search/url-sync-strategy.ts for the
// full defect: the search page's URL write-back effect used router.replace unconditionally
// (ADR-282), so a genuinely new search never earned its own history entry and browser Back
// skipped past it. This pins the push-vs-replace decision.
import { isNewSearchSubject } from "@/lib/search/url-sync-strategy";

describe("isNewSearchSubject — push a new history entry only for a genuinely new search", () => {
  it("is true on the very first run (no previous subject)", () => {
    expect(isNewSearchSubject(null, { q: "مكيف", cat: "ac" })).toBe(true);
  });

  it("is true when the query text changes (a distinct search, earns its own history entry)", () => {
    expect(isNewSearchSubject({ q: "مكيف", cat: "ac" }, { q: "لابتوب", cat: "ac" })).toBe(true);
  });

  it("is true when only the category changes", () => {
    expect(isNewSearchSubject({ q: "", cat: "all" }, { q: "", cat: "ac" })).toBe(true);
  });

  it("is false when the subject is unchanged — a filter/sort/page refinement (ADR-282: no history bloat)", () => {
    expect(isNewSearchSubject({ q: "مكيف", cat: "ac" }, { q: "مكيف", cat: "ac" })).toBe(false);
  });
});
