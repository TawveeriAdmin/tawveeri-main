// scripts/tps-core/model-corroboration.ts
// Materialize cross-store MODEL-NUMBER corroborations into tps_model_corroboration.
// Precision logic lives in the tested pure module (model-corroboration.ts). Reads
// raw_observations (paginated), groups by normalized model, keeps only groups that
// pass the precision gates (≥2 stores, single brand, price-sanity), and upserts a
// provenance-complete row per corroboration. Idempotent; read-only on observations.
// SAFE: does NOT write canonical_products (folding model identity into canonicals is
// a dedup-by-construction follow-up) — so it cannot create duplicate product cards.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { readFileSync } from "fs";
import { Client } from "pg";
import { assertFingerprint } from "./tps-batch";
import { canonicalizeBrand } from "./brand-map";
import { determineCategory } from "../../src/lib/scraping/utils/category-utils";
import { normalizeModel, qualifyModelGroup, type ModelObs } from "../../src/lib/intelligence/model-corroboration";

const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function extractPrice(p: Record<string, unknown>): number | null {
  for (const c of [p.current_price, p.sellingPrice, p.price]) {
    const n = typeof c === "number" ? c : Number(String(c ?? "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("set statement_timeout = 0");
  await pg.query(readFileSync(resolve(process.cwd(), "scripts/database/knowledge-db/022_model_corroboration.sql"), "utf8"));

  type Row = ModelObs & { name: string };
  const groups = new Map<string, Row[]>();
  let lastId = 0, scanned = 0; const PAGE = 5000;
  for (;;) {
    const { rows } = await pg.query(
      `select id, store_id, raw_name, payload from raw_observations
       where id > $1 and coalesce(payload->>'modelNumber', payload->>'model') is not null
       order by id asc limit $2`, [lastId, PAGE]);
    if (!rows.length) break;
    for (const r of rows) {
      lastId = Number(r.id); scanned++;
      const p = (r.payload ?? {}) as Record<string, unknown>;
      const model = normalizeModel(asStr(p.modelNumber) ?? asStr(p.model));
      if (!model) continue;
      const brand = canonicalizeBrand(asStr(p.brandEn) ?? asStr(p.brand) ?? asStr(p.brandAr));
      const name = asStr(p.nameEn) ?? asStr(p.nameAr) ?? asStr(r.raw_name) ?? "";
      (groups.get(model) ?? groups.set(model, []).get(model)!).push({ store: Number(r.store_id), brand, price: extractPrice(p), name });
    }
  }
  console.log(`scanned=${scanned} model-bearing obs → ${groups.size} distinct models`);

  const upserts: unknown[][] = []; const rej: Record<string, number> = {}; const byCat: Record<string, number> = {};
  for (const [model, obs] of groups) {
    const q = qualifyModelGroup(obs);
    if (!q.ok) { rej[q.reason] = (rej[q.reason] ?? 0) + 1; continue; }
    const category = determineCategory(obs.map((o) => o.name).sort((a, b) => b.length - a.length)[0] || "") || "other";
    byCat[category] = (byCat[category] ?? 0) + 1;
    const prices = obs.map((o) => o.price).filter((x): x is number => x != null && x > 0);
    upserts.push([
      `${q.brand}|MODEL:${model}`, model, q.brand, category, q.stores.sort((a, b) => a - b), q.stores.length, obs.length,
      prices.length ? Math.min(...prices) : null, prices.length ? Math.max(...prices) : null,
      (obs.map((o) => o.name).sort((a, b) => b.length - a.length)[0] || "").slice(0, 300),
    ]);
  }
  console.log(`qualifying corroborations=${upserts.length}  rejected: ${JSON.stringify(rej)}`);

  for (let i = 0; i < upserts.length; i += 500) {
    const chunk = upserts.slice(i, i + 500);
    const vals: string[] = []; const params: unknown[] = [];
    chunk.forEach((r, j) => { const b = j * 10; vals.push(`(${Array.from({ length: 10 }, (_, k) => `$${b + k + 1}`).join(",")}, now())`); params.push(...r); });
    await pg.query(
      `insert into tps_model_corroboration (identity_key, model, brand, category, store_ids, store_count, observations, min_price, max_price, sample_name, updated_at)
       values ${vals.join(",")}
       on conflict (identity_key) do update set store_ids=excluded.store_ids, store_count=excluded.store_count,
         observations=excluded.observations, min_price=excluded.min_price, max_price=excluded.max_price,
         category=excluded.category, sample_name=excluded.sample_name, updated_at=now()`,
      params
    );
  }
  console.log(`\nMODEL CORROBORATION materialized=${upserts.length}`);
  console.table(byCat);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
