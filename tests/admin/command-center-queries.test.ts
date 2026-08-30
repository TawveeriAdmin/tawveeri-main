// tests/admin/command-center-queries.test.ts — funnel dedup, burst/concentration signal, and
// campaign-to-outbound attribution (ADR-214). Pure-function tests against synthetic fixtures —
// no production dependency. Real production numbers behind this fix: docs/DECISIONS.md ADR-214.
import {
  buildFunnel, topSessionSearchShare, computeCampaignAttribution, topDemand,
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
