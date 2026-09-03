// tests/admin/command-center-queries.test.ts — funnel dedup, burst/concentration signal, and
// campaign-to-outbound attribution (ADR-214). Pure-function tests against synthetic fixtures —
// no production dependency. Real production numbers behind this fix: docs/DECISIONS.md ADR-214.
import {
  buildFunnel, topSessionSearchShare, computeCampaignAttribution, topDemand,
  topSearchTerms, unmetDemand,
  type UsageEventRow, type OutboundClickRow,
} from "../../src/lib/admin/command-center-queries";

function ev(overrides: Partial<UsageEventRow>): UsageEventRow {
  return {
    event_type: "search", session_id: "s1", is_test: false, source: "web",
    category: null, query_text: "iphone", canonical_id: null,
    created_at: "2026-08-05T10:00:00.000Z", meta: null,
    ...overrides,
  };
}

function click(overrides: Partial<OutboundClickRow>): OutboundClickRow {
  return {
    is_test: false, canonical_product_id: "prod-1", affiliate_program: "amazon",
    store_name: "amazon", clicked_at: "2026-08-05T10:00:05.000Z",
    ...overrides,
  };
}

describe("buildFunnel — same-action dedup (ADR-214)", () => {
  it("counts a search that also routes to the advisor (same session+query, <3s apart) as ONE search step", () => {
    const events = [
      ev({ event_type: "search", created_at: "2026-08-05T10:00:00.000Z" }),
      ev({ event_type: "advisor_query", created_at: "2026-08-05T10:00:00.050Z" }),
    ];
    expect(buildFunnel(events).search).toBe(1);
  });

  it("counts results+advisor_result for the same action as ONE results step", () => {
    const events = [
      ev({ event_type: "results", created_at: "2026-08-05T10:00:01.000Z" }),
      ev({ event_type: "advisor_result", created_at: "2026-08-05T10:00:03.000Z" }),
    ];
    const f = buildFunnel(events);
    expect(f.results).toBe(1);
    expect(f.noAnswer).toBe(0);
  });

  it("still counts a genuinely later re-search of the same text as a second action", () => {
    const events = [
      ev({ event_type: "search", created_at: "2026-08-05T10:00:00.000Z" }),
      ev({ event_type: "search", created_at: "2026-08-05T10:05:00.000Z" }), // 5 min later, same text
    ];
    expect(buildFunnel(events).search).toBe(2);
  });

  it("does not merge across different sessions or different query text", () => {
    const events = [
      ev({ event_type: "search", session_id: "s1", created_at: "2026-08-05T10:00:00.000Z" }),
      ev({ event_type: "advisor_query", session_id: "s2", created_at: "2026-08-05T10:00:00.100Z" }),
      ev({ event_type: "search", session_id: "s1", query_text: "laptop", created_at: "2026-08-05T10:00:00.200Z" }),
    ];
    expect(buildFunnel(events).search).toBe(3);
  });

  it("counts no_answer only when the action never reached results", () => {
    const noAnswerOnly = buildFunnel([ev({ event_type: "no_answer", created_at: "2026-08-05T10:00:00.000Z" })]);
    expect(noAnswerOnly.noAnswer).toBe(1);

    const mixedOutcome = buildFunnel([
      ev({ event_type: "results", created_at: "2026-08-05T10:00:00.000Z" }),
      ev({ event_type: "no_answer", source: "search", created_at: "2026-08-05T10:00:00.500Z" }), // advisor side failed, web side succeeded
    ]);
    expect(mixedOutcome.results).toBe(1);
    expect(mixedOutcome.noAnswer).toBe(0); // the action DID reach results — not a dead end
  });

  it("leaves product_view/comparison_view/evidence_view/outbound as raw counts (no proven duplication there)", () => {
    const f = buildFunnel([
      ev({ event_type: "product_view" }), ev({ event_type: "product_view" }),
      ev({ event_type: "comparison_view" }), ev({ event_type: "go_click" }),
    ]);
    expect(f.productView).toBe(2);
    expect(f.comparisonView).toBe(1);
    expect(f.outbound).toBe(1);
  });
});

