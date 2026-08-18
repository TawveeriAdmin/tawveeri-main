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
import { parseShoppingTask } from "../../src/lib/agent/task-parser";
import { buildFunnel as buildFunnelShared, buildSessionFunnel, sessionRate, buildHomeMissionStats, type UsageEventRow, type OutboundClickRow } from "../../src/lib/admin/command-center-queries";

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
  // ADR-214: the unified /search page can fire BOTH a storefront event (search/results) AND an
  // advisor event (advisor_query/advisor_result) for the SAME user action when a query routes to
  // the advisor — a plain FILTER-based count double-counts that action. Fetch raw rows and dedupe
  // via the SAME clustering logic the live /admin/command-center dashboard uses
  // (src/lib/admin/command-center-queries.ts buildFunnel) so the CLI artifact and the live
  // dashboard can never silently diverge — "Trust is one thing, computed one way."
  const rawEventRows = (await c.query(
    `select event_type, session_id, is_test, source, category, query_text, canonical_id, created_at, meta
     from usage_events`
  )).rows as UsageEventRow[];
  // ADR-244: funnel step 6 (Outbound) reads the exit LEDGER (outbound_clicks), not the
  // go_click client event — measured 1 event vs 282 real ledger exits when this changed.
  // Same shared buildFunnel as the live dashboard, same inputs, so they cannot diverge.
  const rawOutboundRows = (await c.query(
    `select is_test, canonical_product_id, affiliate_program, store_name, clicked_at, session_id, campaign, source
     from outbound_clicks`
  )).rows as unknown as OutboundClickRow[];
  const grab = (test: boolean): Funnel => {
    const f = buildFunnelShared(
      rawEventRows.filter((r) => Boolean(r.is_test) === test),
      rawOutboundRows.filter((r) => Boolean(r.is_test) === test),
    );
    return { search: f.search, results: f.results, product_view: f.productView,
      comparison_view: f.comparisonView, evidence_view: f.evidenceView, outbound: f.outbound,
      no_answer: f.noAnswer, errors: f.errors, sessions: f.sessions };
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

  // ── ENTRY EXPERIMENT: advisor-first (champion) vs search-first (control) ──────
  // Session-level conversion is the right unit for an A/B: what fraction of VISITORS on
  // each arm reached each journey stage. Arm lives in meta->>'variant'.
  const variantRows = await rows(`
    select coalesce(meta->>'variant','(unassigned)') variant,
      count(distinct session_id)                                                    sessions,
      count(distinct session_id) filter (where event_type='landing_view')           landed,
      count(distinct session_id) filter (where event_type in ('search','advisor_query')) searched,
      count(distinct session_id) filter (where event_type='product_view')           viewed,
      count(distinct session_id) filter (where event_type='comparison_view')         compared,
      count(distinct session_id) filter (where event_type='evidence_view')           evidenced,
      count(distinct session_id) filter (where event_type='go_click')                exited
    from usage_events where is_test=false group by 1`);
  // Retention: a returning visitor is a session_id active on ≥2 distinct calendar days.
  const retentionRows = await rows(`
    select variant, count(*) total, count(*) filter (where days >= 2) ret from (
      select session_id, min(meta->>'variant') variant, count(distinct created_at::date) days
      from usage_events where is_test=false group by session_id
    ) q group by variant`);
  const armMetric = (v: string, k: string) => Number(variantRows.find((r) => r.variant === v)?.[k] ?? 0);
  const retMetric = (v: string) => { const r = retentionRows.find((x) => x.variant === v); return { total: Number(r?.total ?? 0), returning: Number(r?.ret ?? 0) }; };
  const ARMS = ["advisor", "search"] as const;

  // Demand + unmet demand + measured economics.
  // ── DEMAND BY CATEGORY (ADR-259) ──────────────────────────────────────────────────
  // MEASURED 2026-08-18: 2,340 of ~2,600 category-bearing events grouped under
  // "(unparsed)" — roughly 90% — so the demand table the founder uses to pick the next
  // category was effectively blind. The cause is not a parse failure: `usage_events.category`
  // is only populated when the client had a category to send (a sidebar filter, or an
  // advisor route that resolved one). A free-typed «ابي مكيف» carries no category column
  // at all, which the old label misreported as "unparsed".
  //
  // Fixed read-side, without touching the immutable event rows: where the column is null we
  // DERIVE the category from query_text using `parseShoppingTask` — the same deterministic
  // parser the search route and the decision engine already use, so the report cannot
  // disagree with the product about what a sentence means. Derived counts are reported in
  // their own column and never silently merged into recorded ones; a sentence the parser
  // cannot categorize stays honestly uncategorized.
  const catRows = await rows(`select category, query_text, count(*) n from usage_events
      where is_test=false and event_type in ('search','advisor_query','results','advisor_result')
      group by 1,2`) as Array<{ category: string | null; query_text: string | null; n: number }>;
  const catAgg = new Map<string, { recorded: number; derived: number }>();
  let uncategorized = 0;
  for (const r of catRows) {
    const n = Number(r.n);
    const bump = (key: string, kind: 'recorded' | 'derived') => {
      const cur = catAgg.get(key) ?? { recorded: 0, derived: 0 };
      cur[kind] += n;
      catAgg.set(key, cur);
    };
    if (r.category) { bump(r.category, 'recorded'); continue; }
    const derived = r.query_text ? parseShoppingTask(r.query_text)?.category : null;
    if (derived) bump(derived, 'derived'); else uncategorized += n;
  }
  const cats = [...catAgg.entries()]
    .map(([category, v]) => ({ category, n: v.recorded + v.derived, recorded: v.recorded, derived: v.derived }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);
  const na = await rows(`select query_text, count(*) n from usage_events where is_test=false and event_type='no_answer' and query_text is not null group by 1 order by 2 desc limit 10`);
  const oc = await rows(`select is_test, count(*) n, count(distinct canonical_product_id) products, count(*) filter (where affiliate_program is not null and affiliate_program<>'direct') monetized from outbound_clicks group by is_test order by is_test`);
  const ocReal = oc.find((r) => !r.is_test);

  // ── Derived KPIs (REAL) ────────────────────────────────────────────────────
  //
  // UNITS (ADR-259). Every CONVERSION rate below is sessions-over-sessions, with the
  // numerator counted only inside sessions that reached the denominator's stage, so 100%
  // is a ceiling by construction. Before this, `compareToExit` divided rows of the
  // outbound_clicks TABLE by comparison_view EVENT rows and reported 2003.6% — as a PASS,
  // on the gate the founder uses to decide whether to send real users.
  //
  // Two rates keep an ACTION denominator on purpose: answer/no-answer describe individual
  // queries, not sessions ("did this search return anything"), and both sides come from
  // the same deduped action stream, so they stay bounded and meaningful.
  const realSess = buildSessionFunnel(rawEventRows.filter((r) => !r.is_test));
  const testSess = buildSessionFunnel(rawEventRows.filter((r) => Boolean(r.is_test)));
  void testSess;

  const answerRate = pct(real.results, real.search);        // actions / actions
  const noAnswerRate = pct(real.no_answer, real.search);    // actions / actions
  const searchToProduct = sessionRate(realSess.searchedAndViewedProduct, realSess.searched);
  const productToCompare = sessionRate(realSess.viewedProductAndComparison, realSess.viewedProduct);
  const compareToExit = sessionRate(realSess.viewedComparisonAndExited, realSess.viewedComparison);
  const searchToExit = sessionRate(realSess.searchedAndExited, realSess.searched);
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
  w(`  NOTE: the six numbers above are EVENT/ACTION VOLUME, not a conversion funnel.`);
  w(`        Step 6 counts outbound_clicks LEDGER rows; steps 3-5 count usage_events.`);
  w(`        "% of prev" therefore compares unlike units and can exceed 100% — it is a`);
  w(`        volume ratio, never a conversion rate. Conversion lives in the KPI block.`);
  w(`  [TEST traffic, excluded]  sessions=${test.sessions} search=${test.search} results=${test.results} outbound=${test.outbound}\n`);

  w(`KPIs vs launch thresholds (REAL):`);
  w(`  Units — conversion rates are SESSIONS/SESSIONS, numerator counted only within`);
  w(`  sessions that reached the prior stage (so 100% is a ceiling). Answer/no-answer`);
  w(`  are ACTIONS/ACTIONS: they describe a query, not a session. (ADR-259)`);
  const kpiRow = (name: string, val: string, ok: boolean | null) =>
    w(`  ${name.padEnd(30)} ${val.padStart(8)}   ${ok === null ? "" : pass(ok)}`);
  kpiRow("Answer rate [actions]", fpct(answerRate), answerRate >= KPI.ANSWER_RATE_MIN);
  kpiRow("No-answer rate [actions]", fpct(noAnswerRate), noAnswerRate <= KPI.NOANSWER_RATE_MAX);
  kpiRow("Search→Product View [sessions]", fpct(searchToProduct), null);
  kpiRow("Product→Comparison [sessions]", fpct(productToCompare), null);
  kpiRow("Comparison→Exit [sessions]", fpct(compareToExit), compareToExit >= KPI.COMPARE_TO_EXIT_MIN);
  kpiRow("Search→Exit [sessions]", fpct(searchToExit), searchToExit >= KPI.SEARCH_TO_EXIT_MIN);
  kpiRow("Events / session [volume]", eventsPerSession.toFixed(1), null);
  w(`  Session denominators: total=${realSess.sessions} searched=${realSess.searched} ` +
    `results=${realSess.gotResults} product=${realSess.viewedProduct} ` +
    `compared=${realSess.viewedComparison} exited=${realSess.exited}`);
  w(`  Stage intersections:  searched&product=${realSess.searchedAndViewedProduct} ` +
    `compared&exited=${realSess.viewedComparisonAndExited} searched&exited=${realSess.searchedAndExited}`);
  w(`  Exit LEDGER (outbound_clicks, all-time REAL): ${real.outbound} rows — exit VOLUME,`);
  w(`  deliberately NOT divided by any session count. Only go_click carries a session id.\n`);

  w(`BY SURFACE (REAL):`);
  if (!surfaces.length) w(`  (none yet)`);
  for (const s of surfaces) w(`  ${String(s.source).padEnd(14)} sessions=${s.sessions} search=${s.search} results=${s.results} outbound=${s.outbound}`);
  w("");

  // Entry experiment comparison (the founder's 8 dimensions, per arm, session-level).
  w(`ENTRY EXPERIMENT — advisor-first (champion) vs search-first (control), REAL, session-level:`);
  const arm = (v: string) => {
    const sess = armMetric(v, "sessions");
    const rate = (k: string) => fpct(pct(armMetric(v, k), sess));
    const ret = retMetric(v);
    return { sess, landed: armMetric(v, "landed"), searched: rate("searched"), viewed: rate("viewed"),
      compared: rate("compared"), evidenced: rate("evidenced"), exited: rate("exited"),
      completion: fpct(pct(armMetric(v, "exited"), sess)), retention: fpct(pct(ret.returning, ret.total)) };
  };
  const A = arm("advisor"), S = arm("search");
  const row2 = (label: string, a: string | number, s: string | number) =>
    w(`  ${label.padEnd(22)} advisor=${String(a).padStart(8)}   search=${String(s).padStart(8)}`);
  row2("Sessions (n)", A.sess, S.sess);
  row2("Search usage", A.searched, S.searched);
  row2("Product views", A.viewed, S.viewed);
  row2("Comparison usage", A.compared, S.compared);
  row2("Evidence interaction", A.evidenced, S.evidenced);
  row2("Outbound clicks", A.exited, S.exited);
  row2("Session completion", A.completion, S.completion);
  row2("Retention (≥2 days)", A.retention, S.retention);
  // Winner call — only when BOTH arms have a defensible sample.
  const minArm = Math.min(A.sess, S.sess);
  const advExit = pct(armMetric("advisor", "exited"), armMetric("advisor", "sessions"));
  const srchExit = pct(armMetric("search", "exited"), armMetric("search", "sessions"));
  let armVerdict: string;
  if (minArm < 50) armVerdict = `INSUFFICIENT SAMPLE — need ≥50 sessions per arm to call a winner (min arm = ${minArm}).`;
  else if (Math.abs(advExit - srchExit) < 0.02) armVerdict = "NO CLEAR WINNER YET — arms within 2pts on Search→Exit; keep gathering.";
  else armVerdict = advExit > srchExit ? "ADVISOR-FIRST LEADS on Search→Exit." : "SEARCH-FIRST LEADS on Search→Exit — consider flipping the champion (config only).";
  w(`  → ${armVerdict}\n`);

  w(`TOP DEMAND — categories asked (REAL):`);
  w(`  recorded = the event carried a category · derived = parsed from the query text with`);
  w(`  the same parser the product uses (ADR-259). Never merged silently.`);
  if (!cats.length) w(`  (none yet)`);
  cats.forEach((r) => w(`  ${String(r.category).padEnd(18)} ${String(r.n).padStart(5)}   (recorded ${r.recorded} · derived ${r.derived})`));
  w(`  ${"(uncategorized)".padEnd(18)} ${String(uncategorized).padStart(5)}   — no category recorded AND the parser could not name one`);
  w("");

  w(`UNMET DEMAND — no-answer queries (REAL, prioritize these):`);
  if (!na.length) w(`  (none yet)`);
  na.forEach((r) => w(`  ${r.n}×  ${String(r.query_text).slice(0, 60)}`));
  w("");

  w(`MEASURED EXITS (outbound_clicks — /go-routed only; storefront exits appear as go_click events above):`);
  if (!oc.length) w(`  (none yet)`);
  for (const r of oc) w(`  [${r.is_test ? "TEST" : "REAL"}] clicks=${r.n} distinct_products=${r.products} monetized=${r.monetized}`);
  w("");

  // ── TAWVEERI HOME (ADR-257 §8): same pure builder as /admin/command-center — one
  //    computation, two renderers. CLICK ≠ RETURN ≠ SELF-MARKED ≠ verified conversion.
  const hmStats = buildHomeMissionStats(rawEventRows.filter((r) => !r.is_test));
  // The share LEDGER, read server-side. See the note below the counters for why the
  // owner-side event is not trustworthy for creations.
  const sharePlansRow = (await c.query(
    `select count(*)::int total, count(*) filter (where is_test)::int test from shared_home_plans`
  )).rows[0] as { total: number; test: number };
  const sharePlans = { total: sharePlansRow?.total ?? 0, test: sharePlansRow?.test ?? 0 };

  w(`TAWVEERI HOME (REAL — item completion is SELF-reported, never a verified sale):`);
  w(`  sessions=${hmStats.sessions} starts=${hmStats.starts} plans=${hmStats.plans} refines=${hmStats.refines}`);
  w(`  purchase_plan_opens=${hmStats.purchasePlanOpens} retailer_exit_clicks=${hmStats.retailerExitClicks} returns=${hmStats.returnsFromRetailer}`);
  w(`  items_self_marked=${hmStats.itemsSelfMarked} retailers_completed=${hmStats.retailersCompleted} missions_completed=${hmStats.missionsCompleted}`);
  w(`  shares_created=${hmStats.sharesCreated} share_opens=${hmStats.shareOpens} share_feedback=${hmStats.shareFeedback} entry_card_clicks=${hmStats.entryCardClicks}`);
  // ── SHARE LEDGER vs SHARE EVENTS (ADR-259) ────────────────────────────────────────
  // MEASURED 2026-08-18: the REAL funnel showed shares_created=0 alongside share_opens=7
  // and share_feedback=5 — opens without creations, which cannot happen. Cause: sharing is
  // a CROSS-DEVICE flow and the two ends are classified differently. The owner creates the
  // share in a browser carrying tw_admin/tw_test (so `created` is flagged TEST), while the
  // recipient opens the link on another device with neither cookie (so `opened` is REAL).
  // All 8 `created` events are is_test=true; all 7 `opened` and 5 `feedback` are is_test=false.
  // The plans table itself is the authority — it is written server-side, once, per share.
  // This matters for the first real cohort: the share link IS the growth loop, and a
  // founder-seeded share would otherwise read as "nobody is sharing".
  w(`  ── share ledger (shared_home_plans — server-side, the authority):`);
  w(`     plans_created=${sharePlans.total} (test-flagged=${sharePlans.test})`);
  w(`     Owner-side "created" EVENTS are is_test-skewed because the owner's browser carries`);
  w(`     tw_admin/tw_test and the recipient's does not. Trust the ledger for creations and`);
  w(`     the events for opens/feedback until the cohort provides owner sessions without`);
  w(`     those cookies. Do NOT read shares_created=0 as "no shares".`);
  if (hmStats.unsupportedRequests.length) {
    w(`  unsupported-category demand (honest refusals): ${hmStats.unsupportedRequests.map((u) => `${u.term}×${u.count}`).join(" · ")}`);
  }
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
    `## Entry experiment — advisor-first vs search-first (REAL, session-level)`,
    `**${armVerdict}**`,
    ``,
    `| Dimension | Advisor-first | Search-first |`,
    `|---|--:|--:|`,
    `| Sessions (n) | ${A.sess} | ${S.sess} |`,
    `| Search usage | ${A.searched} | ${S.searched} |`,
    `| Product views | ${A.viewed} | ${S.viewed} |`,
    `| Comparison usage | ${A.compared} | ${S.compared} |`,
    `| Evidence interaction | ${A.evidenced} | ${S.evidenced} |`,
    `| Outbound clicks | ${A.exited} | ${S.exited} |`,
    `| Session completion | ${A.completion} | ${S.completion} |`,
    `| Retention (≥2 days) | ${A.retention} | ${S.retention} |`,
    ``,
    `_Champion is config-reversible via \`NEXT_PUBLIC_BETA_ADVISOR_SPLIT\` — flipping it needs no redesign._`,
    ``,
    `## Top demand (REAL)`,
    ...(cats.length ? cats.map((r) => `- ${r.category}: ${r.n} (recorded ${r.recorded}, derived ${r.derived})`) : [`- (none yet)`]),
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
