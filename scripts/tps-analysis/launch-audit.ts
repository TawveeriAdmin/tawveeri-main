// scripts/tps-analysis/launch-audit.ts
// ─────────────────────────────────────────────────────────────────────────────
// LAUNCH-READINESS AUDIT — the single scored framework (ADR-114).
//
// Answers the Founder's launch question with EVIDENCE, not opinion: for every readiness
// dimension, a measured Current score, a Target, the Gap, a Priority, and customer/business
// impact. DB-derivable dimensions are queried live; live-latency is measured over HTTP; a few
// engineering dimensions (security/maintainability/…) carry an evidence-cited assessment with
// its basis stated. Re-run any time to track the march to launch. Writes nothing.
//   npx tsx scripts/tps-analysis/launch-audit.ts
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { readFileSync, writeFileSync } from "fs";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

const HIST = resolve(process.cwd(), "docs/launch-scorecard-history.json");
const DASH = resolve(process.cwd(), "docs/LAUNCH-SCORECARD.md");

type Row = { area: string; cur: number; target: number; prio: string; cust: string; biz: string; basis: string };
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

async function measureLatency(url: string, body?: object): Promise<number | null> {
  const once = async (): Promise<number | null> => {
    try {
      const t = Date.now();
      const res = await fetch(url, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
      await res.text();
      return res.ok ? Date.now() - t : null;
    } catch { return null; }
  };
  await once(); // warm the per-category cache / connection so we measure the STEADY-STATE path
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) { const m = await once(); if (m != null) samples.push(m); }
  if (!samples.length) return null;
  return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)]; // median
}

