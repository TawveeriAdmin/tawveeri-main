// scripts/tps-er/benchmark.ts
// Entity-Resolution PILOT benchmark + evaluation (label-leakage-protected).
// Ground truth from shared manufacturer model numbers; the model/SKU is used ONLY
// to build labels and is MASKED out of the resolver input, so we measure genuine
// generalization, not answer-reading. Pairs are STORE-DISJOINT (cross-store).
//   positives     : same normalized model, different stores
//   hard negatives : same brand+category, DIFFERENT model, different stores (adversarial)
// Reports precision/recall/false-merge on FULL-SIGNAL vs MASKED, at the precision-
// first auto-resolution threshold, stratified by category. Read-only.
import { config } from "dotenv"; import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { assertFingerprint } from "../tps-core/tps-batch";
import { canonicalizeBrand } from "../tps-core/brand-map";
import { normalizeModel } from "../../src/lib/intelligence/model-corroboration";
import { determineCategory } from "../../src/lib/scraping/utils/category-utils";
import { maskIdentifiers } from "../../src/lib/entity-resolution/mask";
import { pairScore } from "../../src/lib/entity-resolution/resolver";

const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
interface Rec { store: number; brand: string; model: string; title: string; category: string }
interface Pair { a: Rec; b: Rec; label: 0 | 1; category: string }

function seededPick<T>(arr: T[], n: number, seed: number): T[] {
  // deterministic sampling (no Math.random — reproducible)
  const out: T[] = []; let s = seed;
  const idx = arr.map((_, i) => i);
  for (let k = 0; k < Math.min(n, arr.length); k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = k + (s % (idx.length - k)); [idx[k], idx[j]] = [idx[j], idx[k]]; out.push(arr[idx[k]]); }
  return out;
}

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("set statement_timeout=0");

  // Load model-bearing observations (one representative per store+model to avoid dup spam)
  const recs: Rec[] = []; let lastId = 0; const PAGE = 5000; const seen = new Set<string>();
  for (;;) {
    const { rows } = await pg.query(`select id, store_id, raw_name, payload from raw_observations where id>$1 and coalesce(payload->>'modelNumber',payload->>'model') is not null order by id asc limit $2`, [lastId, PAGE]);
    if (!rows.length) break;
    for (const r of rows) {
      lastId = Number(r.id); const p = r.payload ?? {};
      const model = normalizeModel(asStr(p.modelNumber) ?? asStr(p.model)); if (!model) continue;
      const brand = canonicalizeBrand(asStr(p.brandEn) ?? asStr(p.brand) ?? asStr(p.brandAr));
      const title = asStr(p.nameEn) ?? asStr(p.nameAr) ?? asStr(r.raw_name) ?? ""; if (title.length < 8) continue;
      const store = Number(r.store_id);
      const dedup = `${store}|${model}`; if (seen.has(dedup)) continue; seen.add(dedup);
      recs.push({ store, brand, model, title, category: determineCategory(title) || "other" });
    }
  }
  console.log(`loaded ${recs.length} store×model representatives`);

  // Positives: same model across ≥2 stores
  const byModel = new Map<string, Rec[]>();
  for (const r of recs) (byModel.get(r.model) ?? byModel.set(r.model, []).get(r.model)!).push(r);
  const positives: Pair[] = [];
  for (const g of byModel.values()) {
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (g[i].store !== g[j].store) positives.push({ a: g[i], b: g[j], label: 1, category: g[i].category });
  }
  // Hard negatives: same brand+category, DIFFERENT model, different stores
  const byBrandCat = new Map<string, Rec[]>();
  for (const r of recs) if (r.brand && r.brand !== "unknown") (byBrandCat.get(`${r.brand}|${r.category}`) ?? byBrandCat.set(`${r.brand}|${r.category}`, []).get(`${r.brand}|${r.category}`)!).push(r);
  const hardNegs: Pair[] = [];
  for (const g of byBrandCat.values()) {
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++)
      if (g[i].store !== g[j].store && g[i].model !== g[j].model) hardNegs.push({ a: g[i], b: g[j], label: 0, category: g[i].category });
  }
  const pos = seededPick(positives, 600, 7); const neg = seededPick(hardNegs, 1200, 13);
  console.log(`benchmark: positives=${pos.length} (of ${positives.length})  hard-negatives=${neg.length} (of ${hardNegs.length})`);

  // Evaluate at precision-first threshold, FULL vs MASKED
  const evalSet = [...pos, ...neg];
  function scoreAll(mask: boolean) {
    return evalSet.map((p) => ({ label: p.label, category: p.category, score: pairScore(
      { title: mask ? maskIdentifiers(p.a.title) : p.a.title, brand: p.a.brand },
      { title: mask ? maskIdentifiers(p.b.title) : p.b.title, brand: p.b.brand }) }));
  }
  function metricsAt(scored: { label: number; score: number }[], thr: number) {
    let tp = 0, fp = 0, fn = 0;
    for (const s of scored) { const pred = s.score >= thr; if (pred && s.label === 1) tp++; else if (pred && s.label === 0) fp++; else if (!pred && s.label === 1) fn++; }
    const precision = tp + fp ? tp / (tp + fp) : 1; const recall = tp + fn ? tp / (tp + fn) : 0;
    return { tp, fp, fn, precision, recall };
  }
  // find the lowest threshold achieving precision ≥ 0.98 (false merges are costly)
  function bestThreshold(scored: { label: number; score: number }[]) {
    let best = { thr: 1, recall: 0, precision: 1, fp: 0 };
    for (let thr = 0.2; thr <= 0.9; thr += 0.01) { const m = metricsAt(scored, thr); if (m.precision >= 0.98 && m.recall > best.recall) best = { thr: Number(thr.toFixed(2)), recall: m.recall, precision: m.precision, fp: m.fp }; }
    return best;
  }
  for (const mask of [false, true]) {
    const scored = scoreAll(mask);
    const b = bestThreshold(scored);
    console.log(`\n=== ${mask ? "MASKED (genuine generalization)" : "FULL-SIGNAL (production reality)"} ===`);
    console.log(`  best precision-first threshold=${b.thr}  → precision=${(b.precision * 100).toFixed(1)}% recall=${(b.recall * 100).toFixed(1)}% (${b.fp} false-merges)`);
    // category-stratified recall at that threshold
    const cats = [...new Set(evalSet.map((p) => p.category))];
    for (const cat of cats) {
      const sc = scored.filter((_, i) => evalSet[i].category === cat);
      const m = metricsAt(sc, b.thr);
      if (m.tp + m.fn > 0) console.log(`    ${cat.padEnd(14)} P=${(m.precision * 100).toFixed(0)}% R=${(m.recall * 100).toFixed(0)}% (pos ${m.tp + m.fn}, fp ${m.fp})`);
    }
  }
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
