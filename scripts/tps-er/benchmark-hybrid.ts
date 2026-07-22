// scripts/tps-er/benchmark-hybrid.ts
// Measures the HYBRID entity-resolution architecture on the leakage-protected
// benchmark: multilingual embedding candidate generation (recall) + deterministic
// multi-signal verification (precision). Compares embedding-ONLY vs hybrid to
// quantify the verifier's precision contribution. Masked titles. Read-only.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import pg from "pg";
import { pipeline } from "@xenova/transformers";
import { canonicalizeBrand } from "../tps-core/brand-map";
import { normalizeModel } from "../../src/lib/intelligence/model-corroboration";
import { determineCategory } from "../../src/lib/scraping/utils/category-utils";
import { maskIdentifiers } from "../../src/lib/entity-resolution/mask";
import { verifySameProduct } from "../../src/lib/entity-resolution/resolver";

const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function seededPick<T>(arr: T[], n: number, seed: number): T[] { const out: T[] = []; let s = seed; const idx = arr.map((_, i) => i); for (let k = 0; k < Math.min(n, arr.length); k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = k + (s % (idx.length - k)); [idx[k], idx[j]] = [idx[j], idx[k]]; out.push(arr[idx[k]]); } return out; }
interface Rec { store: number; brand: string; model: string; title: string; category: string }
interface Pair { a: Rec; b: Rec; label: 0 | 1; category: string }

(async () => {
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect(); await client.query("set statement_timeout=0");
  const recs: Rec[] = []; let lastId = 0; const seen = new Set<string>();
  for (;;) {
    const { rows } = await client.query(`select id, store_id, raw_name, payload from raw_observations where id>$1 and coalesce(payload->>'modelNumber',payload->>'model') is not null order by id asc limit 5000`, [lastId]);
    if (!rows.length) break;
    for (const r of rows) {
      lastId = Number(r.id); const p = r.payload ?? {};
      const model = normalizeModel(asStr(p.modelNumber) ?? asStr(p.model)); if (!model) continue;
      const brand = canonicalizeBrand(asStr(p.brandEn) ?? asStr(p.brand) ?? asStr(p.brandAr));
      const title = asStr(p.nameEn) ?? asStr(p.nameAr) ?? asStr(r.raw_name) ?? ""; if (title.length < 8) continue;
      const store = Number(r.store_id); const k = `${store}|${model}`; if (seen.has(k)) continue; seen.add(k);
      recs.push({ store, brand, model, title, category: determineCategory(title) || "other" });
    }
  }
  await client.end();
  const byModel = new Map<string, Rec[]>(); for (const r of recs) (byModel.get(r.model) ?? byModel.set(r.model, []).get(r.model)!).push(r);
  const positives: Pair[] = []; for (const g of byModel.values()) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (g[i].store !== g[j].store) positives.push({ a: g[i], b: g[j], label: 1, category: g[i].category });
  const byBC = new Map<string, Rec[]>(); for (const r of recs) if (r.brand && r.brand !== "unknown") (byBC.get(`${r.brand}|${r.category}`) ?? byBC.set(`${r.brand}|${r.category}`, []).get(`${r.brand}|${r.category}`)!).push(r);
  const hardNegs: Pair[] = []; for (const g of byBC.values()) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (g[i].store !== g[j].store && g[i].model !== g[j].model) hardNegs.push({ a: g[i], b: g[j], label: 0, category: g[i].category });
  const pairs = [...seededPick(positives, 600, 7), ...seededPick(hardNegs, 1200, 13)];
  console.log(`benchmark: positives=${pairs.filter((p) => p.label).length} hard-negatives=${pairs.filter((p) => !p.label).length}`);

  const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");
  const cache = new Map<string, number[]>();
  const emb = async (title: string): Promise<number[]> => { const m = maskIdentifiers(title); if (cache.has(m)) return cache.get(m)!; const o = await extractor("query: " + m, { pooling: "mean", normalize: true }); const v = Array.from(o.data as Float32Array); cache.set(m, v); return v; };
  const cos = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const scored: { label: number; category: string; cos: number; verified: boolean }[] = [];
  let done = 0;
  for (const p of pairs) { const ea = await emb(p.a.title), eb = await emb(p.b.title); const verified = verifySameProduct({ title: maskIdentifiers(p.a.title), brand: p.a.brand }, { title: maskIdentifiers(p.b.title), brand: p.b.brand }); scored.push({ label: p.label, category: p.category, cos: cos(ea, eb), verified }); if (++done % 400 === 0) console.log(`  embedded ${done}/${pairs.length}`); }

  type S = { label: number; category: string; cos: number; verified: boolean };
  const metrics = (pred: (s: S) => boolean) => { let tp = 0, fp = 0, fn = 0; for (const s of scored) { const y = pred(s); if (y && s.label === 1) tp++; else if (y && s.label === 0) fp++; else if (!y && s.label === 1) fn++; } return { tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 0 }; };
  const best = (factory: (t: number) => (s: S) => boolean) => { let b = { thr: 1, recall: 0, precision: 1, fp: 0 }; for (let t = 0.80; t <= 0.985; t += 0.005) { const m = metrics(factory(t)); if (m.precision >= 0.98 && m.recall > b.recall) b = { thr: +t.toFixed(3), recall: m.recall, precision: m.precision, fp: m.fp }; } return b; };
  // Positive cosine distribution — the embedding recall ceiling (cross-lingual bridging)
  const posCos = scored.filter((s) => s.label === 1).map((s) => s.cos).sort((a, b) => a - b);
  const pct = (p: number) => posCos[Math.floor(posCos.length * p)] ?? 0;
  console.log(`\npositive cosine: p10=${pct(0.1).toFixed(3)} median=${pct(0.5).toFixed(3)} p90=${pct(0.9).toFixed(3)}  (≥0.85: ${(posCos.filter((c) => c >= 0.85).length / posCos.length * 100).toFixed(0)}%, ≥0.88: ${(posCos.filter((c) => c >= 0.88).length / posCos.length * 100).toFixed(0)}%)`);

  // Hybrid at fixed candidate thresholds — verify controls precision
  for (const thr of [0.85, 0.88, 0.90]) {
    const m = metrics((s) => s.cos >= thr && s.verified);
    const me = metrics((s) => s.cos >= thr);
    console.log(`thr=${thr}  embedding-only P=${(me.precision * 100).toFixed(0)}% R=${(me.recall * 100).toFixed(0)}%  →  HYBRID P=${(m.precision * 100).toFixed(1)}% R=${(m.recall * 100).toFixed(1)}% (fp ${m.fp})`);
  }
  // What ARE the residual hybrid false positives at 0.88? (expect: color variants — same specs, no verifiable conflict)
  let shown = 0;
  console.log("residual hybrid false-positives @0.88 (labelled 'different model' but verifier finds no spec/variant conflict):");
  for (let i = 0; i < pairs.length && shown < 5; i++) {
    const s = scored[i];
    if (s.label === 0 && s.cos >= 0.88 && s.verified) { console.log(`   • ${pairs[i].a.title.slice(0, 40)}  ↔  ${pairs[i].b.title.slice(0, 40)}`); shown++; }
  }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
