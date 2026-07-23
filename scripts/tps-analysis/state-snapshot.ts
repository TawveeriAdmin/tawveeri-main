// scripts/tps-analysis/state-snapshot.ts
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION TRUTH SNAPSHOT — the single read-only command that reconstructs
// "what is actually true right now" from the production database. Built because
// every fresh context must re-derive current state from evidence, not from docs
// or handoffs (Constitution Art. IX: only verified production value counts).
//
// Strictly READ-ONLY. Prints a structured report: substrate volumes, ingestion
// health & freshness per store, identity/corroboration state, projection health,
// intelligence-layer materialization, and the ER review-queue state.
// Usage: npx tsx scripts/tps-analysis/state-snapshot.ts [--json]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import pg from "pg";
import { resolveListingIdentity, isSaudiMarket } from "../../src/lib/identity/merchant-listing-identity";

const JSON_MODE = process.argv.includes("--json");

/** Slugs for the merchant listing-identity contracts (ADR-059). */
const STORE_SLUG: Record<number, string> = {
  1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 6: "samsung_ksa", 7: "shaker", 8: "swsg",
};

interface Section { title: string; rows: Record<string, unknown>[]; error?: string }

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL missing — cannot verify production truth");
  // Constitutional guard: prove project identity before acting on any verdict.
  const projectRef = /db\.([a-z0-9]+)\.supabase\.co/.exec(url)?.[1] ?? "unknown";
  if (projectRef !== "vyceqrzttspyycdpojtn") {
    throw new Error(`refusing to run: connected project '${projectRef}' is not production (vyceqrzttspyycdpojtn)`);
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("set statement_timeout=0");

  const sections: Section[] = [];
  const q = async (title: string, sql: string, params: unknown[] = []) => {
    try {
      const { rows } = await client.query(sql, params as never[]);
      sections.push({ title, rows });
    } catch (e) {
      sections.push({ title, rows: [], error: e instanceof Error ? e.message : String(e) });
    }
  };

  await q("substrate volumes", `
    select 'raw_observations' as t, count(*)::int as rows from raw_observations
    union all select 'tps_identity_staging', count(*)::int from tps_identity_staging
    union all select 'canonical_products',   count(*)::int from canonical_products
    union all select 'price_history',         count(*)::int from price_history
    union all select 'tps_product_projection',count(*)::int from tps_product_projection
    union all select 'tps_listing_price_facts',count(*)::int from tps_listing_price_facts
    union all select 'tps_product_edges',     count(*)::int from tps_product_edges
    union all select 'tps_model_corroboration',count(*)::int from tps_model_corroboration
    union all select 'tps_merchant_trust',    count(*)::int from tps_merchant_trust
    order by 1`);

  await q("ingestion health by store", `
    select s.id as store_id, s.slug,
           count(o.id)::int as observations,
           max(o.scraped_at)::text as last_scrape,
           (now()::date - max(o.scraped_at)::date)::int as days_stale,
           count(distinct o.scraped_at::date)::int as distinct_days
    from stores s left join raw_observations o on o.store_id = s.id
    group by 1,2 order by 1`);

  await q("identity: canonical by tier", `
    select coalesce(identity_tier,'(null)') as tier, count(*)::int as n,
           count(*) filter (where is_active)::int as active
    from canonical_products group by 1 order by 2 desc`);

  await q("identity: canonical by tps_version", `
    select coalesce(tps_version,'(null)') as version, count(*)::int as n
    from canonical_products group by 1 order by 2 desc`);

  await q("projection: corroboration by category", `
    select category,
           count(*)::int as canonicals,
           count(*) filter (where store_count >= 2)::int as corroborated,
           round(100.0 * count(*) filter (where store_count >= 2) / nullif(count(*),0), 1) as pct_corroborated
    from tps_product_projection group by 1 order by 2 desc`);

  await q("staging: resolution state", `
    select status, count(*)::int as n from tps_identity_staging group by 1 order by 2 desc`);

  await q("unresolved long tail", `
    select (select count(*) from raw_observations)::int as total_obs,
           (select count(distinct raw_obs_id) from tps_identity_staging where status <> 'invalid')::int as staged_obs`);

  await q("price history depth", `
    select count(distinct canonical_id)::int as canonicals_with_history,
           count(*)::int as rows,
           max(observed_at)::text as newest,
           min(observed_at)::text as oldest`);

  await q("ER candidate tables present", `
    select table_name from information_schema.tables
    where table_schema='public' and table_name like 'tps_er%' order by 1`);

  // ── CATALOG TRUTH (ADR-059) ────────────────────────────────────────────────
  // Raw observation counts are NOT catalog size: daily re-scrapes inflate them
  // 8–23x, merchants publish one product under several URLs, and some listings
  // are foreign-market. Catalog size is measured ONLY as distinct Saudi listings
  // under each merchant's identity contract. Re-scrapes stay valuable as price
  // and availability evidence — they just never count as catalog.
  {
    const catalog = new Map<number, { obs: number; urls: Set<string>; saudi: Set<string>; foreign: number; noUrl: number }>();
    let cursor = 0;
    for (;;) {
      const { rows } = await client.query(
        `select id, store_id,
                coalesce(payload->>'productUrl', payload->>'url', payload->>'product_url', raw_url) u
         from raw_observations where id > $1 order by id asc limit 20000`,
        [cursor]
      );
      if (!rows.length) break;
      for (const r of rows) {
        cursor = Number(r.id);
        const s = Number(r.store_id);
        let e = catalog.get(s);
        if (!e) { e = { obs: 0, urls: new Set(), saudi: new Set(), foreign: 0, noUrl: 0 }; catalog.set(s, e); }
        e.obs++;
        if (!r.u) { e.noUrl++; continue; }
        e.urls.add(String(r.u));
        const ident = resolveListingIdentity(s, r.u as string, STORE_SLUG[s]);
        if (!ident.key) { e.noUrl++; continue; }
        if (!isSaudiMarket(ident.market)) { e.foreign++; continue; }
        e.saudi.add(ident.key);
      }
    }
    const rows = [...catalog.entries()].sort((a, b) => a[0] - b[0]).map(([store, e]) => ({
      store_id: store,
      slug: STORE_SLUG[store] ?? "?",
      observations: e.obs,
      raw_distinct_urls: e.urls.size,
      SAUDI_CATALOG: e.saudi.size,
      foreign_obs_excluded: e.foreign,
      url_inflation: e.saudi.size ? `${(e.urls.size / e.saudi.size).toFixed(2)}x` : "-",
      obs_per_listing: e.saudi.size ? (e.obs / e.saudi.size).toFixed(1) : "-",
    }));
    const total = rows.reduce((a, r) => a + r.SAUDI_CATALOG, 0);
    rows.push({ store_id: 0, slug: "TOTAL", observations: rows.reduce((a, r) => a + r.observations, 0), raw_distinct_urls: rows.reduce((a, r) => a + r.raw_distinct_urls, 0), SAUDI_CATALOG: total, foreign_obs_excluded: rows.reduce((a, r) => a + r.foreign_obs_excluded, 0), url_inflation: "-", obs_per_listing: "-" });
    sections.push({ title: "CATALOG TRUTH — distinct Saudi listings under merchant identity contracts", rows });
  }

  await client.end();

  if (JSON_MODE) { console.log(JSON.stringify(sections, null, 2)); return; }
  for (const s of sections) {
    console.log(`\n=== ${s.title} ===`);
    if (s.error) { console.log(`  ERROR: ${s.error}`); continue; }
    if (!s.rows.length) { console.log("  (no rows)"); continue; }
    for (const r of s.rows) console.log("  " + Object.entries(r).map(([k, v]) => `${k}=${v}`).join("  "));
  }
}

main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
