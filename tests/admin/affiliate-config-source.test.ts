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
    expect(getAffiliateConfig("amazon")?.value).toBe("tawveeri0f-21");
  });

  it("resolves noon's real publisher-id param (ADR-181), not a fabricated one", () => {
    expect(getAffiliateConfig("noon")).toEqual(DEFAULT_STORE_AFFILIATE_CONFIG.noon);
    expect(getAffiliateConfig("noon")?.param).toBe("utm_source");
  });

  it("returns null (direct exit) for a store with no known program — never invents a tag", () => {
    expect(getAffiliateConfig("jarir")).toBeNull();
  });

  it("applyAffiliateTag appends the correct param with no config argument passed", () => {
    const url = applyAffiliateTag("https://www.amazon.sa/dp/B0ABC", "amazon");
    expect(url).toContain("tag=tawveeri0f-21");
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
