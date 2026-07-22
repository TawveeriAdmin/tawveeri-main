// scripts/tps-core/enrich-model-dna.ts
// Enrich the Product DNA of model-corroborated canonicals (their identity came from
// a model number; spec attributes were empty). Deterministic, precision-first: AC and
// laptop reuse their category plugins (decider-exact specs); mobile uses the tested
// storage/variant extractor; other categories get generic specs for display. Only
// confidently-extracted fields are added; identity attributes are preserved; unknown
// stays absent (honest). Idempotent (re-runnable). Updates canonical_products only.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { assertFingerprint } from "./tps-batch";
import { acPlugin } from "../tps-plugins/ac";
import { laptopPlugin } from "../tps-plugins/laptop";
import { enrichMobileDna } from "../../src/lib/intelligence/dna-enrich";
import { extractSpecsFromTitle } from "../../src/lib/scraping/config/spec-configs";

function specsFor(category: string, nameAr: string, nameEn: string, brand: string | null): Record<string, unknown> {
  if (category === "air_conditioner") {
    const p = acPlugin.normalize(nameAr, nameEn, brand).payload;
    const out: Record<string, unknown> = {};
    for (const k of ["capacity_btu", "ac_type", "technology", "cooling_mode"]) if (p[k] != null) out[k] = p[k];
    return out;
  }
  if (category === "laptop") {
    const p = laptopPlugin.normalize(nameAr, nameEn, brand).payload;
    const out: Record<string, unknown> = {};
    for (const k of ["family", "cpu", "ram", "storage", "screen", "gpu"]) if (p[k] != null) out[k] = p[k];
    return out;
  }
  if (category === "mobile") return enrichMobileDna(nameAr, nameEn);
  // smartwatch / monitor / tablet / other → generic display specs
  const g = extractSpecsFromTitle(`${nameAr} ${nameEn}`);
  const out: Record<string, unknown> = {};
  if (g.storage_gb) out.storage = Number(g.storage_gb);
  if (g.ram_gb) out.ram = Number(g.ram_gb);
  if (g.screen_size) out.screen_size = Number(g.screen_size);
  if (g.resolution) out.resolution = g.resolution;
  if (g.panel_type) out.panel = g.panel_type;
  return out;
}

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const { rows } = await pg.query(`select id, category, brand, name_ar, name_en, attributes from canonical_products where tps_version='model-corroboration-v1'`);
  let enriched = 0; const byCat: Record<string, number> = {};
  for (const r of rows) {
    const specs = specsFor(r.category, r.name_ar ?? "", r.name_en ?? "", r.brand ?? null);
    const added = Object.keys(specs).filter((k) => specs[k] != null);
    if (!added.length) continue;
    const merged = { ...(r.attributes ?? {}), ...specs, dna_enriched: true };
    await pg.query(`update canonical_products set attributes=$1, data_updated_at=now() where id=$2`, [JSON.stringify(merged), r.id]);
    enriched++; byCat[r.category] = (byCat[r.category] ?? 0) + 1;
  }
  console.log(`DNA-enriched ${enriched}/${rows.length} model canonicals`);
  console.table(byCat);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