describe("topSessionSearchShare — concentration transparency signal", () => {
  it("flags when one session dominates search volume", () => {
    const events = [
      ...Array.from({ length: 9 }, (_, i) => ev({ session_id: "heavy", query_text: `q${i}`, created_at: `2026-08-05T10:0${i}:00.000Z` })),
      ev({ session_id: "other", created_at: "2026-08-05T10:09:00.000Z" }),
    ];
    const r = topSessionSearchShare(events);
    expect(r.totalSearchEvents).toBe(10);
    expect(r.sessionEventCount).toBe(9);
    expect(r.share).toBeCloseTo(0.9);
  });

  it("returns 0 share when there are no search events", () => {
    expect(topSessionSearchShare([ev({ event_type: "product_view" })]).share).toBe(0);
  });
});

describe("computeCampaignAttribution — session-level, never person-level (ADR-214)", () => {
  it("marks a go_click with captured UTM as known-campaign", () => {
    const goClicks = [ev({
      event_type: "go_click", canonical_id: "prod-1", created_at: "2026-08-05T10:00:05.000Z",
      meta: { utm_source: "tiktok", utm_medium: "paid_social", utm_campaign: "wave1", utm_content: "vid1" },
    })];
    const summary = computeCampaignAttribution(goClicks, [click({})]);
    expect(summary.withKnownCampaign).toBe(1);
    expect(summary.unknownCampaign).toBe(0);
    expect(summary.rows[0].utmSource).toBe("tiktok");
    expect(summary.bySource).toEqual([{ source: "tiktok", count: 1 }]);
  });

  it("marks a go_click with no captured UTM as UNKNOWN, never fabricated as 'direct'", () => {
    const goClicks = [ev({ event_type: "go_click", canonical_id: "prod-1", created_at: "2026-08-05T10:00:05.000Z", meta: null })];
    const summary = computeCampaignAttribution(goClicks, [click({})]);
    expect(summary.unknownCampaign).toBe(1);
    expect(summary.rows[0].utmSource).toBeNull();
  });

  it("matches to the nearest outbound_clicks row by canonical_id + is_test within the window", () => {
    const goClicks = [ev({ event_type: "go_click", canonical_id: "prod-1", is_test: false, created_at: "2026-08-05T10:00:00.000Z" })];
    const outbound = [
      click({ canonical_product_id: "prod-1", is_test: true, clicked_at: "2026-08-05T10:00:02.000Z" }), // wrong is_test — must not match
      click({ canonical_product_id: "prod-2", is_test: false, clicked_at: "2026-08-05T10:00:01.000Z" }), // wrong product — must not match
      click({ canonical_product_id: "prod-1", is_test: false, clicked_at: "2026-08-05T10:00:03.000Z" }), // correct match
    ];
    const summary = computeCampaignAttribution(goClicks, outbound);
    expect(summary.matchedToOutboundClicks).toBe(1);
    expect(summary.rows[0].storeName).toBe("amazon");
  });

  it("does not match beyond the correlation window", () => {
    const goClicks = [ev({ event_type: "go_click", canonical_id: "prod-1", created_at: "2026-08-05T10:00:00.000Z" })];
    const outbound = [click({ canonical_product_id: "prod-1", clicked_at: "2026-08-05T10:05:00.000Z" })]; // 5 min later
    expect(computeCampaignAttribution(goClicks, outbound).matchedToOutboundClicks).toBe(0);
  });

  it("keeps REAL and TEST (controlled verification journeys) fully separate", () => {
    const real = computeCampaignAttribution(
      [ev({ event_type: "go_click", canonical_id: "prod-1", is_test: false, meta: { utm_source: "organic" } })],
      [click({ is_test: false })]
    );
    const test = computeCampaignAttribution(
      [ev({ event_type: "go_click", canonical_id: "prod-1", is_test: true, meta: { utm_source: "controlled_test" } })],
      [click({ is_test: true })]
    );
    expect(real.rows[0].isTest).toBe(false);
    expect(test.rows[0].isTest).toBe(true);
    expect(test.rows[0].utmSource).toBe("controlled_test");
  });
});

