// scripts/tps-core/build-listing-facts.ts
// Materialize per-LISTING price facts (store + product URL) from raw_observations
// → tps_listing_price_facts, with a deterministic Discount-Integrity verdict per
// listing. Listing keys are stable across canonical rebuilds, so this preserves the
// full observed history (unlike canonical-keyed price intelligence, which resets on
// identity migration). Idempotent (upsert), bounded, per-store. Read-only on
// raw_observations; append/upsert only to the facts table.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { readFileSync } from "fs";
import { Client } from "pg";
import { assertFingerprint } from "./tps-batch";
import { discountVerdictFromFacts } from "../../src/lib/intelligence/price-intelligence";

const STORES = [1, 2, 3, 4, 5];

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
    const { rows } = await pg.query(
      `with obs as (
         select coalesce(payload->>'productUrl', payload->>'url', payload->>'product_url') listing, store_id, raw_name name,
                nullif(regexp_replace(coalesce(payload->>'sellingPrice', payload->>'price', payload->>'current_price'),'[^0-9.]','','g'),'')::numeric price,
                nullif(regexp_replace(coalesce(payload->>'wasPrice', payload->>'original_price'),'[^0-9.]','','g'),'')::numeric was,
                coalesce(payload->>'brandEn', payload->>'brand') brand, coalesce(payload->>'category', payload->>'categoryEn') category,
                scraped_at
         from raw_observations
         where store_id = $1 and coalesce(payload->>'productUrl', payload->>'url', payload->>'product_url') is not null),
       agg as (
         select listing, store_id, count(distinct date_trunc('day', scraped_at)) days,
                min(price) obs_min, max(price) obs_max, max(was) claimed_was,
                min(scraped_at) first_seen, max(scraped_at) last_seen
         from obs group by listing, store_id),
       latest as (
         select distinct on (listing) listing, price current_price, name, brand, category
         from obs where price is not null order by listing, scraped_at desc)
       select a.listing, a.store_id, a.days, a.obs_min, a.obs_max, a.claimed_was, a.first_seen, a.last_seen,
              l.current_price, l.name, l.brand, l.category
       from agg a join latest l using (listing)
       where l.current_price is not null and a.obs_max is not null`,
      [store]
    );

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
          `${r.store_id}::${r.listing}`, r.store_id, String(r.store_id), r.listing, (r.name ?? "").slice(0, 400),
          r.brand ?? null, r.category ?? null, Number(r.current_price), Number(r.obs_min), Number(r.obs_max),
          r.claimed_was != null ? Number(r.claimed_was) : null, Number(r.days), r.first_seen, r.last_seen,
          v.verdict, v.advertisedSavingPct, v.realSavingPct, v.text.ar, v.text.en
        );
      });
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
    console.log(`  store ${store}: ${rows.length} listings materialized`);
  }
  console.log(`\nTOTAL listings: ${total}`);
  console.table(tally);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
