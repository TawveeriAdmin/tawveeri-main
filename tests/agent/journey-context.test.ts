/**
 * ONE TAWVEERI BRAIN (2026-08-09) — a shopper who searches «مكيف لغرفة 30 متر هادي تحت
 * 4000» and then opens a product must not lose that context when asking Waffar a follow-up
 * on the product page. These tests pin the two safety properties that make that safe:
 * category-scoped (never leaks a room/budget parsed for one category into another) and
 * time-bounded (a stale context is not silently reused as if it were the current need).
 *
 * No jsdom in this repo's Jest config (testEnvironment: 'node') — sessionStorage is stubbed
 * minimally rather than pulling in a browser environment for one small module.
 */
import { saveJourneyTask, readJourneyTask } from "@/lib/agent/journey-context";
import type { AdvisorParsed } from "@/lib/agent/advisor-api";

function stubSessionStorage() {
  const store: Record<string, string> = {};
  (global as unknown as { window: unknown }).window = {
    sessionStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
    },
  };
}

describe("journey-context — same-tab intent handoff (search → product page)", () => {
  beforeEach(() => stubSessionStorage());
  afterEach(() => { delete (global as unknown as { window?: unknown }).window; });

  it("round-trips a saved task for the SAME category", () => {
    const task: AdvisorParsed = { category: "air_conditioner", room_size_m2: 30, budget_total: 4000, priorities: ["quiet"] };
    saveJourneyTask(task);
    expect(readJourneyTask("air_conditioner")).toEqual(task);
  });

  it("never leaks context into a DIFFERENT category (an AC budget must not apply to a laptop)", () => {
    saveJourneyTask({ category: "air_conditioner", room_size_m2: 30, budget_total: 4000 });
    expect(readJourneyTask("laptop")).toBeNull();
  });

  it("does nothing when there is no category (nothing structured was actually understood)", () => {
    saveJourneyTask({});
    expect(readJourneyTask("air_conditioner")).toBeNull();
  });

  it("does not throw when sessionStorage is unavailable (SSR / privacy mode) — best-effort only", () => {
    delete (global as unknown as { window?: unknown }).window;
    expect(() => saveJourneyTask({ category: "air_conditioner" })).not.toThrow();
    expect(readJourneyTask("air_conditioner")).toBeNull();
  });

  it("a stale (>45min) saved task is not carried forward", () => {
    const rawKey = "tawveeri:journey_task";
    const stale = { task: { category: "air_conditioner", budget_total: 4000 }, savedAt: Date.now() - 46 * 60_000 };
    (window as unknown as { sessionStorage: Storage }).sessionStorage.setItem(rawKey, JSON.stringify(stale));
    expect(readJourneyTask("air_conditioner")).toBeNull();
  });

  it("a fresh saved task IS carried forward", () => {
    const rawKey = "tawveeri:journey_task";
    const fresh = { task: { category: "air_conditioner", budget_total: 4000 }, savedAt: Date.now() - 5 * 60_000 };
    (window as unknown as { sessionStorage: Storage }).sessionStorage.setItem(rawKey, JSON.stringify(fresh));
    expect(readJourneyTask("air_conditioner")).toEqual({ category: "air_conditioner", budget_total: 4000 });
  });
});
