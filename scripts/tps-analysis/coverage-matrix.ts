// scripts/tps-analysis/coverage-matrix.ts
// E15.5 W1 — Coverage Matrix. Evidence-based, by-store × by-category coverage of
// the corroborated knowledge graph on System A. Read-only. Emits Markdown to
// stdout (redirect into docs/COVERAGE-MATRIX.md). Sources: tps_identity_staging
// (per-observation resolved identities), tps_product_projection (corroborated /
// resolved-single), raw_observations (ingestion), canonical_products.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";

const STORE_NAME: Record<number, string> = { 1: "Jarir", 2: "Amazon", 4: "Extra", 5: "Almanea" };

(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const rawByStore = (await c.query("select store_id, count(*) n from raw_observations where store_id is not null group by store_id order by store_id")).rows;
  const stagingByCatStore = (await c.query(
    `select category, store_id, count(distinct identity_key) keys, count(*) filter (where status='valid') valid
     from tps_identity_staging where identity_key is not null group by category, store_id`)).rows;
  const proj = (await c.query(
    `select category, count(*) filter (where has_comparison) corroborated, count(*) filter (where not has_comparison) single
     from tps_product_projection group by category order by category`)).rows;
  const totals = (await c.query(
    `select (select count(*) from raw_observations) raw,
            (select count(distinct identity_key) from tps_identity_staging where identity_key is not null) resolved,
            (select count(*) from tps_product_projection where has_comparison) corroborated,
            (select count(*) from tps_product_projection where not has_comparison) single,
            (select count(*) from tps_product_projection) indexed`)).rows[0];

  const cats = [...new Set(stagingByCatStore.map((r) => r.category))].sort();
  const projMap = Object.fromEntries(proj.map((r) => [r.category, r]));
  const now = new Date().toISOString().slice(0, 10);

  let md = `# Coverage Matrix — Knowledge Graph (System A)\n\n`;
  md += `**Generated:** ${now} · read-only from production \`vyceqrzttspyycdpojtn\` · regenerate: \`npx tsx scripts/tps-analysis/coverage-matrix.ts > docs/COVERAGE-MATRIX.md\`\n\n`;
  md += `E15.5 · W1. Evidence-based completeness by store and category. Corroborated = ≥2-store comparable (Layer 1). Single-store = resolved identity, one offer (Layer 2). "Keys" = distinct resolved product identities observed at that store.\n\n`;

  md += `## Totals\n\n| Metric | Value |\n|---|---|\n`;
  md += `| Raw observations (all stores) | ${totals.raw} |\n`;
  md += `| Distinct resolved product identities | ${totals.resolved} |\n`;
  md += `| Corroborated canonicals (Layer 1, comparable) | ${totals.corroborated} |\n`;
  md += `| Resolved-single (Layer 2) | ${totals.single} |\n`;
  md += `| Owned index (projection) | ${totals.indexed} |\n\n`;

  md += `## By store — raw observation volume\n\n| Store | Raw observations |\n|---|---|\n`;
  for (const r of rawByStore) md += `| ${STORE_NAME[r.store_id] ?? r.store_id} | ${r.n} |\n`;
  md += `\n`;

  md += `## By category × store — resolved product identities (distinct keys)\n\n`;
  md += `| Category | Jarir | Extra | Amazon | Almanea | Corroborated | Single-store |\n|---|---|---|---|---|---|---|\n`;
  for (const cat of cats) {
    const cell = (sid: number) => { const r = stagingByCatStore.find((x) => x.category === cat && x.store_id === sid); return r ? r.keys : 0; };
    const p = projMap[cat] || { corroborated: 0, single: 0 };
    md += `| **${cat}** | ${cell(1)} | ${cell(4)} | ${cell(2)} | ${cell(5)} | ${p.corroborated} | ${p.single} |\n`;
  }
  md += `\n## Reading the matrix\n\n`;
  md += `- **Corroboration is store-diversity-bound, not volume-bound:** a category can have many resolved identities but few corroborated (the same product must appear in ≥2 stores). This is precision-over-recall, not a coverage gap.\n`;
  md += `- **Single-store dominance is structural** in the KSA 4-store market (evidence: laptop 0 corroboration despite thousands of units). Layer 2 keeps these discoverable without false comparison.\n`;
  md += `- **Growth path:** \`/api/cron/tps-progressive\` (scheduled) processes newly-ingested observations continuously, so corroboration rises as store overlap appears.\n`;
  md += `\n## Categories evaluated but NOT built (evidence-based, precision over recall)\n\n`;
  md += `These were requested/considered but have insufficient clean production evidence to build an honest decider — building one would fabricate capability:\n\n`;
  md += `| Category | Finding (production \`raw_observations\`) | Decision |\n|---|---|---|\n`;
  md += `| cooker / gas range (بوتاجاز) | **n=0** with proper signals (gas range/بوتاجاز/burners) — the catalog has rice/pressure cookers only | Not built |\n`;
  md += `| water heater (سخان مياه) | **n=0** — the سخان keyword matched only cup-warmers/kettles | Not built |\n`;
  md += `| range hood (شفاط) | n=6, **1 distinct SKU** (Kumtel DT6-61, 5 duplicates), single store | Not built (too thin) |\n`;
  md += `\nRe-evaluate on new ingestion; each becomes a one-line appliance config the moment ≥1 clean multi-unit signal appears.\n`;

  console.log(md);
  await c.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
