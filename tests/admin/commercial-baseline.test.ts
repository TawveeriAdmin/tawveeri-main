// tests/admin/commercial-baseline.test.ts — ADR-216 official commercial baseline + commercial
// vocabulary (qualified visits, retailer breakdown, search terms, opportunities). Pure-function
// tests against synthetic fixtures — no production dependency.
import {
  COMMERCIAL_BASELINE, resolvePeriod, qualifiedReferredSessions, retailerBreakdown, topSearchTerms,
  type UsageEventRow, type OutboundClickRow,
} from "../../src/lib/admin/command-center-queries";
import { computeOpportunities, type Opportunity } from "../../src/lib/admin/opportunities";
import type { CommandCenterData } from "../../src/lib/admin/command-center-queries";

// retailerBreakdown's merchant-name normalization (2026-08-30) reads the `stores` table only
// when a store_name value isn't already numeric — mocked here so this stays what the file
// header promises: pure-function tests against synthetic fixtures, no production dependency.
jest.mock("../../src/lib/database", () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table !== "stores") throw new Error(`unexpected table in mock: ${table}`);
      return {
        select: () => Promise.resolve({
          data: [
            { id: 4, name_ar: "اكسترا", name_en: "Extra" },
            { id: 5, name_ar: "المنيع", name_en: "Almanea" },
          ],
          error: null,
        }),
      };
    },
  }),
}));

function ev(overrides: Partial<UsageEventRow>): UsageEventRow {
  return {
    event_type: "search", session_id: "s1", is_test: false, source: "web",
    category: null, query_text: "iphone", canonical_id: null,
    created_at: "2026-08-06T10:00:00.000Z", meta: null,
    ...overrides,
  };
}
function click(overrides: Partial<OutboundClickRow>): OutboundClickRow {
  return {
    is_test: false, canonical_product_id: "prod-1", affiliate_program: "direct",
    store_name: "4", clicked_at: "2026-08-06T10:00:05.000Z",
    ...overrides,
  };
}

describe("COMMERCIAL_BASELINE", () => {
  it("is 2026-08-06 00:00 Asia/Riyadh", () => {
    expect(COMMERCIAL_BASELINE.toISOString()).toBe("2026-08-05T21:00:00.000Z"); // UTC+3
  });
});

describe("resolvePeriod is unaffected by the baseline (clipping happens at fetch time, not here)", () => {
  it("still resolves 'today'/'yesterday' as plain calendar boundaries", () => {
    const today = resolvePeriod("today");
    const yesterday = resolvePeriod("yesterday");
    expect(today.start.getTime()).toBeGreaterThan(yesterday.start.getTime());
    expect(yesterday.end.getTime()).toBe(today.start.getTime());
  });
});

describe("qualifiedReferredSessions — session-level, never a click count", () => {
  it("counts each session once even with multiple go_clicks", () => {
    const events = [
      ev({ event_type: "go_click", session_id: "s1" }),
      ev({ event_type: "go_click", session_id: "s1" }),
      ev({ event_type: "go_click", session_id: "s2" }),
      ev({ event_type: "search", session_id: "s3" }), // not a go_click — excluded
    ];
    expect(qualifiedReferredSessions(events)).toBe(2);
  });

  it("returns 0 with no go_click events", () => {
    expect(qualifiedReferredSessions([ev({ event_type: "search" })])).toBe(0);
  });
});

describe("retailerBreakdown — commercial vocabulary, never calls a redirect a sale", () => {
  it("groups confirmed redirects and distinct products by store, excluding TEST rows", async () => {
    const outbound = [
      click({ store_name: "4", canonical_product_id: "p1" }),
      click({ store_name: "4", canonical_product_id: "p2" }),
      click({ store_name: "2", canonical_product_id: "p3", is_test: true }), // excluded
      click({ store_name: "3", canonical_product_id: "p4", affiliate_program: "param" }),
    ];
    const result = await retailerBreakdown([], outbound);
    const store4 = result.find((r) => r.storeSlug === "4")!;
    expect(store4.confirmedRedirects).toBe(2);
    expect(store4.distinctProducts).toBe(2);
    expect(store4.hasAffiliateProgram).toBe(false); // affiliate_program 'direct' doesn't count
    const store3 = result.find((r) => r.storeSlug === "3")!;
    expect(store3.hasAffiliateProgram).toBe(true);
    expect(result.find((r) => r.storeSlug === "2")).toBeUndefined(); // TEST-only store excluded entirely
  });

  it("approximates qualified sessions via product-level correlation to go_click events", async () => {
    const outbound = [click({ store_name: "4", canonical_product_id: "p1" })];
    const events = [
      ev({ event_type: "go_click", session_id: "s1", canonical_id: "p1" }),
      ev({ event_type: "go_click", session_id: "s2", canonical_id: "p1" }),
      ev({ event_type: "go_click", session_id: "s3", canonical_id: "unrelated-product" }),
    ];
    const result = await retailerBreakdown(events, outbound);
    expect(result.find((r) => r.storeSlug === "4")!.qualifiedSessions).toBe(2);
  });

  it("2026-08-30 merchant-normalization fix: a display-name-shaped store_name resolves to the same bucket as its numeric id", async () => {
    const outbound = [
      click({ store_name: "4", canonical_product_id: "p1" }),
      click({ store_name: "اكسترا", canonical_product_id: "p2" }), // the fragmentation bug — same merchant (Extra, id 4)
    ];
    const result = await retailerBreakdown([], outbound);
    const store4 = result.find((r) => r.storeSlug === "4");
    expect(store4?.confirmedRedirects).toBe(2); // both rows counted together, not split across "4" and "اكسترا"
    expect(result.find((r) => r.storeSlug === "اكسترا")).toBeUndefined(); // no orphaned second bucket
  });

  it("a display name that matches no known store stays its own honest, unresolved bucket — never silently dropped", async () => {
    const outbound = [click({ store_name: "متجر غير معروف تمامًا", canonical_product_id: "p1" })];
    const result = await retailerBreakdown([], outbound);
    expect(result.find((r) => r.storeSlug === "متجر غير معروف تمامًا")?.confirmedRedirects).toBe(1);
  });
});