describe("topDemand — category derivation (fixes the live-dashboard (unparsed) gap)", () => {
  it("uses the recorded category column when present, unchanged", () => {
    const events = [ev({ event_type: "search", category: "laptop", query_text: "لابتوب" })];
    const rows = topDemand(events);
    expect(rows).toEqual([{ category: "laptop", count: 1, recorded: 1, derived: 0 }]);
  });

  it("derives a category from query_text via parseShoppingTask when the column is null — the exact ADR-259 gap", () => {
    // No recorded category, but the query text is trivially categorizable — this is the
    // production case measured at 83.7% of the real "(unparsed)" bucket (2026-08-30 audit).
    const events = [ev({ event_type: "search", category: null, query_text: "مكيف رخيص لغرفة 30 متر" })];
    const rows = topDemand(events);
    expect(rows).toEqual([{ category: "air_conditioner", count: 1, recorded: 0, derived: 1 }]);
  });

  it("keeps recorded and derived counts for the same category separate but summed in count", () => {
    const events = [
      ev({ event_type: "search", category: "laptop", query_text: "لابتوب" }),
      ev({ event_type: "results", category: null, query_text: "لابتوب للجامعة" }),
    ];
    const rows = topDemand(events);
    expect(rows).toEqual([{ category: "laptop", count: 2, recorded: 1, derived: 1 }]);
  });

  it("still buckets genuinely unparseable text as (unparsed), never silently drops it", () => {
    const events = [ev({ event_type: "search", category: null, query_text: "مكروويف" })]; // real production example the parser misses
    const rows = topDemand(events);
    expect(rows).toEqual([{ category: "(unparsed)", count: 1, recorded: 0, derived: 0 }]);
  });

  it("never throws when query_text is null alongside a missing category", () => {
    const events = [ev({ event_type: "search", category: null, query_text: null })];
    expect(() => topDemand(events)).not.toThrow();
    expect(topDemand(events)).toEqual([{ category: "(unparsed)", count: 1, recorded: 0, derived: 0 }]);
  });

  it("ignores non-search/results event types", () => {
    const events = [ev({ event_type: "product_view", category: "laptop" })];
    expect(topDemand(events)).toEqual([]);
  });
});

// Integrity review (2026-08-30): found auditing real production output that internal-whitespace
// variants of the exact same query ("تابلت هونر" vs "تابلت  هونر", double space) were counted as
// two different search terms, understating each one's real count and fragmenting what looked to
// the founder like one product's demand into several unrelated-looking rows.
describe("topSearchTerms — whitespace normalization", () => {
  it("collapses internal whitespace-only variants into one line item", () => {
    const events = [
      ev({ event_type: "search", session_id: "s1", query_text: "تابلت هونر", created_at: "2026-08-05T10:00:00.000Z" }),
      ev({ event_type: "search", session_id: "s2", query_text: "تابلت  هونر", created_at: "2026-08-05T10:01:00.000Z" }), // double space
      ev({ event_type: "search", session_id: "s3", query_text: "تابلت هونر", created_at: "2026-08-05T10:02:00.000Z" }),
    ];
    const terms = topSearchTerms(events);
    expect(terms).toHaveLength(1);
    expect(terms[0]).toEqual({ query: "تابلت هونر", count: 3 });
  });

  it("does not merge genuinely different queries that merely share a substring", () => {
    const events = [
      ev({ event_type: "search", session_id: "s1", query_text: "هونر باد 9" }),
      ev({ event_type: "search", session_id: "s2", query_text: "هونر باد 10" }),
    ];
    expect(topSearchTerms(events)).toHaveLength(2);
  });
});

