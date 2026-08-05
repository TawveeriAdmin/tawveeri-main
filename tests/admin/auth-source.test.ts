// tests/admin/auth-source.test.ts — guards the ONE authoritative admin-role source (2026-08-05
// production defect fix). Static source-pattern checks: full integration testing of Next.js
// middleware/edge runtime isn't practical here, but "does the code read role from the DB, not a
// possibly-stale JWT claim" is a real architectural invariant worth pinning down.
import { readFileSync } from "fs";
import { resolve } from "path";

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("admin authorization reads role from users.role, not JWT metadata", () => {
  it("middleware's admin-route gate queries the users table for role", () => {
    const src = read("src/middleware.ts");
    expect(src).toMatch(/\.from\(['"]users['"]\)\s*\.select\(['"]role['"]\)/);
    // Must not resolve admin status from JWT app_metadata/user_metadata — those don't
    // auto-refresh when we promote an account via a direct DB write.
    expect(src).not.toMatch(/user\.app_metadata\??\.role/);
    expect(src).not.toMatch(/user\.user_metadata\??\.role/);
  });

  it("requireAdmin()/getUserProfile() (page-level guard) also reads role from the users table", () => {
    const src = read("src/lib/auth/server.ts");
    expect(src).toMatch(/\.from\(['"]users['"]\)/);
  });

  it("the admin layout is explicitly force-dynamic — an auth decision must never be statically cached", () => {
    const src = read("src/app/[locale]/admin/layout.tsx");
    expect(src).toMatch(/export const dynamic = ['"]force-dynamic['"]/);
  });

  it("middleware treats every /admin/* path identically (no route-specific auth carve-outs)", () => {
    const src = read("src/middleware.ts");
    expect(src).toMatch(/const adminRoutes = \['\/admin'\]/);
  });
});
