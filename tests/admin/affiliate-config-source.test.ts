// tests/admin/affiliate-config-source.test.ts — guards the 2026-08-05 production defect fix:
// `stores.affiliate_config` (migration 20) was never applied to production (ADR-212) and isn't
// read by the actual /go exit path either way. DEFAULT_STORE_AFFILIATE_CONFIG / the Provider
// Registry is the real authoritative source. This pins down both halves: the pure-function
// behavior, and that no admin-surface code re-introduces a query for the nonexistent column.
import { readFileSync } from "fs";
import { resolve } from "path";
import { getAffiliateConfig, applyAffiliateTag, DEFAULT_STORE_AFFILIATE_CONFIG } from "../../src/lib/transactions/affiliate-config";

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("getAffiliateConfig — code-managed, no DB dependency", () => {
  it("resolves amazon's tag without any DB-sourced override", () => {
    expect(getAffiliateConfig("amazon")).toEqual(DEFAULT_STORE_AFFILIATE_CONFIG.amazon);
    expect(getAffiliateConfig("amazon")?.[0]?.value).toBe("tawveeri0f-21");
  });

  it("resolves noon's real attribution params (ADR-224/225), not a fabricated one", () => {
    expect(getAffiliateConfig("noon")).toEqual(DEFAULT_STORE_AFFILIATE_CONFIG.noon);
    const params = getAffiliateConfig("noon") ?? [];
    expect(params.map((p) => p.param)).toEqual(["utm_source", "utm_medium", "utm_campaign", "adjust_deeplink_js"]);
    expect(params.find((p) => p.param === "utm_source")?.value).toBe("C1000264L");
  });

  it("returns null (direct exit) for a store with no known program — never invents a tag", () => {
    expect(getAffiliateConfig("jarir")).toBeNull();
  });

  it("applyAffiliateTag appends the correct param with no config argument passed", () => {
    const url = applyAffiliateTag("https://www.amazon.sa/dp/B0ABC", "amazon");
    expect(url).toContain("tag=tawveeri0f-21");
  });

  // ADR-225 (2026-08-07): this legacy path (product-card.tsx / store-comparison-panel.tsx,
  // one of the highest-traffic customer surfaces) used to carry only utm_source — a real,
  // measurable attribution-leak risk since every piece of real Noon evidence (ADR-224) shows
  // utm_source/utm_medium/utm_campaign/adjust_deeplink_js always appearing together.
  it("applyAffiliateTag carries the FULL noon param set, not just utm_source", () => {
    const url = applyAffiliateTag("https://www.noon.com/saudi-en/some-product/N123/p/?o=abc123", "noon")!;
    const u = new URL(url);
    expect(u.searchParams.get("utm_source")).toBe("C1000264L");
    expect(u.searchParams.get("utm_medium")).toBe("AFFfbc721aa80c8");
    expect(u.searchParams.get("utm_campaign")).toBe("CMP2ce0b63a6a1anoon");
    expect(u.searchParams.get("adjust_deeplink_js")).toBe("1");
    expect(u.searchParams.get("o")).toBe("abc123"); // Noon's own offer token, untouched
  });

  it("applyAffiliateTag never clobbers a param already present on the source URL", () => {
    const url = applyAffiliateTag("https://www.noon.com/saudi-en/p/N123?utm_campaign=EXISTING", "noon")!;
    const u = new URL(url);
    expect(u.searchParams.get("utm_campaign")).toBe("EXISTING");
    expect(u.searchParams.get("utm_source")).toBe("C1000264L"); // other params still applied
  });
});

describe("no admin-surface code queries the nonexistent stores.affiliate_config column", () => {
  const FILES = [
    "src/app/[locale]/admin/affiliate/page.tsx",
    "src/lib/admin/command-center-queries.ts",
    "src/app/api/admin/stores/[id]/affiliate/route.ts",
  ];

  it.each(FILES)("%s does not select() or update() affiliate_config from stores", (file) => {
    const src = read(file);
    // Matches `.select('... affiliate_config ...')` / `.update({ affiliate_config: ... })` — the
    // exact patterns that threw "column stores.affiliate_config does not exist" in production.
    expect(src).not.toMatch(/\.select\([^)]*affiliate_config[^)]*\)/);
    expect(src).not.toMatch(/\.update\(\s*\{\s*affiliate_config/);
  });

  it("the deprecated PATCH route responds honestly instead of hitting the DB", () => {
    const src = read("src/app/api/admin/stores/[id]/affiliate/route.ts");
    expect(src).not.toMatch(/createServerClient/);
    expect(src).toMatch(/410/);
  });
});
