// scripts/tps-core/build-listing-facts.ts
// Materialize per-LISTING price facts (store + product URL) from raw_observations
// → tps_listing_price_facts, with a deterministic Discount-Integrity verdict per
// listing. Listing keys are stable across canonical rebuilds, so this preserves the
// full observed history (unlike canonical-keyed price intelligence, which resets on
// identity migration). Idempotent (upsert), bounded, per-store. Read-only on
// raw_observations; append/upsert only to the facts table.
//
// ADR-058 — listings are now grouped by `stableListingKey` rather than the raw
// URL. Amazon embeds per-request session tracking in the URL (`/ref=sr_1_1?dib=
// …&qid=…`), so raw-URL grouping minted a NEW listing on every scrape: measured
// 2,422 Amazon listings all stuck at distinct_days = 1, hence zero price
// intelligence, zero discount integrity and zero verified drops, permanently.
// Aggregation moved from SQL into TypeScript so the key rule has exactly one
// implementation (src/lib/identity/listing-key.ts) instead of a SQL copy.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { readFileSync } from "fs";
import { Client } from "pg";
import { assertFingerprint } from "./tps-batch";
import { discountVerdictFromFacts } from "../../src/lib/intelligence/price-intelligence";
import { stableListingKey } from "../../src/lib/identity/listing-key";

const STORES = [1, 2, 3, 4, 5];
/** `--dry` previews the rebuild (aggregation + stale-key count) without writing. */
const DRY = process.argv.includes("--dry");
/** Slugs drive the per-store durable-id extractors in `stableListingKey`. */
const STORE_SLUG: Record<number, string> = {
  1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 8: "swsg",
};

