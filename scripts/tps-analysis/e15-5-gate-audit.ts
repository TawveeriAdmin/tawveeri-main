// scripts/tps-analysis/e15-5-gate-audit.ts
// ─────────────────────────────────────────────────────────────────────────────
// E15.5 FINAL PRODUCTION GATE — reproducible, timestamped production evidence.
//
// Answers Part-1 of the Founder Execution Directive with EXACT numbers, each tied to
// the query that produced it. Read-only against the production database (the sole
// source of truth). Prints a PASS/PARTIAL/FAIL-ready evidence block. Unknown stays
// unknown — a query that cannot run reports "UNKNOWN (reason)", never a guess.
//
// Run:  npm run tps:gate-audit         (or: npx tsx scripts/tps-analysis/e15-5-gate-audit.ts)
// Env:  SUPABASE_DB_URL (routed to the IPv4 pooler); production ref vyceqrzttspyycdpojtn.
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

const PROD_REF = "vyceqrzttspyycdpojtn";

async function main() {
  const rawUrl = process.env.SUPABASE_DB_URL;
  if (!rawUrl) { console.error("FATAL: SUPABASE_DB_URL not set"); process.exit(1); }
  const url = toPoolerDbUrl(rawUrl);
  if (!url.includes(PROD_REF)) { console.error(`FATAL: DB URL is not production (${PROD_REF})`); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const stampRow = await c.query("select now() as ts, current_database() as db");
  const ts = stampRow.rows[0].ts;
  const env = `${PROD_REF} / ${stampRow.rows[0].db}`;

  const q = async (sql: string): Promise<Record<string, unknown>[]> => (await c.query(sql)).rows;
  const one = async (sql: string, field = "n"): Promise<string> => {
    try { const r = await c.query(sql); return String(r.rows[0]?.[field] ?? "0"); }
    catch (e) { return `UNKNOWN (${e instanceof Error ? e.message.slice(0, 40) : e})`; }
  };
  const tryQ = async (sql: string): Promise<Record<string, unknown>[] | null> => {
    try { return (await c.query(sql)).rows; } catch { return null; }
  };

  const line = (s = "") => console.log(s);
  line("╔══════════════════════════════════════════════════════════════════════");
  line("║  TAWVEERI — E15.5 FINAL PRODUCTION GATE — EVIDENCE");
  line(`║  timestamp: ${new Date(ts).toISOString()}   env: ${env}`);
  line(`║  source of truth: production database (read-only)`);
  line("╚══════════════════════════════════════════════════════════════════════");

  // ── 1. Total raw observations ──────────────────────────────────────────────
  line("\n[1] TOTAL RAW OBSERVATIONS");
  line("    query: select count(*) from raw_observations");
  line(`    → ${await one("select count(*) n from raw_observations")}`);

  // ── 2. Total canonical products ────────────────────────────────────────────
  line("\n[2] TOTAL CANONICAL PRODUCTS");
  line("    query: select count(*) from canonical_products");
  line(`    → ${await one("select count(*) n from canonical_products")}`);
  line("    with tps_identity_key (resolved identity):");
  line(`    → ${await one("select count(*) n from canonical_products where tps_identity_key is not null")}`);

  // ── 3. Published / searchable products (projection) ────────────────────────
  line("\n[3] PUBLISHED / SEARCHABLE PRODUCTS  (tps_product_projection)");
  line("    query: select count(*) from tps_product_projection");
  line(`    → ${await one("select count(*) n from tps_product_projection")}`);
  line("    with an image (renderable):");
  line(`    → ${await one("select count(*) n from tps_product_projection where image_url is not null and image_url<>''")}`);
  line("    with a measured exit link (compare_url):");
  line(`    → ${await one("select count(*) n from tps_product_projection where compare_url is not null and compare_url<>''")}`);

  // ── 4. Comparable products (≥2 valid store offers) ─────────────────────────
  line("\n[4] COMPARABLE PRODUCTS  (has_comparison = true, i.e. ≥2 stores)");
  line("    query: select count(*) from tps_product_projection where has_comparison");
  line(`    → ${await one("select count(*) n from tps_product_projection where has_comparison")}`);

  // ── 5. Comparison depth (1 / 2 / 3 / 4+ stores) ────────────────────────────
  line("\n[5] COMPARISON DEPTH (store_count distribution)");
  line("    query: select store_count, count(*) from tps_product_projection group by 1");
  const depth = await tryQ("select coalesce(store_count,0) sc, count(*) n from tps_product_projection group by 1 order by 1");
  if (depth) {
    let d1 = 0, d2 = 0, d3 = 0, d4 = 0;
    for (const r of depth) { const sc = Number(r.sc), n = Number(r.n); if (sc <= 1) d1 += n; else if (sc === 2) d2 += n; else if (sc === 3) d3 += n; else d4 += n; }
    line(`    1 store:  ${d1}`);
    line(`    2 stores: ${d2}`);
    line(`    3 stores: ${d3}`);
    line(`    4+ stores: ${d4}`);
  } else line("    → UNKNOWN");

  // ── 6. Coverage by store / category / brand / price range ──────────────────
  line("\n[6] COVERAGE");
  line("  6a. by STORE (raw_observations, distinct product URLs + comparable-canonical participation)");
  const byStore = await tryQ(`
    select store_id, max(store_name) name, count(*) obs,
           count(distinct payload->>'product_url') distinct_products
    from raw_observations group by store_id order by store_id`);
  if (byStore) byStore.forEach((r) => line(`      store ${r.store_id} ${String(r.name).padEnd(14)} obs=${String(r.obs).padStart(6)} distinct_products=${r.distinct_products}`));
  else line("      → UNKNOWN");

  line("  6b. by CATEGORY (projection: total / comparable)");
  const byCat = await tryQ("select category, count(*) total, count(*) filter(where has_comparison) comparable from tps_product_projection group by category order by total desc");
  if (byCat) byCat.forEach((r) => line(`      ${String(r.category).padEnd(18)} total=${String(r.total).padStart(4)} comparable=${r.comparable}`));
  else line("      → UNKNOWN");

  line("  6c. by BRAND — top 15 (projection: total / comparable)");
  const byBrand = await tryQ("select coalesce(nullif(trim(brand),''),'(none)') brand, count(*) total, count(*) filter(where has_comparison) comparable from tps_product_projection group by 1 order by 2 desc limit 15");
  if (byBrand) byBrand.forEach((r) => line(`      ${String(r.brand).padEnd(18)} total=${String(r.total).padStart(4)} comparable=${r.comparable}`));
  else line("      → UNKNOWN");

  line("  6d. by PRICE RANGE (comparable products, lowest_price SAR)");
  const byPrice = await tryQ(`
    select case when lowest_price<500 then 'a <500' when lowest_price<1500 then 'b 500-1500'
                when lowest_price<3000 then 'c 1500-3000' when lowest_price<6000 then 'd 3000-6000'
                else 'e 6000+' end band, count(*) n
    from tps_product_projection where has_comparison and lowest_price is not null group by 1 order by 1`);
  if (byPrice) byPrice.forEach((r) => line(`      ${String(r.band).padEnd(14)} ${r.n}`));
  else line("      → UNKNOWN");

  // ── 7. Freshness by store & category ───────────────────────────────────────
  line("\n[7] FRESHNESS");
  line("  7a. by STORE (hours since newest observation)");
  const freshStore = await tryQ("select store_id, max(store_name) name, round(extract(epoch from (now()-max(scraped_at)))/3600.0,1) age_h, count(*) filter(where scraped_at>now()-interval '24 hours') last24h from raw_observations group by store_id order by store_id");
  if (freshStore) freshStore.forEach((r) => line(`      store ${r.store_id} ${String(r.name).padEnd(14)} newest=${String(r.age_h).padStart(7)}h  last24h=${r.last24h}`));
  else line("      → UNKNOWN");

  line("  7b. by CATEGORY (hours since newest observed, from projection.last_observed_at)");
  const freshCat = await tryQ("select category, round(extract(epoch from (now()-max(last_observed_at)))/3600.0,1) newest_h, round(extract(epoch from (now()-min(last_observed_at)))/3600.0,1) oldest_h from tps_product_projection where last_observed_at is not null group by category order by newest_h");
  if (freshCat) freshCat.forEach((r) => line(`      ${String(r.category).padEnd(18)} newest=${String(r.newest_h).padStart(7)}h  oldest=${String(r.oldest_h).padStart(7)}h`));
  else line("      → UNKNOWN (last_observed_at may be null)");

  // ── 8. Identity accuracy + unresolved / conflict queues ────────────────────
  line("\n[8] IDENTITY ACCURACY & UNRESOLVED / CONFLICT QUEUES");
  line("  8a. identity_confidence distribution (projection)");
  const idc = await tryQ("select case when identity_confidence>=90 then 'a 90-100' when identity_confidence>=75 then 'b 75-89' when identity_confidence>=50 then 'c 50-74' when identity_confidence is null then 'z null' else 'd <50' end band, count(*) n from tps_product_projection group by 1 order by 1");
  if (idc) idc.forEach((r) => line(`      ${String(r.band).padEnd(10)} ${r.n}`));
  else line("      → UNKNOWN");
  line("  8b. raw_observations processing_status (unresolved backlog)");
  const ps = await tryQ("select coalesce(processing_status,'(null)') status, count(*) n from raw_observations group by 1 order by 2 desc");
  if (ps) ps.forEach((r) => line(`      ${String(r.status).padEnd(14)} ${r.n}`));
  else line("      → UNKNOWN");
  line("  8c. normalized observations without a canonical link (unresolved identities)");
  line(`      → ${await one("select count(*) n from normalized_product_observations where canonical_product_id is null")}`);

  // ── 9. Offer validity (price / availability / url / store / recency) ────────
  line("\n[9] OFFER VALIDITY  (normalized_product_observations = the offers behind /go)");
  const totalOffers = await one("select count(*) n from normalized_product_observations");
  line(`    total offers (normalized observations): ${totalOffers}`);
  line("    offers with a resolvable product URL (payload->>'_url'):");
  line(`    → ${await one("select count(*) n from normalized_product_observations where (normalized_payload->>'_url') is not null and (normalized_payload->>'_url')<>''")}`);
  line("    price_history rows backing offers (price evidence):");
  line(`    → ${await one("select count(*) n from price_history")}`);
  line("    price_history rows observed in the last 24h (fresh price evidence):");
  line(`    → ${await one("select count(*) n from price_history where observed_at > now() - interval '24 hours'")}`);

  // ── 10. Full-chain reachability of comparable products ─────────────────────
  line("\n[10] FULL-CHAIN REACHABILITY  (search → product → comparison → decide → /go)");
  const compTotal = Number(await one("select count(*) n from tps_product_projection where has_comparison"));
  line(`    comparable products: ${compTotal}`);
  line("    …with a compare_url (product/comparison page reachable):");
  line(`    → ${await one("select count(*) n from tps_product_projection where has_comparison and compare_url is not null and compare_url<>''")}`);
  line("    …with an image (renderable on search/cards):");
  line(`    → ${await one("select count(*) n from tps_product_projection where has_comparison and image_url is not null and image_url<>''")}`);
  line("    …with ≥2 offers carrying a /go offer_id (measured exit reachable):");
  const goReach = await one(`
    select count(*) n from (
      select canonical_product_id from normalized_product_observations
      group by canonical_product_id having count(distinct store_id) >= 2
    ) x
    join tps_product_projection p on p.canonical_id = x.canonical_product_id where p.has_comparison`);
  line(`    → ${goReach}`);
  line("    outbound_clicks recorded to date (exit measurement live):");
  line(`    → ${await one("select count(*) n from outbound_clicks")}`);

  // ── Sample comparable products (proof the loop has real content) ───────────
  line("\n[SAMPLE] Top comparable products (real multi-store comparisons — showcase candidates)");
  const sample = await tryQ(`
    select coalesce(display_name_ar, display_name_en) name, category, brand, store_count,
           lowest_price, highest_price, round(price_spread_pct) spread
    from tps_product_projection where has_comparison order by store_count desc, price_spread_pct desc nulls last limit 12`);
  if (sample) sample.forEach((r) => line(`   • [${r.store_count}st] ${String(r.category).padEnd(14)} ${String(r.name).slice(0, 40).padEnd(40)} ${r.lowest_price}-${r.highest_price} SAR (spread ${r.spread ?? "?"}%)`));

  line("\n═══ END E15.5 GATE EVIDENCE ═══");
  line("Reproduce: npm run tps:gate-audit  (read-only; production only)");
  await c.end();
}

main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