describe("topSearchTerms — deduped at the same action-cluster granularity as the funnel", () => {
  it("counts a search+advisor_query pair for the same action once", () => {
    const events = [
      ev({ event_type: "search", query_text: "laptop", created_at: "2026-08-06T10:00:00.000Z" }),
      ev({ event_type: "advisor_query", query_text: "laptop", created_at: "2026-08-06T10:00:00.100Z" }),
    ];
    expect(topSearchTerms(events)).toEqual([{ query: "laptop", count: 1 }]);
  });

  it("counts a genuinely later repeat search as a second occurrence", () => {
    const events = [
      ev({ event_type: "search", query_text: "laptop", created_at: "2026-08-06T10:00:00.000Z" }),
      ev({ event_type: "search", query_text: "laptop", created_at: "2026-08-06T11:00:00.000Z" }),
    ];
    expect(topSearchTerms(events)).toEqual([{ query: "laptop", count: 2 }]);
  });

  it("ignores blank query text", () => {
    expect(topSearchTerms([ev({ query_text: "" }), ev({ query_text: "   " })])).toEqual([]);
  });
});

describe("computeOpportunities — evidence-based, EARLY SIGNAL below threshold", () => {
  function fakeData(overrides: Partial<CommandCenterData['commercial']> = {}, topDemand: Array<{ category: string; count: number }> = []): CommandCenterData {
    return {
      commercial: {
        qualifiedVisitsReferred: 0, confirmedRetailerRedirects: 0, referredProductInterest: 0,
        referredCategoryDemand: [], topSearchTerms: [], topReferredProducts: [], retailers: [],
        ...overrides,
      },
      topDemand,
    } as unknown as CommandCenterData;
  }

  it("flags a retailer with real referrals but no affiliate program", () => {
    const data = fakeData({ retailers: [{ storeSlug: "4", qualifiedSessions: 5, confirmedRedirects: 12, distinctProducts: 8, hasAffiliateProgram: false }] });
    const opps = computeOpportunities(data);
    expect(opps.some((o: Opportunity) => o.kind === "no_agreement_retailer")).toBe(true);
    expect(opps[0].earlySignal).toBe(true); // 12 < 30
  });

  it("does not flag a retailer that already has an affiliate program", () => {
    const data = fakeData({ retailers: [{ storeSlug: "2", qualifiedSessions: 5, confirmedRedirects: 50, distinctProducts: 8, hasAffiliateProgram: true }] });
    expect(computeOpportunities(data).some((o: Opportunity) => o.kind === "no_agreement_retailer")).toBe(false);
  });

  it("flags a high-search category with zero referred coverage", () => {
    const data = fakeData({ referredCategoryDemand: [] }, [{ category: "air_conditioner", count: 40 }]);
    const opps = computeOpportunities(data);
    expect(opps.some((o) => o.kind === "high_demand_low_coverage" && o.titleEn.includes("air_conditioner"))).toBe(true);
  });

  it("does not flag a category that already has referred coverage", () => {
    const data = fakeData({ referredCategoryDemand: [{ category: "mobile", count: 3 }] }, [{ category: "mobile", count: 40 }]);
    expect(computeOpportunities(data).some((o) => o.kind === "high_demand_low_coverage")).toBe(false);
  });

  it("ignores low-volume categories (below the 5-search floor) to avoid noise", () => {
    const data = fakeData({}, [{ category: "vacuum", count: 2 }]);
    expect(computeOpportunities(data)).toEqual([]);
  });
});