interface ListingAgg {
  storeId: number; url: string; name: string | null; brand: string | null; category: string | null;
  days: Set<string>; obsMin: number; obsMax: number; claimedWas: number | null;
  firstSeen: Date; lastSeen: Date; currentPrice: number;
}

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  // Ensure the table exists.
  await pg.query(readFileSync(resolve(process.cwd(), "scripts/database/knowledge-db/021_listing_price_facts.sql"), "utf8"));

  const tally: Record<string, number> = {};
  let total = 0;
  for (const store of STORES) {
    // Stream observations and aggregate by STABLE listing key in TypeScript, so
    // src/lib/identity/listing-key.ts stays the single authority for the rule.
    const agg = new Map<string, ListingAgg>();
    let cursor = 0;
    for (;;) {
      const page = await pg.query(
        `select id, store_id, raw_name name, scraped_at,
                coalesce(payload->>'productUrl', payload->>'url', payload->>'product_url', raw_url) listing,
                nullif(regexp_replace(coalesce(payload->>'sellingPrice', payload->>'price', payload->>'current_price'),'[^0-9.]','','g'),'')::numeric price,
                nullif(regexp_replace(coalesce(payload->>'wasPrice', payload->>'original_price'),'[^0-9.]','','g'),'')::numeric was,
                coalesce(payload->>'brandEn', payload->>'brand') brand,
                coalesce(payload->>'category', payload->>'categoryEn') category
         from raw_observations
         where store_id = $1 and id > $2
         order by id asc limit 10000`,
        [store, cursor]
      );
      if (!page.rows.length) break;
      for (const r of page.rows) {
        cursor = Number(r.id);
        const key = stableListingKey(store, r.listing as string | null, STORE_SLUG[store]);
        if (!key) continue;
        const price = r.price != null ? Number(r.price) : null;
        const was = r.was != null ? Number(r.was) : null;
        const at = new Date(r.scraped_at);
        const day = at.toISOString().slice(0, 10);
        let a = agg.get(key);
        if (!a) {
          a = {
            storeId: store, url: String(r.listing), name: r.name ?? null, brand: r.brand ?? null,
            category: r.category ?? null, days: new Set<string>(), obsMin: Infinity, obsMax: -Infinity,
            claimedWas: null, firstSeen: at, lastSeen: at, currentPrice: NaN,
          };
          agg.set(key, a);
        }
        a.days.add(day);
        if (at < a.firstSeen) a.firstSeen = at;
        if (price != null) {
          if (price < a.obsMin) a.obsMin = price;
          if (price > a.obsMax) a.obsMax = price;
          // latest observation with a price wins for the displayed current price
          if (at >= a.lastSeen || Number.isNaN(a.currentPrice)) {
            a.currentPrice = price;
            a.name = r.name ?? a.name; a.brand = r.brand ?? a.brand; a.category = r.category ?? a.category;
            a.url = String(r.listing);
          }
        }
        if (at > a.lastSeen) a.lastSeen = at;
        if (was != null && (a.claimedWas == null || was > a.claimedWas)) a.claimedWas = was;
      }
    }

    // Only listings with an observed price can carry a price verdict.
    const rows = [...agg.entries()]
      .filter(([, a]) => Number.isFinite(a.currentPrice) && Number.isFinite(a.obsMax))
      .map(([listing_key, a]) => ({
        listing_key, listing: a.url, store_id: a.storeId, days: a.days.size,
        obs_min: a.obsMin, obs_max: a.obsMax, claimed_was: a.claimedWas,
        first_seen: a.firstSeen, last_seen: a.lastSeen,
        current_price: a.currentPrice, name: a.name, brand: a.brand, category: a.category,
      }));

    // Compute verdicts + batch upsert
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const vals: string[] = []; const params: unknown[] = [];
      chunk.forEach((r, j) => {
        const v = discountVerdictFromFacts({
          distinctDays: Number(r.days), current: Number(r.current_price),
          observedMin: Number(r.obs_min), observedMax: Number(r.obs_max),
          claimedWas: r.claimed_was != null ? Number(r.claimed_was) : null,
        });
        tally[v.verdict] = (tally[v.verdict] ?? 0) + 1;
        const b = j * 19;
        vals.push(`(${Array.from({ length: 19 }, (_, k) => `$${b + k + 1}`).join(",")}, now())`);
        params.push(
          r.listing_key, r.store_id, String(r.store_id), r.listing, (r.name ?? "").slice(0, 400),
          r.brand ?? null, r.category ?? null, Number(r.current_price), Number(r.obs_min), Number(r.obs_max),
          r.claimed_was != null ? Number(r.claimed_was) : null, Number(r.days), r.first_seen, r.last_seen,
          v.verdict, v.advertisedSavingPct, v.realSavingPct, v.text.ar, v.text.en
        );
      });
      if (DRY) { total += chunk.length; continue; }
      await pg.query(
        `insert into tps_listing_price_facts
           (listing_key, store_id, store_name, url, name, brand, category, current_price, observed_min, observed_max,
            claimed_was, distinct_days, first_seen, last_seen, verdict, advertised_saving_pct, real_saving_pct, text_ar, text_en, updated_at)
         values ${vals.join(",")}
         on conflict (listing_key) do update set
           current_price=excluded.current_price, observed_min=excluded.observed_min, observed_max=excluded.observed_max,
           claimed_was=excluded.claimed_was, distinct_days=excluded.distinct_days, last_seen=excluded.last_seen,
           verdict=excluded.verdict, advertised_saving_pct=excluded.advertised_saving_pct, real_saving_pct=excluded.real_saving_pct,
           text_ar=excluded.text_ar, text_en=excluded.text_en, name=excluded.name, brand=excluded.brand, category=excluded.category, updated_at=now()`,
        params
      );
      total += chunk.length;
    }

    // Reconcile stale keys. The ADR-058 key format differs from the previous
    // raw-URL format, so without this the table would hold BOTH — double-counting
    // every Amazon listing in Merchant Trust and Discount Integrity. Safe: this
    // table is a pure materialization of immutable `raw_observations` and is
    // fully regenerated by this builder, so the delete is reversible by re-running.
    const keys = rows.map((r) => r.listing_key);
    const staleQ = `select count(*)::int n from tps_listing_price_facts where store_id = $1 and not (listing_key = any($2))`;
    const { rows: st } = await pg.query(staleQ, [store, keys]);
    const stale = st[0]?.n ?? 0;
    if (stale > 0 && !DRY) {
      await pg.query(`delete from tps_listing_price_facts where store_id = $1 and not (listing_key = any($2))`, [store, keys]);
    }
    console.log(`  store ${store}: ${rows.length} listings materialized, ${stale} stale keys ${DRY ? "(dry — kept)" : "removed"}`);
  }
  console.log(`\nTOTAL listings: ${total}`);
  console.table(tally);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
