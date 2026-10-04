// scripts/tps-analysis/merchant-data-quality.ts — INTERNAL sourcing-quality metric (founder §21, 2026-10-04). READ-ONLY.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// For each merchant × category: how much of the evidence that identity needs does the merchant actually supply?
//   brand_explicit   payload.brand present (not "unknown")
//   model_declared   a manufacturer model in a structured field (mpn / modelNumber / model_number / model) that passes the key-integrity
//                    authority (`extractManufacturerModel`: shape, not a retailer id, not a spec)
//   model_in_title   a model recoverable from the title (ADR-175 name-derived lane)
//   gtin             payload gtin / ean / upc / barcode with a valid length (8, 12, 13, 14 digits)
//   specs_rich       `specifications` carries ≥ 3 attributes (variant attributes available to the verifier)
//   availability     availability stated
//   price_fresh      observed within 168 h (PICK_FRESHNESS_MAX_HOURS)
// Used to guide merchant integrations, feed requirements and engineering priority (SOURCE_IDENTITY_GAP vs engineer-fixable).
// It is NEVER a shopper-facing ranking input and never reorders merchants (Constitution: commercial/ranking neutrality).
//
//   npx tsx scripts/tps-analysis/merchant-data-quality.ts [--out=docs/evidence/.../merchant-data-quality-2026-10-04.json] [--min=20]
import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { extractManufacturerModel, extractManufacturerModelFromName } from "../../src/lib/identity/store-identifiers";

const argv = process.argv.slice(2);
const arg = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? null;
const OUT = arg("out") ?? "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/merchant-data-quality-2026-10-04.json";
const MIN = Number(arg("min") ?? 20);
const FRESH_H = 168;
const STORE: Record<number, string> = { 1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 6: "samsung_ksa", 7: "shaker", 8: "swsg", 9: "najm", 10: "lulu", 16: "sony_world", 18: "blackbox", 21: "sharafdg", 23: "alnakheelk" };

type Row = { identity_key: string | null; store_id: number; category: string; name: string | null; observed_at: string | null; brand: string | null; mpn: string | null; modelNumber: string | null; model_number: string | null; model: string | null; gtin: string | null; ean: string | null; upc: string | null; barcode: string | null; availability: string | null; spec_n: number | null };

