// scripts/tps-analysis/platform-health.ts
// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM FRESHNESS & PROPAGATION MONITOR (ADR-062)
//
// Tawveeri ingests continuously but its intelligence is DERIVED in a chain:
//   raw_observations → staging → canonicals → projection → search index
//                    ↘ listing facts → merchant trust        ↘ edges
// Every link is a separate script. Nothing enforced that they ran, and nothing
// noticed when they didn't — so improvements could sit invisible to users while
// every dashboard still looked healthy.
//
// Measured on 2026-07-23: the search index held 394 of 1,215 products and had
// not been rebuilt in ~34 hours. **68% of the catalog was unsearchable**, including
// a full day of identity work. `scraping_schedules` was empty, and no intelligence
// refresh job was scheduled at all. Constitution Art. IX: only verified production
// value counts — value that never propagates is not value.
//
// This is the single command that answers: is every derived layer current with
// respect to its evidence, and is anything stuck? Read-only; exits non-zero on
// any FAIL so it can gate a deploy or drive an alert.
//
// Usage: npm run tps:health [-- --json]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";

type Level = "OK" | "WARN" | "FAIL";
interface Check {
  layer: string;
  check: string;
  level: Level;
  detail: string;
  /** How the number was derived, so a verdict is never unexplained. */
  evidence?: string;
}

const checks: Check[] = [];
const add = (layer: string, check: string, level: Level, detail: string, evidence?: string) =>
  checks.push({ layer, check, level, detail, evidence });

const hours = (a: Date | null, b: Date | null): number | null =>
  a && b ? (a.getTime() - b.getTime()) / 3_600_000 : null;

