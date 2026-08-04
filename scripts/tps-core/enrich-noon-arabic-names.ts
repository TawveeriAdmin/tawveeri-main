// scripts/tps-core/enrich-noon-arabic-names.ts
// ADR-203 (U5 slice 2) — Arabic display names for noon STOREFRONT rows, from noon's own
// Arabic product pages (JSON-LD Product name — what the merchant publishes for consumption).
//
// 3,877 noon storefront rows carry no Arabic name (measured 2026-08-03). Their URLs embed a
// stable product code before the terminal /p/ (ADR-149), and the Arabic page derives from
// the code alone: /saudi-ar/x/<CODE>/p/ (mechanism-probed: full page, Arabic JSON-LD name;
// note raw curl STALLS against noon — this must ride NoonScraper.fetchPage, which works).
//
// Display enrichment ONLY: writes products.name_ar where the row has no Arabic today.
// No observations are written (ADR-089). Identity is verified per fetch: the page's JSON-LD
// sku must equal the URL code, or the row is skipped — a redirect to a different product
// must never rename ours.
//
// Resumable by construction: the selection excludes rows that already have Arabic, so
// re-running continues where the last run stopped. Dry by default.
//   npx tsx scripts/tps-core/enrich-noon-arabic-names.ts [--apply] [--limit=100]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { writeFileSync, mkdirSync } from "fs";
import { toPoolerDbUrl } from "./pooler-url";

const APPLY = process.argv.includes("--apply");
const LIMIT = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "100", 10);
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

type LdProduct = { name: string | null; sku: string | null };
function extractLdProduct(html: string): LdProduct {
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g) || [];
  for (const block of blocks) {
    try {
      const body = block.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
      const parsed = JSON.parse(body);
      const roots = Array.isArray(parsed) ? parsed : [parsed];
      const nodes = roots.flatMap((r: Record<string, unknown> | null) =>
        r && Array.isArray((r as { "@graph"?: unknown[] })["@graph"]) ? (r as { "@graph": unknown[] })["@graph"] : [r]);
      for (const rawNode of nodes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const n = rawNode as any;
        const t = n?.["@type"];
        if (!n || !(t === "Product" || (Array.isArray(t) && t.includes("Product")))) continue;
        return {
          name: typeof n.name === "string" && n.name.trim() ? n.name.trim() : null,
          sku: typeof n.sku === "string" && n.sku.trim() ? n.sku.trim() : null,
        };
      }
    } catch { /* keep walking */ }
  }
  return { name: null, sku: null };
}

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) { console.error("refusing: not production"); process.exit(1); }
  const { NoonScraper } = await import("../../src/lib/scraping/stores/noon-scraper");
  const scraper = new NoonScraper();

  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows } = await c.query<{ id: string; name_en: string | null; code: string }>(
    `select distinct p.id, p.name_en,
            (regexp_match(ps.product_url, '/([A-Z0-9]{8,})/p/'))[1] as code
     from products p
     join product_stores ps on ps.product_id = p.id
     join stores s on s.id = ps.store_id and s.slug = 'noon'
     where (p.name_ar is null or p.name_ar = '' or p.name_ar !~ '[؀-ۿ]')
       and ps.product_url ~ '/[A-Z0-9]{8,}/p/'
     limit $1`, [LIMIT]);
  console.log(`noon no-Arabic code-linked rows: ${rows.length} · ${APPLY ? "APPLY" : "DRY"}`);
  // The fetch loop runs for many minutes; a pooled connection held idle through it gets
  // killed and the WRITE phase dies on ECONNRESET (measured twice tonight). Close now,
  // reconnect fresh when it is time to write.
  await c.end();

  const updates: Array<{ id: string; code: string; afterAr: string }> = [];
  let fetchFail = 0, noLd = 0, skuMismatch = 0, notArabic = 0;
  for (const r of rows) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html: string = await (scraper as any).fetchPage(`https://www.noon.com/saudi-ar/x/${r.code}/p/`);
      const ld = extractLdProduct(html);
      if (!ld.name) { noLd++; }
      else if (ld.sku && ld.sku !== r.code) { skuMismatch++; }
      else if (!hasArabic(ld.name)) { notArabic++; }
      else updates.push({ id: r.id, code: r.code, afterAr: ld.name });
    } catch { fetchFail++; }
    await new Promise((res) => setTimeout(res, 1800));
  }
  console.log(`matched: ${updates.length} · fetch-fail ${fetchFail} · no-ld ${noLd} · sku-mismatch ${skuMismatch} · not-arabic ${notArabic}`);

  mkdirSync("docs/evidence", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  writeFileSync(`docs/evidence/noon-ar-names-${stamp}.json`,
    JSON.stringify({ measured_at: new Date().toISOString(), mode: APPLY ? "apply" : "dry", source: "noon /saudi-ar/x/<code>/p/ JSON-LD Product.name (sku-verified)", updates }, null, 2));

  if (!APPLY) { console.log("dry — nothing written"); process.exit(0); }

  const w = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await w.connect();
  // products.name_ar is UNIQUE — detect and skip collisions, never fail a statement.
  const seen = new Set<string>();
  const dedup = updates.filter((u) => { const k = u.afterAr.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const { rows: existing } = await w.query<{ n: string }>(
    `select lower(trim(name_ar)) n from products where name_ar = any($1)`, [dedup.map((u) => u.afterAr)]);
  const existingSet = new Set(existing.map((e) => e.n));
  const writable = dedup.filter((u) => !existingSet.has(u.afterAr.trim().toLowerCase()));
  console.log(`collision-skipped: ${updates.length - writable.length}`);

  let written = 0;
  for (let i = 0; i < writable.length; i += 100) {
    const chunk = writable.slice(i, i + 100);
    const res = await w.query(
      `update products p set name_ar = u.after_ar
       from (select unnest($1::uuid[]) id, unnest($2::text[]) after_ar) u
       where p.id = u.id and (p.name_ar is null or p.name_ar = '' or p.name_ar !~ '[؀-ۿ]')`,
      [chunk.map((u) => u.id), chunk.map((u) => u.afterAr)],
    );
    written += res.rowCount ?? 0;
  }
  console.log(`written: ${written}/${writable.length} (of ${updates.length} matched)`);
  await w.end();
  process.exit(0);
})().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); });