(async () => {
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing");
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only");
  const rows = (await pg.query(
    `select co.identity_key, co.store_id, co.category, co.name, co.observed_at, r.payload->>'brand' as brand, r.payload->>'mpn' as mpn, r.payload->>'modelNumber' as "modelNumber",
            r.payload->>'model_number' as model_number, r.payload->>'model' as model, r.payload->>'gtin' as gtin, r.payload->>'ean' as ean, r.payload->>'upc' as upc,
            r.payload->>'barcode' as barcode, coalesce(r.payload->>'availability', co.payload->>'_availability') as availability,
            case when jsonb_typeof(r.payload->'specifications') = 'object' then (select count(*) from jsonb_object_keys(r.payload->'specifications'))::int else 0 end as spec_n
       from tps_current_offers co left join raw_observations r on r.id = co.raw_obs_id
      where co.status = 'valid' and co.category is not null`)).rows as Row[];
  await pg.query("rollback"); await pg.end();

  const validGtin = (v: string | null) => !!v && /^\d{8}$|^\d{12,14}$/.test(v.replace(/\D/g, "")) && v.replace(/\D/g, "").length === v.trim().length;
  type Acc = { listings: number; brand: number; model_declared: number; model_in_title: number; gtin: number; specs_rich: number; availability: number; price_fresh: number };
  const acc = new Map<string, Acc>();
  // group-level view: a comparison needs the model on EVERY side, so coverage per listing is not the right denominator
  const groups = new Map<string, { category: string; list: { store: number; hasModel: boolean }[] }>();
  for (const r of rows) {
    const k = `${STORE[r.store_id] ?? r.store_id}|${r.category}`;
    const hasModel = !!extractManufacturerModel({ mpn: r.mpn, modelNumber: r.modelNumber, model_number: r.model_number, model: r.model }) || !!(r.name && extractManufacturerModelFromName(r.name));
    if (r.identity_key) { const g = groups.get(r.identity_key) ?? { category: r.category, list: [] }; g.list.push({ store: r.store_id, hasModel }); groups.set(r.identity_key, g); }
    const a = acc.get(k) ?? { listings: 0, brand: 0, model_declared: 0, model_in_title: 0, gtin: 0, specs_rich: 0, availability: 0, price_fresh: 0 };
    a.listings++;
    if (r.brand && !/^(unknown|other|generic|n\/a|-)$/i.test(r.brand.trim())) a.brand++;
    if (extractManufacturerModel({ mpn: r.mpn, modelNumber: r.modelNumber, model_number: r.model_number, model: r.model })) a.model_declared++;
    if (r.name && extractManufacturerModelFromName(r.name)) a.model_in_title++;
    if ([r.gtin, r.ean, r.upc, r.barcode].some(validGtin)) a.gtin++;
    if ((r.spec_n ?? 0) >= 3) a.specs_rich++;
    if (r.availability) a.availability++;
    if (r.observed_at && (Date.now() - new Date(r.observed_at).getTime()) / 3_600_000 <= FRESH_H) a.price_fresh++;
    acc.set(k, a);
  }
  const pct = (n: number, d: number) => Number(((100 * n) / d).toFixed(1));
  const table = [...acc.entries()].filter(([, a]) => a.listings >= MIN).map(([k, a]) => {
    const [merchant, category] = k.split("|");
    return { merchant, category, listings: a.listings, brand_explicit_pct: pct(a.brand, a.listings), model_declared_pct: pct(a.model_declared, a.listings), model_in_title_pct: pct(a.model_in_title, a.listings),
      model_any_pct: pct(Math.max(a.model_declared, a.model_in_title), a.listings), gtin_pct: pct(a.gtin, a.listings), specs_rich_pct: pct(a.specs_rich, a.listings), availability_pct: pct(a.availability, a.listings), price_fresh_pct: pct(a.price_fresh, a.listings) };
  }).sort((x, y) => x.category.localeCompare(y.category) || y.listings - x.listings);
  // category roll-up: is the category engineer-fixable or source-limited? (best single merchant model coverage)
  const groupStats = new Map<string, { groups: number; all: number; atLeastTwo: number; none: number }>();
  for (const g of groups.values()) {
    if (new Set(g.list.map((x) => x.store)).size < 2) continue;
    const s = groupStats.get(g.category) ?? { groups: 0, all: 0, atLeastTwo: 0, none: 0 };
    const withModel = g.list.filter((x) => x.hasModel).length;
    s.groups++; if (withModel === g.list.length) s.all++; if (withModel >= 2) s.atLeastTwo++; if (withModel === 0) s.none++;
    groupStats.set(g.category, s);
  }
  const byCat = new Map<string, typeof table>();
  for (const t of table) { const l = byCat.get(t.category); if (l) l.push(t); else byCat.set(t.category, [t]); }
  const categories = [...byCat.entries()].map(([category, L]) => {
    const total = L.reduce((s, x) => s + x.listings, 0); const w = (f: (x: typeof L[number]) => number) => Number((L.reduce((s, x) => s + f(x) * x.listings, 0) / total).toFixed(1));
    const model = w((x) => x.model_any_pct);
    const gs = groupStats.get(category) ?? { groups: 0, all: 0, atLeastTwo: 0, none: 0 };
    const allPct = gs.groups ? Number(((100 * gs.all) / gs.groups).toFixed(1)) : null;
    return { category, listings: total, multi_store_groups: gs.groups, groups_model_on_every_listing_pct: allPct, groups_model_on_2plus_listings_pct: gs.groups ? Number(((100 * gs.atLeastTwo) / gs.groups).toFixed(1)) : null, groups_no_model_anywhere_pct: gs.groups ? Number(((100 * gs.none) / gs.groups).toFixed(1)) : null, model_any_pct_weighted: model, gtin_pct_weighted: w((x) => x.gtin_pct), brand_pct_weighted: w((x) => x.brand_explicit_pct), price_fresh_pct_weighted: w((x) => x.price_fresh_pct),
      // judged on the GROUP view (model evidence on every side of a comparison), not on per-listing coverage
      classification: allPct == null ? "NO_MULTI_STORE_GROUPS" : allPct >= 60 ? "ENGINEER_FIXABLE (model evidence on every side of most comparisons)" : allPct >= 30 ? "MIXED (evidence on every side of some comparisons)" : "SOURCE_IDENTITY_GAP (most comparisons lack model evidence on at least one side)" };
  }).sort((a, b) => b.listings - a.listings);
  const out = { date: new Date().toISOString(), min_listings_per_cell: MIN, listings_measured: rows.length, note: "internal sourcing-quality metric — never a ranking input", categories, cells: table };
  writeFileSync(resolve(process.cwd(), OUT), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ listings: rows.length, categories: categories.map((c) => `${c.category}: n=${c.listings} groups=${c.multi_store_groups} modelEveryListing=${c.groups_model_on_every_listing_pct}% 2plus=${c.groups_model_on_2plus_listings_pct}% none=${c.groups_no_model_anywhere_pct}% | listing-model=${c.model_any_pct_weighted}% gtin=${c.gtin_pct_weighted}% fresh=${c.price_fresh_pct_weighted}% → ${c.classification.split(" ")[0]}`) }, null, 1));
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
