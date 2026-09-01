/**
 * @jest-environment jsdom
 */
// tests/analytics/track-dedup.test.ts
// ADR-282: client-side duplicate-fire guard in track.ts. Pins the defensive-layer behavior
// added after a confirmed production defect (August 2026) where a circular URL<->state sync
// effect in search-client.tsx caused at least 4 real sessions to fire the SAME search event
// 150-242 times inside under a minute — inflating category-demand counts by two orders of
// magnitude. The effect bug is fixed separately (search-client.tsx); this suite pins the
// generic choke-point guard in track() itself so the same CLASS of bug can never again
// silently inflate a founder-facing metric.
//
// @jest-environment jsdom

describe("track() duplicate-fire guard", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    window.localStorage.clear();
    document.cookie = "tw_sid=; path=/; max-age=0";
    document.cookie = "tw_test=; path=/; max-age=0";
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("suppresses an identical (event_type, query_text) fire repeated within the suppression window", async () => {
    const { track } = await import("../../src/lib/analytics/track");
    for (let i = 0; i < 50; i++) {
      track("search", { query_text: "مكيف", category: null });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT suppress a genuinely different query_text for the same event_type", async () => {
    const { track } = await import("../../src/lib/analytics/track");
    track("search", { query_text: "مكيف" });
    track("search", { query_text: "لابتوب" });
    track("search", { query_text: "ثلاجة" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT suppress go_click for two different products at the same store", async () => {
    const { track } = await import("../../src/lib/analytics/track");
    track("go_click", { canonical_id: "product-a", store: "3" });
    track("go_click", { canonical_id: "product-b", store: "3" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("DOES suppress a repeated go_click on the exact same product+store (the real double-click/render-loop case)", async () => {
    const { track } = await import("../../src/lib/analytics/track");
    track("go_click", { canonical_id: "product-a", store: "3" });
    track("go_click", { canonical_id: "product-a", store: "3" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows a repeat of the same query after the suppression window elapses", async () => {
    jest.useFakeTimers();
    const { track } = await import("../../src/lib/analytics/track");
    const realNow = Date.now;
    let now = 1_000_000;
    Date.now = () => now;
    try {
      track("search", { query_text: "مكيف" });
      now += 2000; // past the 1.5s suppression window
      track("search", { query_text: "مكيف" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      Date.now = realNow;
      jest.useRealTimers();
    }
  });

  it("different event types with the same query_text are tracked independently", async () => {
    const { track } = await import("../../src/lib/analytics/track");
    track("search", { query_text: "مكيف" });
    track("advisor_query", { query_text: "مكيف" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
