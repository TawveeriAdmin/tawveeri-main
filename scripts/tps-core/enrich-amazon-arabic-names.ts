// scripts/tps-core/enrich-amazon-arabic-names.ts
// ADR-203 (U5 slice 3) — Arabic display names for amazon STOREFRONT rows from amazon.sa's
// own Arabic product pages. The ASIN derives the page deterministically (/-/ar/dp/<ASIN>),
// and mechanism-probing showed the Arabic #productTitle is served to a PLAIN fetch (1.3MB,
// no Puppeteer). Same contract as the noon slice: display-only writes (never observations —
// ADR-089), identity verified per fetch (the ASIN must appear on the fetched page), UNIQUE
// collisions skipped, resumable by construction, evidence JSON per run.
//   npx tsx scripts/tps-core/enrich-amazon-arabic-names.ts [--apply] [--limit=150]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { writeFileSync, mkdirSync } from "fs";
import { toPoolerDbUrl } from "./pooler-url";

const APPLY = process.argv.includes("--apply");
const LIMIT = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "150", 10);
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) { console.error("refusing: not production"); process.exit(1); }
  const { AmazonScraper } = await import("../../src/lib/scraping/stores/amazon-scraper");
  const scraper = new AmazonScraper();

  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows } = await c.query<{ id: string; asin: string }>(
    `select distinct p.id, (regexp_match(ps.product_url, '/dp/([A-Z0-9]{10})'))[1] as asin
     from products p
     join product_stores ps on ps.product_id = p.id
     join stores s on s.id = ps.store_id and s.slug = 'amazon'
     where (p.name_ar is null or p.name_ar = '' or p.name_ar !~ '[؀-ۿ]')
       and ps.product_url ~ '/dp/[A-Z0-9]{10}'
     limit $1`, [LIMIT]);
  console.log(`amazon no-Arabic asin-linked rows: ${rows.length} · ${APPLY ? "APPLY" : "DRY"}`);

  const updates: Array<{ id: string; asin: string; afterAr: string }> = [];
  let fetchFail = 0, noTitle = 0, asinMissing = 0, notArabic = 0;
  for (const r of rows) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html: string = await (scraper as any).fetchPage(`https://www.amazon.sa/-/ar/dp/${r.asin}`);
      const title = (html.match(/id="productTitle"[^>]*>\s*([^<]+)/) || [])[1]?.trim() ?? null;
      if (!title) { noTitle++; }
      else if (!html.includes(r.asin)) { asinMissing++; } // redirected off the product — never rename ours
      else if (!hasArabic(title)) { notArabic++; }
      else updates.push({ id: r.id, asin: r.asin, afterAr: title });
    } catch { fetchFail++; }
    await new Promise((res) => setTimeout(res, 2500));
  }
  console.log(`matched: ${updates.length} · fetch-fail ${fetchFail} · no-title ${noTitle} · asin-missing ${asinMissing} · not-arabic ${notArabic}`);

  mkdirSync("docs/evidence", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  writeFileSync(`docs/evidence/amazon-ar-names-${stamp}.json`,
    JSON.stringify({ measured_at: new Date().toISOString(), mode: APPLY ? "apply" : "dry", source: "amazon.sa /-/ar/dp/<ASIN> #productTitle (asin-verified)", updates }, null, 2));

  if (!APPLY) { console.log("dry — nothing written"); await c.end(); process.exit(0); }

  const seen = new Set<string>();
  const dedup = updates.filter((u) => { const k = u.afterAr.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const { rows: existing } = await c.query<{ n: string }>(
    `select lower(trim(name_ar)) n from products where name_ar = any($1)`, [dedup.map((u) => u.afterAr)]);
  const existingSet = new Set(existing.map((e) => e.n));
  const writable = dedup.filter((u) => !existingSet.has(u.afterAr.trim().toLowerCase()));
  console.log(`collision-skipped: ${updates.length - writable.length}`);

  let written = 0;
  for (let i = 0; i < writable.length; i += 100) {
    const chunk = writable.slice(i, i + 100);
    const res = await c.query(
      `update products p set name_ar = u.after_ar
       from (select unnest($1::uuid[]) id, unnest($2::text[]) after_ar) u
       where p.id = u.id and (p.name_ar is null or p.name_ar = '' or p.name_ar !~ '[؀-ۿ]')`,
      [chunk.map((u) => u.id), chunk.map((u) => u.afterAr)],
    );
    written += res.rowCount ?? 0;
  }
  console.log(`written: ${written}/${writable.length} (of ${updates.length} matched)`);
  await c.end();
  process.exit(0);
})().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); });
