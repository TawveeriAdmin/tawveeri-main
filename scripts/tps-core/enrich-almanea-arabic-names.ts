// scripts/tps-core/enrich-almanea-arabic-names.ts
// ADR-202 (U5 slice 1) — Arabic display names for almanea STOREFRONT rows, taken from the
// merchant's OWN public Arabic Algolia index (the same sanctioned public source ADR-094's
// feed adapter reads; search-only keys shipped in the browser bundle).
//
// 1,298 almanea storefront products carry no Arabic name (measured 2026-08-03). Their
// URLs embed the merchant SKU (`…/p-{sku}`), and the AR index keys the same SKU with the
// merchant's own Arabic title — the most honest Arabic name available (ADR-185's
// OBSERVED principle: never compose over what the merchant printed).
//
// Display enrichment ONLY: writes products.name_ar where the row has no Arabic today.
// No observations are written (ADR-089's URL-keyed double-count hazard is exactly why —
// an /ar page fetch would look like a second listing to the normalizer).
//
// Dry by default. Evidence snapshot to docs/evidence/ for rollback.
//   npx tsx scripts/tps-core/enrich-almanea-arabic-names.ts [--apply] [--limit=N]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { writeFileSync, mkdirSync } from "fs";
import { toPoolerDbUrl } from "./pooler-url";

const APPLY = process.argv.includes("--apply");
const LIMIT = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "2000", 10);
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) { console.error("refusing: not production"); process.exit(1); }
  const { getProvider } = await import("../../src/lib/providers/registry");
  const provider = getProvider("almanea");
  const algolia = provider?.algolia;
  if (!algolia) { console.error("no almanea algolia config"); process.exit(1); }

  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Storefront rows with no Arabic name, linked to almanea offers whose URL embeds the SKU.
  const { rows } = await c.query<{ id: string; name_ar: string | null; name_en: string | null; sku: string }>(
    `select distinct p.id, p.name_ar, p.name_en,
            (regexp_match(ps.product_url, '/p-([A-Za-z0-9]+)'))[1] as sku
     from products p
     join product_stores ps on ps.product_id = p.id
     join stores s on s.id = ps.store_id and s.slug = 'almanea'
     where (p.name_ar is null or p.name_ar = '' or p.name_ar = p.name_en or p.name_ar !~ '[؀-ۿ]')
       and ps.product_url ~ '/p-[A-Za-z0-9]+'
     limit $1`, [LIMIT]);
  console.log(`almanea storefront rows without Arabic (sku-linked): ${rows.length} · ${APPLY ? "APPLY" : "DRY"}`);

  const endpoint = `https://${algolia.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(algolia.index)}/query`;
  const lookupAr = async (sku: string): Promise<string | null> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "X-Algolia-Application-Id": algolia.appId, "X-Algolia-API-Key": algolia.apiKey, "content-type": "application/json" },
      // `sku` is not a faceted attribute on this index (filters return 0) but it IS
      // searchable — restrict the search to it and verify the exact match below.
      body: JSON.stringify({ params: `query=${encodeURIComponent(sku)}&hitsPerPage=1&restrictSearchableAttributes=sku` }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { hits?: Array<{ name?: string; sku?: string }> };
    const hit = j.hits?.[0];
    // Exact SKU match only — a fuzzy hit could name a DIFFERENT product, worse than none.
    if (!hit?.name || String(hit.sku) !== sku) return null;
    return hasArabic(hit.name) ? hit.name.trim() : null;
  };

  const updates: Array<{ id: string; sku: string; beforeAr: string | null; afterAr: string }> = [];
  let misses = 0;
  for (const r of rows) {
    const nameAr = await lookupAr(r.sku).catch(() => null);
    if (nameAr) updates.push({ id: r.id, sku: r.sku, beforeAr: r.name_ar, afterAr: nameAr });
    else misses++;
    await new Promise((res) => setTimeout(res, 60));
  }
  console.log(`AR-index matches: ${updates.length} · misses: ${misses}`);

  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(`docs/evidence/almanea-arabic-names-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify({ measured_at: new Date().toISOString(), mode: APPLY ? "apply" : "dry", source: `algolia ${algolia.index} (merchant's own AR index, exact-sku)`, updates }, null, 2));

  if (!APPLY) { console.log("dry — nothing written; evidence file holds the plan"); await c.end(); process.exit(0); }

  // products.name_ar is UNIQUE — collisions are DETECTED and SKIPPED before any write,
  // never discovered by a failing statement (remediate-locale-names.ts convention).
  const seen = new Set<string>();
  const withinDupes = updates.filter((u) => { const k = u.afterAr.trim().toLowerCase(); if (seen.has(k)) return true; seen.add(k); return false; });
  const withinDupeSet = new Set(withinDupes.map((u) => u.id));
  const { rows: existing } = await c.query<{ n: string }>(
    `select lower(trim(name_ar)) n from products where name_ar = any($1)`,
    [updates.map((u) => u.afterAr)],
  );
  const existingSet = new Set(existing.map((e) => e.n));
  const writable = updates.filter((u) => !withinDupeSet.has(u.id) && !existingSet.has(u.afterAr.trim().toLowerCase()));
  console.log(`collision-skipped: ${updates.length - writable.length} (within-batch ${withinDupes.length}, existing ${updates.length - writable.length - withinDupes.length})`);

  let written = 0;
  for (let i = 0; i < writable.length; i += 100) {
    const chunk = writable.slice(i, i + 100);
    const res = await c.query(
      `update products p set name_ar = u.after_ar
       from (select unnest($1::uuid[]) id, unnest($2::text[]) after_ar) u
       where p.id = u.id and (p.name_ar is null or p.name_ar = '' or p.name_ar = p.name_en or p.name_ar !~ '[؀-ۿ]')`,
      [chunk.map((u) => u.id), chunk.map((u) => u.afterAr)],
    );
    written += res.rowCount ?? 0;
  }
  console.log(`written: ${written}/${writable.length} (of ${updates.length} matched)`);
  await c.end();
})().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); });
