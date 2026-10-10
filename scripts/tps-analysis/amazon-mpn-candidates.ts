// scripts/tps-analysis/amazon-mpn-candidates.ts — READ-ONLY. Which comparable models does Amazon.sa sell that we do not carry?
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// A comparable MODEL canonical (identity key «<brand>|MODEL:<manufacturer part number>», >= 2 displayable stores) with NO Amazon offer is a comparison Amazon could join.
// For each such model this searches amazon.sa for the exact part number and keeps only tiles whose own title carries that number as a WHOLE token, starts with the same brand and is not an
// accessory/compat/renewed listing — the evidence rule used for same-model companions in search. Output: a table and a JSON file of candidate ASINs for a person to review before they
// go into config/amazon-seed-asins.ts. It writes NOTHING to the database and persists nothing.
//
//   npx tsx scripts/tps-analysis/amazon-mpn-candidates.ts [--limit=25] [--offset=0] [--json=path]
// ─────────────────────────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import * as cheerio from "cheerio";
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { detectBrandFromText, canonicalizeBrand } from "../tps-core/brand-map";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const LIMIT = parseInt(arg("limit", "25"), 10);
const OFFSET = parseInt(arg("offset", "0"), 10);
const JSON_OUT = arg("json", "");
const MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const NOT_MAIN = /\b(compatible|replacement|spare|refill|fits?|accessor(?:y|ies))\b|(?:bag|bags|filter|filters|cover|case|charger|brush|hose|battery|remote)\s+for\b|متوافق|بديل/i;
const OFF_GRADE = /(?<![\p{L}\p{N}])(?:renewed|refurbished|refurb|used|pre-?owned|open[- ]box|b-?grade|مجدد(?:ة)?|مستعمل(?:ة)?)(?![\p{L}\p{N}])/iu;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

(async () => {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("begin read only");
  await pg.query("set local statement_timeout = 90000");
  const models = (await pg.query(`
    with o as (select identity_key, category, store_id, price::numeric price from tps_current_offers
               where status = 'valid' and price > 0 and identity_key like '%|MODEL:%' and store_id not in (23, 24) and payload->>'_superseded_by_identity' is null),
    g as (select identity_key, max(category) category, count(distinct store_id) stores, bool_or(store_id = 2) has_amazon, min(price) pmin, max(price) pmax from o group by 1)
    select identity_key, category, stores::int, pmin::float8 pmin, pmax::float8 pmax from g where stores >= 2 and not has_amazon order by pmax desc offset $1 limit $2`, [OFFSET, LIMIT])).rows;
  const known = new Set<string>((await pg.query("select upper(external_id) a from product_stores where store_id = 2 and external_id is not null")).rows.map((r: { a: string }) => r.a));
  await pg.query("rollback");
  await pg.end();
  console.log(`models without an Amazon offer (>=2 stores): checking ${models.length} (offset ${OFFSET}); known Amazon ASINs in storefront: ${known.size}\n`);

  const out: Array<Record<string, unknown>> = [];
  let withCandidate = 0, alreadyKnown = 0;
  for (const m of models) {
    const [brandKey, code] = [m.identity_key.split("|")[0], m.identity_key.split("|MODEL:")[1]];
    const re = new RegExp(`(?<![A-Z0-9])${escapeRe(code.toUpperCase())}(?![A-Z0-9])`);
    let tiles: Array<{ asin: string; title: string; price: number | null }> = [];
    try {
      const r = await fetch(`https://www.amazon.sa/s?k=${encodeURIComponent(code)}`, { headers: { "User-Agent": MOBILE, "Accept-Language": "en-US,en;q=0.9", Accept: "text/html" }, signal: AbortSignal.timeout(30000) });
      if (r.ok) {
        const $ = cheerio.load(await r.text());
        $("div[data-component-type='s-search-result']").each((_, el) => {
          const asin = $(el).attr("data-asin"); if (!asin) return;
          const title = $(el).find("h2 span, [data-cy='title-recipe'] a span").map((_i, n) => $(n).text().trim()).get().filter((t) => t.length >= 12).sort((a, b) => b.length - a.length)[0] ?? "";
          const p = $(el).find("span.a-price span.a-offscreen").first().text().replace(/[^\d.]/g, "");
          tiles.push({ asin, title, price: p ? Number(p) : null });
        });
      } else console.log(`   ${code}: HTTP ${r.status}`);
    } catch (e) { console.log(`   ${code}: ${(e as Error).message.slice(0, 40)}`); }
    const hits = tiles.filter((t) => re.test(t.title.toUpperCase()) && !NOT_MAIN.test(t.title) && !OFF_GRADE.test(t.title)
      && (canonicalizeBrand(detectBrandFromText(t.title)) === canonicalizeBrand(brandKey) || t.title.toLowerCase().split(/[^\p{L}\p{N}]+/u).slice(0, 3).includes(brandKey.toLowerCase())));
    const fresh = hits.filter((h) => !known.has(h.asin.toUpperCase()));
    alreadyKnown += hits.length - fresh.length;
    if (fresh.length) withCandidate++;
    console.log(`${(fresh.length ? "FOUND " : hits.length ? "known " : "none  ")} ${brandKey}|${code} (${m.category}, ${m.stores} stores ${m.pmin}-${m.pmax} SAR)` + fresh.map((h) => `\n        ${h.asin}  ${h.price ?? "?"} SAR  ${h.title.slice(0, 80)}`).join(""));
    out.push({ identity_key: m.identity_key, category: m.category, stores: m.stores, other_price_min: m.pmin, other_price_max: m.pmax, candidates: fresh, already_in_storefront: hits.length - fresh.length });
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(`\nsummary: ${models.length} models checked · ${withCandidate} with a NEW Amazon candidate · ${alreadyKnown} matching listings already in the storefront`);
  if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify({ at: new Date().toISOString(), checked: models.length, withCandidate, rows: out }, null, 2)); console.log("wrote", JSON_OUT); }
})().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); });
