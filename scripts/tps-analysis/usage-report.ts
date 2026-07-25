// scripts/tps-analysis/usage-report.ts
// Real-customer measurement report (Founder Directive Part 6). Reads usage_events +
// outbound_clicks and reports the funnel, ALWAYS separating REAL from TEST traffic — so
// we never claim user validation until real users actually exist. Read-only.
// Run: npm run tps:usage
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("not production"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const rows = async (s: string) => (await c.query(s)).rows;
  const now = (await rows("select now() ts"))[0].ts;

  console.log(`\n═══ TAWVEERI USAGE REPORT — ${new Date(now).toISOString()} (production) ═══`);
  console.log("Legend: REAL = live customers · TEST = ?test=1 testers/bots. We never count TEST as validation.\n");

  const funnel = await rows(`
    select is_test,
      count(*) filter (where event_type='advisor_query')  queries,
      count(*) filter (where event_type='advisor_result') results,
      count(*) filter (where event_type='no_answer')      no_answers,
      count(*) filter (where event_type='evidence_view')  evidence_views,
      count(*) filter (where event_type='go_click')       go_clicks,
      count(distinct session_id)                          sessions
    from usage_events group by is_test order by is_test`);
  console.log("FUNNEL (usage_events):");
  if (!funnel.length) console.log("  (no events yet — no real users have arrived)");
  for (const r of funnel) {
    const tag = r.is_test ? "TEST" : "REAL";
    console.log(`  [${tag}] sessions=${r.sessions}  queries=${r.queries}  results=${r.results}  no_answer=${r.no_answers}  evidence_views=${r.evidence_views}  go_clicks=${r.go_clicks}`);
  }

  console.log("\nTOP DEMAND — real categories asked (usage_events, REAL only):");
  const cats = await rows(`select coalesce(category,'(unparsed)') category, count(*) n from usage_events where is_test=false and event_type in ('advisor_query','advisor_result') group by 1 order by 2 desc limit 12`);
  if (!cats.length) console.log("  (none yet)");
  cats.forEach((r: Record<string, unknown>) => console.log(`  ${String(r.category).padEnd(18)} ${r.n}`));

  console.log("\nNO-ANSWER queries (REAL) — unmet demand to prioritize:");
  const na = await rows(`select query_text, count(*) n from usage_events where is_test=false and event_type='no_answer' and query_text is not null group by 1 order by 2 desc limit 10`);
  if (!na.length) console.log("  (none yet)");
  na.forEach((r: Record<string, unknown>) => console.log(`  ${r.n}×  ${String(r.query_text).slice(0, 60)}`));

  console.log("\nMEASURED EXITS (outbound_clicks):");
  const oc = await rows(`select is_test, count(*) n, count(distinct canonical_product_id) products, count(*) filter (where affiliate_program is not null and affiliate_program<>'direct') monetized from outbound_clicks group by is_test order by is_test`);
  if (!oc.length) console.log("  (none yet)");
  for (const r of oc) console.log(`  [${r.is_test ? "TEST" : "REAL"}] clicks=${r.n}  distinct_products=${r.products}  monetized=${r.monetized}`);
  const bySource = await rows(`select coalesce(source,'?') source, count(*) n from outbound_clicks where is_test=false group by 1 order by 2 desc`);
  if (bySource.length) console.log("  REAL by source: " + bySource.map((r: Record<string, unknown>) => `${r.source}=${r.n}`).join("  "));

  console.log("\nVALIDATION STATUS:");
  const realSessions = Number(funnel.find((r: Record<string, unknown>) => !r.is_test)?.sessions ?? 0);
  const realClicks = Number(oc.find((r: Record<string, unknown>) => !r.is_test)?.n ?? 0);
  console.log(`  real sessions = ${realSessions} · real measured exits = ${realClicks}`);
  console.log(`  → ${realSessions > 0 ? "REAL USERS PRESENT — begin honest funnel analysis." : "NO REAL USERS YET — do not claim validation."}`);
  console.log("\nReproduce: npm run tps:usage\n");
  await c.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
