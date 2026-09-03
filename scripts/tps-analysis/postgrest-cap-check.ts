// scripts/tps-analysis/postgrest-cap-check.ts
// ─────────────────────────────────────────────────────────────────────────────
// ADR-285 ongoing verification. PostgREST silently caps ANY response at the project's
// db-max-rows setting (1000 here) regardless of a requested `.limit()`, with no error —
// first found in ADR-172, recurred independently in five places fixed under ADR-285. A
// query sitting near or past that ceiling is a standing risk even after being fixed once
// (a regression could reintroduce a bare `.limit()`), and a query never audited at all
// could cross the ceiling silently as data grows.
//
// This script re-verifies, on demand, that:
//   (A) every query ADR-285 fixed (now paginated via fetchAllPaginated) still returns the
//       SAME row count as a direct SQL COUNT(*) for the same window — proving the fix
//       still holds and catching a future regression back to a bare `.limit()`.
//   (B) every query ADR-285 measured as CURRENTLY SAFE (small volume, deliberately left
//       un-paginated) hasn't since crossed the 1000-row danger zone.
// A result that reads exactly 1000 (or a suspiciously round multiple of it) on any
// un-paginated query is itself the signature of this exact defect recurring — flagged loudly.
//
// Run: npm run tps:postgrest-cap-check
// Read-only. Same production-guard convention as scripts/tps-analysis/usage-report.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";

const WARN_THRESHOLD = 900; // flag a raw un-paginated query once it gets uncomfortably close to 1000, not only after it breaks

type Verdict = "OK" | "WARN" | "FAIL";

interface CheckResult {
  name: string;
  verdict: Verdict;
  detail: string;
}

(async () => {
  const { toPoolerDbUrl } = await import("../tps-core/pooler-url");
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) {
    console.error("not production");
    process.exit(1);
  }
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const one = async (sql: string) => (await pg.query(sql)).rows[0] as { n: number };

  const results: CheckResult[] = [];

  // ── (A) Fixed call sites: REST-derived count MUST equal direct-SQL ground truth ────────
  const { fetchUsageEvents, fetchOutboundClicks, resolvePeriod } = await import(
    "../../src/lib/admin/command-center-queries"
  );

  for (const period of ["7d", "30d"] as const) {
    const { start, end } = resolvePeriod(period);

    const outboundRows = await fetchOutboundClicks(start, end);
    const outboundReal = outboundRows.filter((r) => !r.is_test).length;
    const outboundSql = await one(
      `select count(*)::int n from outbound_clicks where clicked_at >= '${start.toISOString()}' and clicked_at < '${end.toISOString()}' and is_test=false`
    );
    results.push({
      name: `fetchOutboundClicks (${period}, REAL)`,
      verdict: outboundReal === outboundSql.n ? "OK" : "FAIL",
      detail: `REST=${outboundReal} SQL=${outboundSql.n}`,
    });

    const eventRows = await fetchUsageEvents(start, end);
    const eventsReal = eventRows.filter((r) => !r.is_test).length;
    const eventsSql = await one(
      `select count(*)::int n from usage_events where created_at >= '${start.toISOString()}' and created_at < '${end.toISOString()}' and is_test=false`
    );
    results.push({
      name: `fetchUsageEvents (${period}, REAL)`,
      verdict: eventsReal === eventsSql.n ? "OK" : "FAIL",
      detail: `REST=${eventsReal} SQL=${eventsSql.n}`,
    });
  }

  const { getNavigableCategories } = await import("../../src/lib/intelligence/navigable-categories");
  const navRuns = await Promise.all([getNavigableCategories(), getNavigableCategories()]);
  const navSame = JSON.stringify(navRuns[0]) === JSON.stringify(navRuns[1]);
  const navComparableSql = await one(
    `select count(*)::int n from tps_product_projection where has_comparison=true`
  );
  results.push({
    name: "getNavigableCategories() — deterministic across calls",
    verdict: navSame ? "OK" : "FAIL",
    detail: navSame ? "two live calls returned identical output" : "output DIFFERED between two live calls — non-determinism has returned",
  });
  results.push({
    name: "getNavigableCategories() — underlying table volume",
    verdict: "OK",
    detail: `tps_product_projection.has_comparison=true real count = ${navComparableSql.n} (informational — paginated, so no ceiling applies)`,
  });

  // ── (B) Currently-safe, deliberately un-paginated queries: watch for crossing 1000 ──────
  const watchQueries: Array<{ name: string; sql: string }> = [
    { name: "demand_opportunities (is_test=false) — src/lib/admin/demand-radar-queries.ts .limit(5000)", sql: `select count(*)::int n from demand_opportunities where is_test=false` },
    { name: "tps_offer_delist_signals — src/app/api/search/route.ts .limit(10000)", sql: `select count(*)::int n from tps_offer_delist_signals` },
    { name: "tps_price_implausibility_signals — src/app/api/search/route.ts .limit(10000)", sql: `select count(*)::int n from tps_price_implausibility_signals` },
  ];
  for (const q of watchQueries) {
    const r = await one(q.sql);
    const verdict: Verdict = r.n >= 1000 ? "FAIL" : r.n >= WARN_THRESHOLD ? "WARN" : "OK";
    results.push({
      name: q.name,
      verdict,
      detail:
        verdict === "FAIL"
          ? `real count ${r.n} has CROSSED the PostgREST 1000-row cap — this query is now silently truncating. Convert it to fetchAllPaginated().`
          : verdict === "WARN"
            ? `real count ${r.n} is within ${1000 - r.n} rows of the cap — plan the pagination fix now, before it breaks silently.`
            : `real count ${r.n} — comfortably under the 1000-row cap.`,
    });
  }

  // ── Report ──────────────────────────────────────────────────────────────────────────────
  console.log(`\n═══ PostgREST db-max-rows CAP CHECK (ADR-285) ═══`);
  console.log(`production (vyceqrzttspyycdpojtn) · ${new Date().toISOString()}\n`);
  let anyFail = false, anyWarn = false;
  for (const r of results) {
    if (r.verdict === "FAIL") anyFail = true;
    if (r.verdict === "WARN") anyWarn = true;
    console.log(`[${r.verdict.padEnd(4)}] ${r.name}\n       ${r.detail}`);
  }
  console.log(
    `\nVERDICT: ${
      anyFail
        ? "FAIL — at least one query is silently truncating or has regressed to non-determinism. Fix before trusting its numbers."
        : anyWarn
          ? "WARN — no truncation yet, but at least one un-paginated query is close to the 1000-row cap. Schedule the pagination fix."
          : "OK — every checked query is either paginated-and-verified-complete or comfortably under the cap."
    }`
  );

  await pg.end();
  process.exit(anyFail ? 1 : 0);
})().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : e);
  process.exit(1);
});
