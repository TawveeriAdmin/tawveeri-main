// scripts/tps-core/backfill-images.ts
// ─────────────────────────────────────────────────────────────────────────────
// One-time canonical IMAGE backfill (ADR-101). The progressive engine historically wrote
// canonical_products.image_url = null, so every comparison card rendered imageless — even
// though 59% of raw_observations carry a real product image. This fills the gap from data
// we ALREADY hold: for each imageless canonical, take the most-recent linked observation's
// first image (evidence-cited, never fabricated). FILL-ONLY (never overwrites an existing
// image), set-based, idempotent. Going forward the engine sets images at corroboration time,
// so this is a backlog repair, not a recurring job.
//
// SAFE by construction (ADR-099): a single bounded UPDATE — NOT a normalize/projection
// rebuild. Still: dry-first, and do not run it alongside a heavy scheduler job.
// Usage:  npx tsx scripts/tps-core/backfill-images.ts [--apply]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "./pooler-url";
import { assertFingerprint } from "./tps-batch";

// Most-recent observed image per canonical, linked via normalized_payload._raw_id → raw_observations.
const IMG_CTE = `
  with img as (
    select distinct on (n.canonical_product_id)
           n.canonical_product_id cid,
           (r.payload->'image_urls'->>0) img
      from normalized_product_observations n
      join raw_observations r on r.id = (n.normalized_payload->>'_raw_id')::bigint
     where n.canonical_product_id is not null
       and jsonb_typeof(r.payload->'image_urls') = 'array'
       and jsonb_array_length(r.payload->'image_urls') > 0
       and (r.payload->'image_urls'->>0) ~ '^https?://'
       and (r.payload->'image_urls'->>0) !~ 'data:image|;base64,'  -- reject lazy-load placeholders
     order by n.canonical_product_id, n.observed_at desc nulls last
  )`;

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const apply = process.argv.includes("--apply");
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query("set statement_timeout = '120s'");

    const before = (await c.query(
      `select count(*) total, count(image_url) with_image,
              count(*) filter (where coalesce((attributes->>'comparison_eligible')::boolean,false)) cmp_total,
              count(image_url) filter (where coalesce((attributes->>'comparison_eligible')::boolean,false)) cmp_with_image
         from canonical_products where is_active`
    )).rows[0];
    console.log(`\n◆ canonical images BEFORE: ${before.with_image}/${before.total} active have an image; comparable: ${before.cmp_with_image}/${before.cmp_total}`);

    // How many imageless canonicals CAN be filled from observed data, + a few samples.
    const fillable = (await c.query(
      `${IMG_CTE}
       select count(*) n from img join canonical_products c on c.id = img.cid
        where c.is_active and c.image_url is null`
    )).rows[0].n;
    const samples = (await c.query(
      `${IMG_CTE}
       select c.name_ar, img.img from img join canonical_products c on c.id = img.cid
        where c.is_active and c.image_url is null
          and coalesce((c.attributes->>'comparison_eligible')::boolean,false) limit 5`
    )).rows as { name_ar: string; img: string }[];
    console.log(`  fillable imageless canonicals: ${fillable}`);
    for (const s of samples) console.log(`    • ${s.name_ar.slice(0, 40)} → ${s.img.slice(0, 60)}`);

    if (!apply) { console.log(`\n[dry] no writes. Re-run with --apply to fill.\n`); return; }

    const t0 = Date.now();
    const res = await c.query(
      `${IMG_CTE}
       update canonical_products c
          set image_url = img.img, data_updated_at = now()
         from img
        where c.id = img.cid and c.is_active and c.image_url is null`
    );
    const after = (await c.query(
      `select count(image_url) with_image,
              count(image_url) filter (where coalesce((attributes->>'comparison_eligible')::boolean,false)) cmp_with_image
         from canonical_products where is_active`
    )).rows[0];
    console.log(`\n✓ filled ${res.rowCount} canonicals in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`◆ canonical images AFTER: ${after.with_image}/${before.total} active; comparable: ${after.cmp_with_image}/${before.cmp_total}\n`);
  } finally {
    await c.end();
  }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
