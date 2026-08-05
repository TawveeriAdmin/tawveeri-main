// tests/admin/admin-exclusion.test.ts — ADR-216: authenticated admin browsing must be excluded
// from REAL headline metrics for FUTURE events (never retroactive). Static source-pattern checks
// — request/response mocking for these routes is heavier than the invariant being pinned down.
import { readFileSync } from "fs";
import { resolve } from "path";

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("tw_admin cookie excludes future admin browsing from REAL metrics", () => {
  it("the marker is set only inside the already role-gated /admin layout", () => {
    const layout = read("src/app/[locale]/admin/layout.tsx");
    expect(layout).toMatch(/<AdminActivityMarker/);
    expect(layout).toMatch(/requireAdmin\(\)/); // still gated before the marker ever renders
    const marker = read("src/components/admin/admin-activity-marker.tsx");
    expect(marker).toMatch(/tw_admin=1/);
  });

  it("/api/events treats tw_admin the same as opt-in TEST traffic", () => {
    const src = read("src/app/api/events/route.ts");
    expect(src).toMatch(/req\.cookies\.get\(["']tw_admin["']\)\?\.value === ["']1["']/);
    expect(src).toMatch(/isAdminSession/);
  });

  it("/go/[offerId] also excludes tw_admin sessions from confirmed retailer redirects", () => {
    const src = read("src/app/go/[offerId]/route.ts");
    expect(src).toMatch(/req\.cookies\.get\(["']tw_admin["']\)\?\.value === ["']1["']/);
  });

  it("never mutates historical rows — no UPDATE/backfill of is_test anywhere in the admin-exclusion code", () => {
    for (const file of ["src/app/api/events/route.ts", "src/app/go/[offerId]/route.ts", "src/components/admin/admin-activity-marker.tsx"]) {
      const src = read(file);
      expect(src).not.toMatch(/\.update\(\s*\{\s*is_test/);
    }
  });
});