describe("unmetDemand — whitespace normalization (same fix as topSearchTerms)", () => {
  it("collapses internal whitespace-only variants into one line item", () => {
    const events = [
      ev({ event_type: "no_answer", session_id: "s1", query_text: "مكيف رخيص", created_at: "2026-08-05T10:00:00.000Z" }),
      ev({ event_type: "no_answer", session_id: "s2", query_text: "مكيف  رخيص", created_at: "2026-08-05T10:01:00.000Z" }),
    ];
    expect(unmetDemand(events)).toEqual([{ query: "مكيف رخيص", count: 2 }]);
  });
});

// Integrity review (2026-08-30): found on real production data that Amazon's real redirects were
// silently split across two unmerged retailer rows ("2" and the literal "أمازون") because
// outbound_clicks held the bare brand name while stores.name_ar holds the fuller "أمازون
// السعودية" — an exact-string lookup never matched. retailerBreakdown() calls the private
// resolveStoreNameKey() internally; tested here through the public function, against a `stores`
// mock that reproduces the exact real mismatch found.
// require() (not the top-level import) is deliberate in this block: each test needs a fresh
// module instance after jest.resetModules() to pick up that test's own jest.doMock("@/lib/database").
/* eslint-disable @typescript-eslint/no-require-imports */
// ADR-285: fetchUsageEvents/fetchOutboundClicks used to fetch with a single, un-paginated
// `.limit(20000)` — but PostgREST silently caps ANY response at its project's db-max-rows
// setting (1000) regardless of the requested limit. Measured on production: real REAL
// outbound_clicks for the founder's reported window was 3,102+, so the live dashboard's
// "confirmed retailer redirects" read exactly 1000 — a truncation artifact, not a count.
// These regression tests reproduce that shape against a mock PostgREST client (many more
// than 1000 matching rows) and assert the fix (explicit `fetchAllPaginated` pagination)
// returns the COMPLETE set, not a 1000-row slice.
describe("fetchOutboundClicks / fetchUsageEvents — pagination past PostgREST's 1000-row cap (ADR-285)", () => {
  afterEach(() => jest.dontMock("@/lib/database"));

  // Mimics a PostgREST-backed Supabase client: `.range(from, to)` returns a genuine slice of
  // the underlying dataset, exactly like the real project would for a paginated request.
  function mockPostgrestClient(datasets: Record<string, unknown[]>) {
    return {
      from: (table: string) => {
        const rows = datasets[table] ?? [];
        const builder = {
          select: () => builder,
          gte: () => builder,
          lt: () => builder,
          order: () => builder,
          range: (from: number, to: number) =>
            Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
        };
        return builder;
      },
    };
  }

  it("fetchOutboundClicks returns every real row across pages — not truncated at 1000 (the exact founder-reported defect)", async () => {
    const total = 3102; // the founder's reported real-world figure, reproduced here as a fixture
    const rows = Array.from({ length: total }, (_, i) => click({ canonical_product_id: `p${i}` }));
    jest.doMock("@/lib/database", () => {
      const actual = jest.requireActual("@/lib/database");
      return { ...actual, createServerClient: () => mockPostgrestClient({ outbound_clicks: rows }) };
    });
    jest.resetModules();
    const { fetchOutboundClicks: freshFetchOutboundClicks } = require("../../src/lib/admin/command-center-queries");
    const result = await freshFetchOutboundClicks(new Date("2026-08-30T00:00:00Z"), new Date("2026-09-03T00:00:00Z"));
    expect(result).toHaveLength(total); // NOT 1000
  });

  it("fetchUsageEvents returns every real row across pages — not truncated at 1000", async () => {
    const total = 4545; // the founder's reported real 30-day figure, reproduced here as a fixture
    const rows = Array.from({ length: total }, (_, i) => ev({ query_text: `q${i}` }));
    jest.doMock("@/lib/database", () => {
      const actual = jest.requireActual("@/lib/database");
      return { ...actual, createServerClient: () => mockPostgrestClient({ usage_events: rows }) };
    });
    jest.resetModules();
    const { fetchUsageEvents: freshFetchUsageEvents } = require("../../src/lib/admin/command-center-queries");
    const result = await freshFetchUsageEvents(new Date("2026-08-04T00:00:00Z"), new Date("2026-09-03T00:00:00Z"));
    expect(result).toHaveLength(total); // NOT 1000
  });

  it("still returns the correct (small) result when real volume is under the cap", async () => {
    const rows = [click({ canonical_product_id: "p1" }), click({ canonical_product_id: "p2" })];
    jest.doMock("@/lib/database", () => {
      const actual = jest.requireActual("@/lib/database");
      return { ...actual, createServerClient: () => mockPostgrestClient({ outbound_clicks: rows }) };
    });
    jest.resetModules();
    const { fetchOutboundClicks: freshFetchOutboundClicks } = require("../../src/lib/admin/command-center-queries");
    const result = await freshFetchOutboundClicks(new Date("2026-08-30T00:00:00Z"), new Date("2026-09-03T00:00:00Z"));
    expect(result).toHaveLength(2);
  });
});

