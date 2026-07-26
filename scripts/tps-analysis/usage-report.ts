// scripts/tps-analysis/usage-report.ts
// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE BETA FUNNEL DASHBOARD (Founder Private Beta phase).
// Reads usage_events + outbound_clicks and reports the FULL customer journey as a
// unified 6-step funnel across BOTH surfaces (storefront `web` + AI advisor `agent`):
//
//   Search → Results → Product View → Comparison → Evidence → Outbound Click
//
// It ALWAYS separates REAL customers from TEST traffic (?test=1 / bots) — we never
// claim validation until real users exist. Read-only. Also emits docs/BETA-FUNNEL.md
// so the founder has a durable, re-measurable artifact.
// Run: npm run tps:usage
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { writeFileSync } from "fs";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

// ── Launch-readiness KPI thresholds (transparent + editable). A "public-launch signal"
//    requires a minimum real sample AND every quality KPI to pass. ─────────────────────
const KPI = {
  MIN_SESSIONS: 100,        // minimum real sessions for statistical signal
  MIN_OUTBOUND: 30,         // minimum real measured exits
  ANSWER_RATE_MIN: 0.80,    // Results / Search
  NOANSWER_RATE_MAX: 0.25,  // no_answer / Search (unmet demand ceiling)
  SEARCH_TO_EXIT_MIN: 0.05, // overall Search → Outbound conversion
  COMPARE_TO_EXIT_MIN: 0.08,// Comparison → Outbound (exit CTR on comparisons)
};

const pct = (num: number, den: number) => (den > 0 ? num / den : 0);
const fpct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pass = (ok: boolean) => (ok ? "PASS" : "MISS");

