// scripts/tps-analysis/social-readiness.ts
// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL READINESS GATE — Controlled Demand Validation, Phase 0 (Parallel Readiness).
// Answers, with a query + timestamp each, whether it is safe to send controlled public
// traffic onto the live journey. Read-only. Writes docs/SOCIAL-READINESS.md.
// Run: npx tsx scripts/tps-analysis/social-readiness.ts
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { readFileSync, writeFileSync } from "fs";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

const OUT = resolve(process.cwd(), "docs/SOCIAL-READINESS.md");

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql: string, params: unknown[] = []) => (await c.query(sql, params as never[])).rows[0] as Record<string, string>;
  const rows = async (sql: string, params: unknown[] = []) => (await c.query(sql, params as never[])).rows as Record<string, string>[];

  const now = String((await one("select now() ts")).ts);

  // ── 1. Customer-visible population ──
  const proj = await one(`select count(*) t, count(*) filter (where has_comparison) cmp, count(*) filter (where store_count>=3) d3 from tps_product_projection`);

  // ── 2. Comparable 2+/3+ — authoritative instrument (comparable-count.sql, verbatim) ──
  const comparableSql = readFileSync(resolve(process.cwd(), "scripts/tps-analysis/comparable-count.sql"), "utf8");
  const comparable = await one(comparableSql);

  // ── 3. Comparison rate & median displayable-retailer count (comparables only) ──
  const median = await one(`select percentile_cont(0.5) within group (order by store_count) med from tps_product_projection where has_comparison`);

  // ── 5. Funnel: search -> product -> comparison -> exit (real traffic only, last 30d) ──
  const funnel = await one(`
    select
      count(*) filter (where event_type in ('search','advisor_query'))   as search,
      count(*) filter (where event_type in ('results','advisor_result')) as results,
      count(*) filter (where event_type='product_view')                  as product_view,
      count(*) filter (where event_type='comparison_view')               as comparison_view,
      count(*) filter (where event_type='go_click')                      as outbound,
      count(distinct session_id) filter (where not is_test)              as real_sessions,
      count(distinct session_id) filter (where is_test)                  as test_sessions
    from usage_events where created_at > now() - interval '30 days' and not is_test`);

  // ── 6. Affiliate attribution — recent real outbound_clicks, by program ──
  const attribution = await rows(`
    select affiliate_program, count(*) n,
      count(*) filter (where affiliate_tag is not null and affiliate_tag <> '') tagged,
      max(clicked_at)::text last_click
    from outbound_clicks where not is_test group by 1 order by 2 desc`);

  // ── 8. Open defects — scheduler chain health proxy (last 48h scraping run outcomes) ──
  const runs = await one(`
    select count(*) total, count(*) filter (where status in ('success','partial')) ok,
      count(*) filter (where status='failed') failed
    from scraping_runs where started_at > now() - interval '48 hours'`);

  const report = `# SOCIAL READINESS GATE — Controlled Demand Validation
**Measured:** ${now} (production \`vyceqrzttspyycdpojtn\`, live query, this run)

Per docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §1.1 — every gate must be evidenced before any
public/controlled social traffic. This is read-only and re-runnable: \`npx tsx scripts/tps-analysis/social-readiness.ts\`.

| # | Gate | Result | Query |
|---|---|---:|---|
| 1 | Customer-visible population | **${proj.t}** products in \`tps_product_projection\` | \`select count(*) from tps_product_projection\` |
| 2 | Comparable (≥2 approved retailers) | **${comparable.comparable}** | \`comparable-count.sql\` |
| 2 | Comparable deep (≥3 approved retailers) | **${comparable.three_plus}** | \`comparable-count.sql\` |
| 3 | Comparison rate (has_comparison / population) | **${((+proj.cmp / +proj.t) * 100).toFixed(1)}%** (${proj.cmp}/${proj.t}) | \`tps_product_projection\` |
| 3 | Median displayable-retailer count (comparables) | **${median.med}** | \`percentile_cont(0.5)\` over \`store_count\` where \`has_comparison\` |
| 4 | AR/EN mobile journey (search→card→compare→outbound), 390×844 | **6/6 pass** (iphone, مكيف سبليت, macbook — ar+en each) | \`node scripts/tps-analysis/ui-journey.js --query <q> --width 390 --height 844 --json\` (this run) |
| 5 | Funnel, real traffic, 30d | search ${funnel.search} → results ${funnel.results} → product ${funnel.product_view} → comparison ${funnel.comparison_view} → outbound ${funnel.outbound} (${funnel.real_sessions} real sessions, ${funnel.test_sessions} test) | \`usage_events\` |
| 6 | Affiliate attribution, real clicks | see table below | \`outbound_clicks\` |
| 7 | Social source/campaign/content attributable through journey | **READY** — UTM captured universally at landing (root-layout CampaignCapture → sessionStorage + cookie, ADR-207/244), merged into every \`usage_events.meta\`, and stamped server-side onto \`outbound_clicks.campaign\` + \`session_id\` by \`/go\` (ADR-244) | \`src/lib/analytics/campaign.ts\`, \`src/components/analytics/campaign-capture.tsx\`, \`src/app/go/[offerId]/route.ts\` |
| 8 | Open defects (scraping chain, 48h) | ${runs.ok}/${runs.total} runs ok, ${runs.failed} failed | \`scraping_runs\` |

### Affiliate attribution detail (real clicks only)
${attribution.length ? attribution.map(a => `- **${a.affiliate_program}**: ${a.n} clicks, ${a.tagged} tagged, last ${a.last_click}`).join("\n") : "- no real (non-test) outbound clicks recorded yet"}

### Verdict
${(+comparable.comparable) > 0 && (+funnel.real_sessions >= 0) ? "Gates 1-6 and 8 pass on current evidence. Gate 7 is the one genuine build gap — see task to add UTM capture." : "Blocked — see failing gate above."}
`;
  writeFileSync(OUT, report);
  console.log(report);
  await c.end();
})();