describe("retailerBreakdown — merchant-name normalization (word-boundary fallback)", () => {
  afterEach(() => jest.dontMock("@/lib/database"));

  function mockStores(rows: Array<{ id: number; name_ar: string; name_en: string }>) {
    jest.doMock("@/lib/database", () => ({
      createServerClient: () => ({
        from: (table: string) => {
          if (table !== "stores") throw new Error(`unexpected table in mock: ${table}`);
          return { select: () => Promise.resolve({ data: rows, error: null }) };
        },
      }),
    }));
  }

  it("merges a bare-brand literal store_name into its numeric id via a whitespace-delimited LEADING-word match", async () => {
    mockStores([{ id: 2, name_ar: "أمازون السعودية", name_en: "Amazon SA" }]);
    jest.resetModules();
    const { retailerBreakdown: freshRetailerBreakdown } = require("@/lib/admin/command-center-queries");
    const outbound: OutboundClickRow[] = [
      click({ store_name: "2", canonical_product_id: "p1" }),
      click({ store_name: "أمازون", canonical_product_id: "p2" }), // real production case: bare brand, not the full stores.name_ar
    ];
    const rows = await freshRetailerBreakdown([], outbound);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ storeSlug: "2", confirmedRedirects: 2 });
  });

  it("merges a bare-brand literal store_name into its numeric id via a whitespace-delimited TRAILING-word match — the real Jarir case (\"جرير\" vs stores.name_ar \"مكتبة جرير\")", async () => {
    mockStores([{ id: 1, name_ar: "مكتبة جرير", name_en: "Jarir" }]);
    jest.resetModules();
    const { retailerBreakdown: freshRetailerBreakdown } = require("@/lib/admin/command-center-queries");
    const outbound: OutboundClickRow[] = [
      click({ store_name: "1", canonical_product_id: "p1" }),
      click({ store_name: "جرير", canonical_product_id: "p2" }),
    ];
    const rows = await freshRetailerBreakdown([], outbound);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ storeSlug: "1", confirmedRedirects: 2 });
  });

  it("never merges two different stores that merely share a short common substring (word-boundary required)", async () => {
    mockStores([
      { id: 2, name_ar: "أمازون السعودية", name_en: "Amazon SA" },
      { id: 30, name_ar: "أمازونيا للأثاث", name_en: "Amazonia Furniture" }, // shares the "أمازون" substring, NOT a word prefix
    ]);
    jest.resetModules();
    const { retailerBreakdown: freshRetailerBreakdown } = require("@/lib/admin/command-center-queries");
    const outbound: OutboundClickRow[] = [click({ store_name: "أمازون", canonical_product_id: "p1" })];
    const rows = await freshRetailerBreakdown([], outbound);
    // "أمازون" is a whole-word prefix of "أمازون السعودية" (id 2) but only a raw substring of
    // "أمازونيا للأثاث" (id 30, no space after the shared prefix) — must resolve to 2, not 30.
    expect(rows).toHaveLength(1);
    expect(rows[0].storeSlug).toBe("2");
  });
});