type Funnel = {
  search: number; results: number; product_view: number; comparison_view: number;
  evidence_view: number; outbound: number; no_answer: number; errors: number; sessions: number;
};

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("not production"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const rows = async (s: string) => (await c.query(s)).rows as Record<string, unknown>[];
  const now = String((await rows("select now() ts"))[0].ts);

  // ── Funnel counts by REAL/TEST ─────────────────────────────────────────────
  const funnelRows = await rows(`
    select is_test,
      count(*) filter (where event_type in ('search','advisor_query'))   as search,
      count(*) filter (where event_type in ('results','advisor_result')) as results,
      count(*) filter (where event_type='product_view')                  as product_view,
      count(*) filter (where event_type='comparison_view')               as comparison_view,
      count(*) filter (where event_type='evidence_view')                 as evidence_view,
      count(*) filter (where event_type='go_click')                      as outbound,
      count(*) filter (where event_type='no_answer')                     as no_answer,
      count(*) filter (where event_type='error')                         as errors,
      count(distinct session_id)                                         as sessions
    from usage_events group by is_test`);
  const grab = (test: boolean): Funnel => {
    const r = funnelRows.find((x) => Boolean(x.is_test) === test);
    const n = (k: string) => Number(r?.[k] ?? 0);
    return { search: n("search"), results: n("results"), product_view: n("product_view"),
      comparison_view: n("comparison_view"), evidence_view: n("evidence_view"), outbound: n("outbound"),
      no_answer: n("no_answer"), errors: n("errors"), sessions: n("sessions") };
  };
  const real = grab(false), test = grab(true);

  // Session-level: how many real sessions reached each key stage.
  const sess = (await rows(`
    select
      count(distinct session_id) filter (where event_type in ('search','advisor_query'))   searched,
      count(distinct session_id) filter (where event_type in ('results','advisor_result')) got_results,
      count(distinct session_id) filter (where event_type='comparison_view')                compared,
      count(distinct session_id) filter (where event_type='go_click')                       exited
    from usage_events where is_test=false`))[0];

  // Per-surface split (REAL only).
  const surfaces = await rows(`
    select coalesce(source,'(none)') source,
      count(*) filter (where event_type in ('search','advisor_query'))   search,
      count(*) filter (where event_type in ('results','advisor_result')) results,
      count(*) filter (where event_type='go_click')                      outbound,
      count(distinct session_id)                                         sessions
    from usage_events where is_test=false group by 1 order by sessions desc`);

  // Demand + unmet demand + measured economics.
  const cats = await rows(`select coalesce(category,'(unparsed)') category, count(*) n from usage_events where is_test=false and event_type in ('search','advisor_query','results','advisor_result') group by 1 order by 2 desc limit 12`);
  const na = await rows(`select query_text, count(*) n from usage_events where is_test=false and event_type='no_answer' and query_text is not null group by 1 order by 2 desc limit 10`);
  const oc = await rows(`select is_test, count(*) n, count(distinct canonical_product_id) products, count(*) filter (where affiliate_program is not null and affiliate_program<>'direct') monetized from outbound_clicks group by is_test order by is_test`);
  const ocReal = oc.find((r) => !r.is_test);

  // ── Derived KPIs (REAL) ────────────────────────────────────────────────────
  const answerRate = pct(real.results, real.search);
  const noAnswerRate = pct(real.no_answer, real.search);
  const searchToProduct = pct(real.product_view, real.search);
  const productToCompare = pct(real.comparison_view, real.product_view);
  const compareToExit = pct(real.outbound, real.comparison_view);
  const searchToExit = pct(real.outbound, real.search);
  const eventsPerSession = pct(
    real.search + real.results + real.product_view + real.comparison_view + real.evidence_view + real.outbound,
    real.sessions);

  // ── Launch-readiness gate ──────────────────────────────────────────────────
  const checks = [
    { k: `Sessions ≥ ${KPI.MIN_SESSIONS}`, ok: real.sessions >= KPI.MIN_SESSIONS, v: `${real.sessions}` },
    { k: `Measured exits ≥ ${KPI.MIN_OUTBOUND}`, ok: real.outbound >= KPI.MIN_OUTBOUND, v: `${real.outbound}` },
    { k: `Answer rate ≥ ${fpct(KPI.ANSWER_RATE_MIN)}`, ok: answerRate >= KPI.ANSWER_RATE_MIN, v: fpct(answerRate) },
    { k: `No-answer rate ≤ ${fpct(KPI.NOANSWER_RATE_MAX)}`, ok: noAnswerRate <= KPI.NOANSWER_RATE_MAX, v: fpct(noAnswerRate) },
    { k: `Search→Exit ≥ ${fpct(KPI.SEARCH_TO_EXIT_MIN)}`, ok: searchToExit >= KPI.SEARCH_TO_EXIT_MIN, v: fpct(searchToExit) },
    { k: `Comparison→Exit ≥ ${fpct(KPI.COMPARE_TO_EXIT_MIN)}`, ok: compareToExit >= KPI.COMPARE_TO_EXIT_MIN, v: fpct(compareToExit) },
  ];
  let verdict: string;
  if (real.sessions === 0) verdict = "AWAITING FIRST USERS — instrumentation live, no real sessions yet.";
  else if (real.sessions < KPI.MIN_SESSIONS || real.outbound < KPI.MIN_OUTBOUND) verdict = `EARLY SIGNAL — gathering (need ≥${KPI.MIN_SESSIONS} sessions & ≥${KPI.MIN_OUTBOUND} exits before a launch verdict).`;
  else if (checks.every((x) => x.ok)) verdict = "PUBLIC-LAUNCH SIGNAL: GREEN — all KPIs pass on a sufficient real sample.";
  else verdict = `IMPROVE BEFORE PUBLIC LAUNCH — failing: ${checks.filter((x) => !x.ok).map((x) => x.k).join("; ")}`;

  // ── Render (console + markdown) ────────────────────────────────────────────
  const L: string[] = [];
  const w = (s = "") => { console.log(s); L.push(s); };

  w(`\n═══ TAWVEERI — PRIVATE BETA FUNNEL DASHBOARD ═══`);
  w(`Generated: ${new Date(now).toISOString()} · production (vyceqrzttspyycdpojtn)`);
  w(`Legend: REAL = live customers · TEST = ?test=1 testers/bots (never counted as validation).`);
  w(`Surfaces unified: storefront (source=web/product_page) + AI advisor (source=agent).\n`);

  w(`FUNNEL — full customer journey (REAL customers):`);
  if (real.sessions === 0 && real.search === 0) {
    w(`  (no real events yet — the funnel is instrumented and waiting for the first beta session)`);
  }
  const step = (label: string, count: number, prevCount: number, isFirst = false) => {
    const conv = isFirst ? "" : `  (${fpct(pct(count, prevCount))} of prev)`;
    w(`  ${label.padEnd(16)} ${String(count).padStart(6)}${conv}`);
  };
  step("1 Search", real.search, real.search, true);
  step("2 Results", real.results, real.search);
  step("3 Product View", real.product_view, real.results);
  step("4 Comparison", real.comparison_view, real.product_view);
  step("5 Evidence", real.evidence_view, real.comparison_view);
  step("6 Outbound", real.outbound, real.comparison_view);
  w(`  ── off-funnel: no_answer=${real.no_answer}  errors=${real.errors}`);
  w(`  Overall Search→Outbound: ${fpct(searchToExit)}`);
  w(`  [TEST traffic, excluded]  sessions=${test.sessions} search=${test.search} results=${test.results} outbound=${test.outbound}\n`);

  w(`KPIs vs launch thresholds (REAL):`);
  const kpiRow = (name: string, val: string, ok: boolean | null) =>
    w(`  ${name.padEnd(26)} ${val.padStart(8)}   ${ok === null ? "" : pass(ok)}`);
  kpiRow("Answer rate", fpct(answerRate), answerRate >= KPI.ANSWER_RATE_MIN);
  kpiRow("No-answer rate", fpct(noAnswerRate), noAnswerRate <= KPI.NOANSWER_RATE_MAX);
  kpiRow("Search→Product View", fpct(searchToProduct), null);
  kpiRow("Product→Comparison", fpct(productToCompare), null);
  kpiRow("Comparison→Exit (CTR)", fpct(compareToExit), compareToExit >= KPI.COMPARE_TO_EXIT_MIN);
  kpiRow("Search→Exit (overall)", fpct(searchToExit), searchToExit >= KPI.SEARCH_TO_EXIT_MIN);
  kpiRow("Events / session", eventsPerSession.toFixed(1), null);
  w(`  Sessions: searched=${Number(sess.searched)} results=${Number(sess.got_results)} compared=${Number(sess.compared)} exited=${Number(sess.exited)}\n`);

  w(`BY SURFACE (REAL):`);
  if (!surfaces.length) w(`  (none yet)`);
  for (const s of surfaces) w(`  ${String(s.source).padEnd(14)} sessions=${s.sessions} search=${s.search} results=${s.results} outbound=${s.outbound}`);
  w("");

  w(`TOP DEMAND — categories asked (REAL):`);
  if (!cats.length) w(`  (none yet)`);
  cats.forEach((r) => w(`  ${String(r.category).padEnd(18)} ${r.n}`));
  w("");

  w(`UNMET DEMAND — no-answer queries (REAL, prioritize these):`);
  if (!na.length) w(`  (none yet)`);
  na.forEach((r) => w(`  ${r.n}×  ${String(r.query_text).slice(0, 60)}`));
  w("");

  w(`MEASURED EXITS (outbound_clicks — /go-routed only; storefront exits appear as go_click events above):`);
  if (!oc.length) w(`  (none yet)`);
  for (const r of oc) w(`  [${r.is_test ? "TEST" : "REAL"}] clicks=${r.n} distinct_products=${r.products} monetized=${r.monetized}`);
  w("");

  w(`LAUNCH-READINESS GATE:`);
  for (const ck of checks) w(`  [${pass(ck.ok)}] ${ck.k.padEnd(28)} actual=${ck.v}`);
  w(`\n  VERDICT: ${verdict}`);
  w(`\nReproduce: npm run tps:usage · durable copy: docs/BETA-FUNNEL.md\n`);

  // Markdown artifact.
  const md = [
    `# Tawveeri — Private Beta Funnel Dashboard`,
    ``,
    `_Generated ${new Date(now).toISOString()} from production (\`vyceqrzttspyycdpojtn\`). Re-run: \`npm run tps:usage\`._`,
    `REAL = live customers · TEST (\`?test=1\`/bots) excluded from every metric.`,
    ``,
    `## Verdict`,
    `**${verdict}**`,
    ``,
    `## Funnel (REAL) — Search → Results → Product View → Comparison → Evidence → Outbound`,
    `| Step | Count | Conversion from prev |`,
    `|---|--:|--:|`,
    `| 1 Search | ${real.search} | — |`,
    `| 2 Results | ${real.results} | ${fpct(pct(real.results, real.search))} |`,
    `| 3 Product View | ${real.product_view} | ${fpct(pct(real.product_view, real.results))} |`,
    `| 4 Comparison | ${real.comparison_view} | ${fpct(pct(real.comparison_view, real.product_view))} |`,
    `| 5 Evidence | ${real.evidence_view} | ${fpct(pct(real.evidence_view, real.comparison_view))} |`,
    `| 6 Outbound | ${real.outbound} | ${fpct(pct(real.outbound, real.comparison_view))} |`,
    ``,
    `Off-funnel: no_answer=${real.no_answer}, errors=${real.errors}. Overall **Search→Outbound = ${fpct(searchToExit)}**.`,
    ``,
    `## KPIs vs launch thresholds`,
    `| KPI | Actual | Threshold | Status |`,
    `|---|--:|--:|:--:|`,
    `| Answer rate | ${fpct(answerRate)} | ≥ ${fpct(KPI.ANSWER_RATE_MIN)} | ${pass(answerRate >= KPI.ANSWER_RATE_MIN)} |`,
    `| No-answer rate | ${fpct(noAnswerRate)} | ≤ ${fpct(KPI.NOANSWER_RATE_MAX)} | ${pass(noAnswerRate <= KPI.NOANSWER_RATE_MAX)} |`,
    `| Search→Product View | ${fpct(searchToProduct)} | — | — |`,
    `| Product→Comparison | ${fpct(productToCompare)} | — | — |`,
    `| Comparison→Exit (CTR) | ${fpct(compareToExit)} | ≥ ${fpct(KPI.COMPARE_TO_EXIT_MIN)} | ${pass(compareToExit >= KPI.COMPARE_TO_EXIT_MIN)} |`,
    `| Search→Exit (overall) | ${fpct(searchToExit)} | ≥ ${fpct(KPI.SEARCH_TO_EXIT_MIN)} | ${pass(searchToExit >= KPI.SEARCH_TO_EXIT_MIN)} |`,
    `| Real sessions | ${real.sessions} | ≥ ${KPI.MIN_SESSIONS} | ${pass(real.sessions >= KPI.MIN_SESSIONS)} |`,
    `| Measured exits | ${real.outbound} | ≥ ${KPI.MIN_OUTBOUND} | ${pass(real.outbound >= KPI.MIN_OUTBOUND)} |`,
    ``,
    `## By surface (REAL)`,
    `| Surface | Sessions | Search | Results | Outbound |`,
    `|---|--:|--:|--:|--:|`,
    ...(surfaces.length ? surfaces.map((s) => `| ${s.source} | ${s.sessions} | ${s.search} | ${s.results} | ${s.outbound} |`) : [`| (none yet) | | | | |`]),
    ``,
    `## Top demand (REAL)`,
    ...(cats.length ? cats.map((r) => `- ${r.category}: ${r.n}`) : [`- (none yet)`]),
    ``,
    `## Unmet demand — no-answer queries (REAL)`,
    ...(na.length ? na.map((r) => `- ${r.n}× ${String(r.query_text).slice(0, 60)}`) : [`- (none yet)`]),
    ``,
    `## Measured exits (outbound_clicks)`,
    `REAL: clicks=${Number(ocReal?.n ?? 0)}, distinct_products=${Number(ocReal?.products ?? 0)}, monetized=${Number(ocReal?.monetized ?? 0)}.`,
    `(Storefront exits bypass /go and are counted via the \`go_click\` event in the funnel above, not here.)`,
    ``,
  ].join("\n");
  writeFileSync(resolve(process.cwd(), "docs/BETA-FUNNEL.md"), md);

  await c.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