(async () => {
  const url = process.env.SUPABASE_DB_URL!;
  if (!/db\.vyceqrzttspyycdpojtn\.supabase\.co/.test(url)) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");
  const one = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T> =>
    (await pg.query(sql, p as never[])).rows[0] as T;

  // ── 1. INGESTION — is evidence still arriving, per store? ──────────────────
  const ing = await pg.query(`
    select s.id, s.slug,
           max(o.scraped_at) last_obs,
           count(o.id)::int n
    from stores s left join raw_observations o on o.store_id = s.id
    group by 1,2 order by 1`);
  for (const r of ing.rows) {
    const last = r.last_obs ? new Date(r.last_obs) : null;
    const age = hours(new Date(), last);
    if (!r.n) { add("ingestion", r.slug, "WARN", "never ingested", "0 observations"); continue; }
    const level: Level = age === null ? "FAIL" : age > 48 ? "FAIL" : age > 26 ? "WARN" : "OK";
    add("ingestion", r.slug, level, age === null ? "no timestamp" : `${age.toFixed(1)}h since last observation`, `${r.n} observations`);
  }

  // ── 2. STUCK JOBS ─────────────────────────────────────────────────────────
  // Severity depends on whether the run belongs to a SCHEDULE. The partial
  // unique index permits one running row PER SCHEDULE, so only a stuck row with
  // a schedule_id actually blocks future dispatch; an ad-hoc run that died is a
  // real signal but blocks nothing. Stating more than that would overclaim.
  const stuck = await one<{ n: number; scheduled: number; oldest: string | null }>(`
    select count(*)::int n,
           count(*) filter (where schedule_id is not null)::int scheduled,
           min(started_at)::text oldest
    from scraping_runs where status = 'running' and started_at < now() - interval '2 hours'`);
  add("automation", "stuck scraping runs",
    stuck.scheduled > 0 ? "FAIL" : stuck.n > 0 ? "WARN" : "OK",
    stuck.n > 0 ? `${stuck.n} run(s) still 'running' since ${stuck.oldest}` : "none",
    stuck.n > 0
      ? `${stuck.scheduled} belong to a schedule (those block dispatch); ${stuck.n - stuck.scheduled} are ad-hoc runs that died without finishing`
      : undefined);

  // ── 3. HOW IS INGESTION ACTUALLY DRIVEN? ──────────────────────────────────
  // An empty schedule table is only a failure if nothing else is ingesting.
  // Measured: every run carries schedule_id = null, so ingestion is driven
  // externally (a platform cron hitting the per-store routes) and the in-DB
  // dispatcher is effectively unused. Report that fact rather than a false alarm.
  const sched = await one<{ total: number; active: number }>(
    `select count(*)::int total, count(*) filter (where is_active)::int active from scraping_schedules`);
  const viaSchedule = await one<{ n: number }>(
    `select count(*)::int n from scraping_runs where schedule_id is not null and started_at > now() - interval '7 days'`);
  const ingestingNow = ing.rows.some((r) => r.last_obs && hours(new Date(), new Date(r.last_obs))! < 26);
  add("automation", "ingestion driver",
    ingestingNow ? (sched.active === 0 ? "WARN" : "OK") : "FAIL",
    sched.active === 0
      ? `dispatcher idle (0 active schedules); ingestion is running from an external trigger`
      : `${sched.active} active schedule(s)`,
    sched.active === 0
      ? `${viaSchedule.n} scheduled runs in 7 days — every recent run has schedule_id = null, so the in-DB dispatcher is unused`
      : undefined);

  // ── 3b. INTELLIGENCE REFRESH — the chain that turns evidence into value ───
  // Nothing schedules projection / search / facts / trust / edges. This is the
  // gap that left 68% of the catalog unsearchable for ~34 hours. The propagation
  // checks below measure the symptom precisely; this states the cause.
  add("automation", "intelligence refresh",
    sched.active === 0 && viaSchedule.n === 0 ? "WARN" : "OK",
    "no scheduled job rebuilds projection → search index → facts → trust → edges",
    "each link is a manual script; the SEARCH and PRICE checks below detect the drift it causes");

  // ── 4. IDENTITY — observations that have never been considered ────────────
  // This check previously compared max(scraped_at) to max(staging.observed_at).
  // That was WRONG: `observed_at` is the time staging was WRITTEN, so it reset to
  // "now" after any run and reported ~0h lag even with a real backlog. The
  // unambiguous measure is the id backlog — observations newer than anything the
  // normalizer has ever looked at.
  const stg = await one<{ obs: number; staged: number; backlog: number }>(`
    select (select count(*) from raw_observations)::int obs,
           (select count(distinct raw_obs_id) from tps_identity_staging)::int staged,
           (select count(*) from raw_observations
             where id > (select coalesce(max(raw_obs_id), 0) from tps_identity_staging))::int backlog`);
  add("identity", "unprocessed observations",
    stg.backlog > 20000 ? "FAIL" : stg.backlog > 2000 ? "WARN" : "OK",
    stg.backlog === 0 ? "none — normalizer is current" : `${stg.backlog} observations never considered for identity`,
    `${stg.staged} of ${stg.obs} observations have been staged; the chain's 'normalize' step clears this hourly`);

  // ── 5. PROJECTION — canonicals written after the projection was built ─────
  const proj = await one<{ behind: number; total: number; built: string | null }>(`
    select (select count(*) from canonical_products c
            where c.is_active and c.data_updated_at > coalesce((select max(built_at) from tps_product_projection), 'epoch'))::int behind,
           (select count(*) from tps_product_projection)::int total,
           (select max(built_at)::text from tps_product_projection) built`);
  add("comparison", "projection freshness", proj.behind > 0 ? "WARN" : "OK",
    proj.behind > 0 ? `${proj.behind} canonical(s) changed after the last projection build` : "current",
    `${proj.total} projection rows, built ${proj.built}`);

  // ── 6. SEARCH INDEX — the failure this monitor was built for ──────────────
  const idx = await one<{ total: number; unsynced: number; stale: number; last: string | null }>(`
    select count(*)::int total,
           count(*) filter (where algolia_synced_at is null)::int unsynced,
           count(*) filter (where algolia_synced_at is not null and updated_at > algolia_synced_at)::int stale,
           max(algolia_synced_at)::text last
    from tps_product_projection`);
  const invisible = idx.unsynced + idx.stale;
  const pct = idx.total ? (100 * invisible) / idx.total : 0;
  add("search", "index propagation", invisible === 0 ? "OK" : pct > 10 ? "FAIL" : "WARN",
    invisible === 0 ? "every product is searchable"
      : `${invisible} of ${idx.total} products (${pct.toFixed(1)}%) are missing or stale in search`,
    `${idx.unsynced} never synced, ${idx.stale} changed since sync; last sync ${idx.last}`);

  // ── 6b. CUSTOMER-FACING COMPLETENESS ─────────────────────────────────────
  // Freshness is not enough. This monitor's first version reported everything
  // green while EVERY product had no image and no way to buy — the projection
  // was current, it was just incomplete. A shopper cannot use a price table
  // with no picture and no exit link, so those are health, not cosmetics.
  const card = await one<{ total: number; img: number; exit: number; comparable: number }>(`
    select count(*)::int total,
           count(image_url)::int img,
           count(affiliate_best_url)::int exit,
           count(*) filter (where store_count >= 2)::int comparable
    from tps_product_projection`);
  const imgPct = card.total ? (100 * card.img) / card.total : 0;
  const exitPct = card.total ? (100 * card.exit) / card.total : 0;
  add("customer", "product images", imgPct < 50 ? "FAIL" : imgPct < 90 ? "WARN" : "OK",
    `${card.img} of ${card.total} products have an image (${imgPct.toFixed(1)}%)`,
    "a card with no picture is close to unusable for a shopper");
  add("customer", "measured exit links", exitPct < 50 ? "FAIL" : exitPct < 90 ? "WARN" : "OK",
    `${card.exit} of ${card.total} products have a /go exit (${exitPct.toFixed(1)}%)`,
    "without an exit the customer cannot buy and no commission is attributable");
  const cmpPct = card.total ? (100 * card.comparable) / card.total : 0;
  add("customer", "multi-store comparison", cmpPct < 10 ? "WARN" : "OK",
    `${card.comparable} of ${card.total} products compare across >=2 stores (${cmpPct.toFixed(1)}%)`,
    "the core promise of the platform; grows with merchant and identity coverage");

  // ── 7. PRICE FACTS — the substrate for trust and discount integrity ───────
  const facts = await one<{ n: number; updated: string | null; newest_obs: string | null }>(`
    select (select count(*) from tps_listing_price_facts)::int n,
           (select max(updated_at)::text from tps_listing_price_facts) updated,
           (select max(scraped_at)::text from raw_observations) newest_obs`);
  const factLag = hours(facts.newest_obs ? new Date(facts.newest_obs) : null, facts.updated ? new Date(facts.updated) : null);
  add("price", "listing facts freshness", factLag !== null && factLag > 26 ? "WARN" : "OK",
    factLag === null ? "unknown" : `${Math.max(0, factLag).toFixed(1)}h behind newest observation`,
    `${facts.n} listings`);

  // ── 8. MERCHANT TRUST — derived from listing facts ───────────────────────
  const trust = await one<{ n: number; updated: string | null }>(
    `select count(*)::int n, max(updated_at)::text updated from tps_merchant_trust`);
  const trustLag = hours(facts.updated ? new Date(facts.updated) : null, trust.updated ? new Date(trust.updated) : null);
  add("trust", "merchant trust freshness", trustLag !== null && trustLag > 1 ? "WARN" : "OK",
    trustLag === null ? "unknown" : `${Math.max(0, trustLag).toFixed(1)}h behind listing facts`,
    `${trust.n} store profiles`);

  // ── 9. KNOWLEDGE GRAPH ───────────────────────────────────────────────────
  const edges = await one<{ n: number; corroborated: number }>(`
    select (select count(*) from tps_product_edges)::int n,
           (select count(*) from tps_product_projection where store_count >= 2)::int corroborated`);
  add("graph", "relationship edges", edges.n === 0 ? "WARN" : "OK",
    `${edges.n} edges over ${edges.corroborated} corroborated products`);

  // ── 10. DATA QUALITY — invariants that must never break ──────────────────
  const dup = await one<{ dup_model: number; dup_key: number }>(`
    select (select count(*) from (select lower(brand) b, upper(model_number) m from canonical_products
             where is_active and model_number is not null group by 1,2 having count(*)>1) x)::int dup_model,
           (select count(*) from (select category, tps_identity_key from canonical_products
             where is_active and tps_identity_key is not null group by 1,2 having count(*)>1) y)::int dup_key`);
  add("data quality", "duplicate product cards", dup.dup_model + dup.dup_key > 0 ? "FAIL" : "OK",
    dup.dup_model + dup.dup_key > 0 ? `${dup.dup_model} brand+model, ${dup.dup_key} identity-key duplicates` : "none",
    "a duplicate card is a visible trust failure");

  await pg.end();

  if (process.argv.includes("--json")) { console.log(JSON.stringify(checks, null, 2)); }
  else {
    const icon: Record<Level, string> = { OK: "  ok  ", WARN: " WARN ", FAIL: " FAIL " };
    let lastLayer = "";
    console.log("\n╔══ TAWVEERI PLATFORM HEALTH ═══════════════════════════════════");
    for (const c of checks) {
      if (c.layer !== lastLayer) { console.log(`\n  ${c.layer.toUpperCase()}`); lastLayer = c.layer; }
      console.log(`   [${icon[c.level]}] ${c.check.padEnd(26)} ${c.detail}`);
      if (c.evidence && c.level !== "OK") console.log(`             ↳ ${c.evidence}`);
    }
    const fails = checks.filter((c) => c.level === "FAIL").length;
    const warns = checks.filter((c) => c.level === "WARN").length;
    console.log(`\n  ${fails} FAIL · ${warns} WARN · ${checks.length - fails - warns} OK\n`);
  }
  process.exit(checks.some((c) => c.level === "FAIL") ? 1 : 0);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(2); });