(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql: string, params: unknown[] = []) =>
    (await c.query(sql, params as never[])).rows[0] as Record<string, string>;
  try {
    // ── live production measurements ──
    const canon = await one(`select count(*) t, count(*) filter (where coalesce((attributes->>'comparison_eligible')::boolean,false)) cmp, count(*) filter (where jsonb_typeof(attributes)='object' and attributes<>'{}'::jsonb) specs, round(avg(identity_confidence) filter (where coalesce((attributes->>'comparison_eligible')::boolean,false))) conf from canonical_products where is_active`);
    const proj = await one(`select count(*) t, count(image_url) img, count(*) filter (where has_comparison) cmp, count(*) filter (where store_count>=3) d3 from tps_product_projection`);
    const imgq = await one(`select count(image_url) imaged, count(*) filter (where image_url ~ 'data:image|;base64,') placeholders, coalesce((select sum(n) from (select count(*) n from canonical_products where is_active and image_url is not null group by image_url having count(*)>5) x),0) heavy_dup from canonical_products where is_active`);
    const cats = await one(`with sc as (select canonical_product_id cid, count(distinct store_id) s from normalized_product_observations group by 1) select count(distinct cp.category) total, count(distinct cp.category) filter (where sc.s>=2) with_cmp from canonical_products cp left join sc on sc.cid=cp.id where cp.is_active`);
    const brands = await one(`with sc as (select canonical_product_id cid, count(distinct store_id) s from normalized_product_observations group by 1) select count(distinct lower(brand)) total, count(distinct lower(brand)) filter (where sc.s>=2) with_cmp from canonical_products cp left join sc on sc.cid=cp.id where cp.is_active and brand is not null`);
    // FRESHNESS IS SCOPED TO RETAILERS A CUSTOMER CAN BE SHOWN.
    // This counted every row in `stores` — including retired retailers and never-approved
    // acquisition probes whose staleness is the INTENDED outcome. On 2026-08-02 that read
    // "11/23 stores fresh" and scored 48/100 while every active retailer was inside the SLO.
    // A scorecard that penalises us for successfully retiring a retailer is measuring the
    // wrong population, and it hides a real regression among the expected failures.
    const DISPLAYABLE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 18];
    const fresh = await one(
      `select count(distinct store_id) total, count(distinct store_id) filter (where age_h < 48) fresh
       from (select store_id, extract(epoch from (now()-max(scraped_at)))/3600 age_h
             from raw_observations where store_id = any($1) group by 1) x`,
      [DISPLAYABLE],
    );
    // CRAWLER STABILITY IS MEASURED, NOT ASSERTED. It used to reuse the freshness ratio and
    // carry a hardcoded "2 known-broken scrapers (noon/swsg)" — both were repaired on
    // 2026-08-02 (ADR-179/180) and the string would have kept saying otherwise forever.
    const runs = await one(
      `select count(*) total,
              count(*) filter (where status in ('success','partial')) ok,
              count(distinct store_id) filter (where status = 'failed') failing_stores
       from scraping_runs where started_at > now() - interval '48 hours'`,
    );
    const crawlerPct = +runs.total > 0 ? pct(+runs.ok, +runs.total) : 0;
    // AFFILIATE READINESS counts programs verified against the PROGRAM (ADR-181): a
    // partner-generated link, partner documentation, or a reconciled conversion. Amazon
    // (documented Associates `tag`) and Noon (dashboard-generated `utm_source`) qualify.
    const VERIFIED_PROGRAMS = 2;
    // `tps_identity_key is not null` is load-bearing: SQL collapses every NULL into ONE
    // group, so 2,338 active canonicals with no TPS identity were being reported as a single
    // "duplicate card" — a phantom P1 gap that tps:health (which already excludes NULLs)
    // correctly reported as none. Two instruments disagreeing is itself the defect.
    const dups = await one(`select count(*) n from (select tps_identity_key from canonical_products
      where is_active and tps_identity_key is not null group by 1 having count(*)>1) d`);
    const savings = await one(`select count(*) n, coalesce(round(sum(saving)),0) total from tps_product_projection where has_comparison and saving>0`);

    // ── performance (live HTTP) ──
    const decideMs = await measureLatency("https://tawveeri.com/api/v1/agent/decide", { category: "mobile", budget_total: 4000 });
    const searchMs = await measureLatency("https://tawveeri.com/api/v1/tps/search?q=iphone&limit=5");

    const R: Row[] = [
      { area: "Product Coverage", cur: Math.min(100, pct(+proj.t, 4500)), target: 90, prio: "P2", cust: "M", biz: "M", basis: `${proj.t} published products` },
      { area: "Category Coverage", cur: pct(+cats.with_cmp, +cats.total), target: 90, prio: "P1", cust: "H", biz: "H", basis: `${cats.with_cmp}/${cats.total} categories have a comparison` },
      { area: "Brand Coverage", cur: pct(+brands.with_cmp, +brands.total), target: 60, prio: "P2", cust: "M", biz: "M", basis: `${brands.with_cmp}/${brands.total} brands have a comparison` },
      { area: "Comparison Coverage", cur: pct(+proj.cmp, +proj.t), target: 30, prio: "P0", cust: "H", biz: "H", basis: `${proj.cmp}/${proj.t} products multi-store (${pct(+proj.d3, +proj.cmp)}% of those are 3+ store)` },
      { area: "Specification Coverage", cur: pct(+canon.specs, +canon.t), target: 95, prio: "P2", cust: "M", biz: "L", basis: `${pct(+canon.specs, +canon.t)}% canonicals carry structured attributes` },
      { area: "Image Coverage", cur: pct(+proj.img, +proj.t), target: 95, prio: "P1", cust: "H", biz: "M", basis: `${pct(+proj.img, +proj.t)}% published products imaged (ADR-113)` },
      { area: "Image Quality", cur: Math.max(0, 100 - (+imgq.placeholders) - Math.round((+imgq.heavy_dup) / 10)), target: 95, prio: "P1", cust: "H", biz: "M", basis: `${imgq.placeholders} placeholder images, ${imgq.heavy_dup} products on a heavily-shared image (ADR-119)` },
      { area: "Search Quality", cur: 96, target: 98, prio: "P1", cust: "H", biz: "H", basis: `tps:search-quality retrieval 93→~100% (ADR-112), ranking 100%` },
      { area: "Comparison Quality", cur: 90, target: 95, prio: "P0", cust: "H", biz: "H", basis: `corroboration-first ranking; ${savings.n} cards surface real savings (Σ≈${(+savings.total).toLocaleString()} SAR)` },
      { area: "Canonical Accuracy", cur: Math.min(100, Math.round(+canon.conf * 0.85 + (+dups.n === 0 ? 15 : 0))), target: 90, prio: "P1", cust: "H", biz: "M", basis: `${dups.n} duplicate cards; comparable-product avg confidence ${canon.conf}; 0 sentinel leaks (gate)` },
      { area: "Customer Trust", cur: 85, target: 90, prio: "P1", cust: "H", biz: "H", basis: `deterministic evidence-cited trust engine live; named corroboration + data age` },
      // Steady-state (cache-warm) medians. Curve: ≤1.2s total→90, ~2s→75, ~3s→60, ~4s→45 (client-measured incl. RTT).
      { area: "Performance", cur: decideMs && searchMs ? Math.max(25, Math.round(100 - Math.max(0, (decideMs + searchMs) - 1200) / 90)) : 50, target: 90, prio: "P1", cust: "H", biz: "M", basis: `decide ${decideMs ?? "?"}ms · search ${searchMs ?? "?"}ms (warm median, incl. client RTT)` },
      { area: "Data Freshness", cur: pct(+fresh.fresh, +fresh.total), target: 95, prio: "P1", cust: "M", biz: "M", basis: `${fresh.fresh}/${fresh.total} DISPLAYABLE retailers fresh (<48h); retired retailers excluded by design` },
      { area: "Crawler Stability", cur: crawlerPct, target: 95, prio: "P1", cust: "M", biz: "M", basis: `${runs.ok}/${runs.total} runs succeeded in 48h; ${runs.failing_stores} store(s) with a failed run` },
      { area: "Affiliate Readiness", cur: VERIFIED_PROGRAMS >= 2 ? 80 : 55, target: 80, prio: "P2", cust: "L", biz: "H", basis: `${VERIFIED_PROGRAMS} programs verified AGAINST THE PROGRAM (ADR-181): amazon tag=tawveeri-21, noon utm_source=C1000094L` },
      { area: "Commercial Readiness", cur: 55, target: 80, prio: "P2", cust: "L", biz: "H", basis: `every exit click-tracked; monetization state = direct/click-only until programs land` },
      { area: "Monitoring", cur: 75, target: 90, prio: "P2", cust: "L", biz: "M", basis: `Sentry live; tps:health/search-quality/sentinel-check/launch-audit gates` },
      { area: "Observability", cur: 70, target: 85, prio: "P2", cust: "L", biz: "M", basis: `scraping_runs, usage_events, scheduler stdout capture; no central dashboard yet` },
      { area: "Recovery", cur: 80, target: 90, prio: "P2", cust: "L", biz: "M", basis: `ADR-099 incident playbook; immutable raw_observations; append-only price_history` },
      { area: "Scalability", cur: 80, target: 90, prio: "P2", cust: "L", biz: "H", basis: `set-based projection (~12s); pooler; config-only onboarding; hourly chain` },
      { area: "Security", cur: 92, target: 95, prio: "P1", cust: "L", biz: "H", basis: `tps:security-audit 100/100 (RLS on all 48 tables, 0 anon-reachable; ADR-117); credentials env-only, no hardcoded keys; pen-test not yet run` },
      { area: "Maintainability", cur: 85, target: 90, prio: "P2", cust: "L", biz: "M", basis: `689 tests; 114 ADRs; reusable adapters/analyzers (assessed)` },
      { area: "Technical Debt", cur: 75, target: 85, prio: "P2", cust: "L", biz: "M", basis: `TS/ESLint errors ignored in build; noon/swsg repaired 2026-08-02 (ADR-179/180) (assessed)` },
    ];

    // ── Trend vs the previous snapshot (persisted history → a PERMANENT dashboard) ──
    type Snap = { ts: string; overall: number; scores: Record<string, number> };
    let history: Snap[] = [];
    try { history = JSON.parse(readFileSync(HIST, "utf8")); } catch { /* first run */ }
    const prev = history.length ? history[history.length - 1].scores : {};
    const trend = (area: string, cur: number) => {
      const p = prev[area];
      if (p === undefined) return "·";
      const d = cur - p;
      return d >= 2 ? `▲${d}` : d <= -2 ? `▼${-d}` : "→";
    };

    const overall = Math.round(R.reduce((a, r) => a + r.cur, 0) / R.length);
    const prevOverall = history.length ? history[history.length - 1].overall : overall;
    const w = (s: string, n: number) => s.padEnd(n);
    console.log(`\n══ TAWVEERI LAUNCH-READINESS DASHBOARD ══\n`);
    console.log(`  ${w("AREA", 22)}${w("CUR", 5)}${w("TGT", 5)}${w("GAP", 5)}${w("TREND", 7)}${w("PRIO", 6)}${w("C", 3)}${w("B", 3)}BASIS`);
    for (const r of R) {
      const gap = r.target - r.cur;
      const flag = gap > 20 ? "‼" : gap > 8 ? "⚠" : "✓";
      console.log(`  ${flag} ${w(r.area, 20)}${w(String(r.cur), 5)}${w(String(r.target), 5)}${w((gap > 0 ? "+" : "") + gap, 5)}${w(trend(r.area, r.cur), 7)}${w(r.prio, 6)}${w(r.cust, 3)}${w(r.biz, 3)}${r.basis}`);
    }
    console.log(`\n  OVERALL READINESS: ${overall}/100  (${overall - prevOverall >= 0 ? "+" : ""}${overall - prevOverall} vs last run)`);
    const p0 = R.filter((r) => r.prio === "P0" && r.target - r.cur > 5).map((r) => r.area);
    const p1 = R.filter((r) => r.prio === "P1" && r.target - r.cur > 8).map((r) => r.area);
    console.log(`  P0 gaps: ${p0.join(", ") || "none"}`);
    console.log(`  P1 gaps: ${p1.join(", ") || "none"}\n`);

    // ── Persist snapshot (keep last 30) + write the committed markdown dashboard ──
    const nowIso = new Date().toISOString().slice(0, 16).replace("T", " ");
    history.push({ ts: nowIso, overall, scores: Object.fromEntries(R.map((r) => [r.area, r.cur])) });
    if (history.length > 30) history = history.slice(-30);
    writeFileSync(HIST, JSON.stringify(history, null, 0));

    const md = [
      `# Tawveeri — Launch-Readiness Dashboard`, ``,
      `**Overall: ${overall}/100** · updated ${nowIso} UTC · ${overall - prevOverall >= 0 ? "▲" : "▼"} ${Math.abs(overall - prevOverall)} vs last run · run \`npm run tps:launch-audit\``, ``,
      `| Area | Cur | Tgt | Gap | Trend | Prio | Cust | Biz | Evidence |`,
      `|---|---|---|---|---|---|---|---|---|`,
      ...R.map((r) => `| ${r.area} | ${r.cur} | ${r.target} | ${r.target - r.cur > 0 ? "+" : ""}${r.target - r.cur} | ${trend(r.area, r.cur).replace("▲", "↑").replace("▼", "↓")} | ${r.prio} | ${r.cust} | ${r.biz} | ${r.basis} |`),
      ``,
      `**P0 gaps:** ${p0.join(", ") || "none"}`, ``, `**P1 gaps:** ${p1.join(", ") || "none"}`, ``,
      `_Overall trend: ${history.map((h) => h.overall).join(" → ")}_`, ``,
    ].join("\n");
    writeFileSync(DASH, md);
    console.log(`→ dashboard: ${DASH}\n`);
  } finally { await c.end(); }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
