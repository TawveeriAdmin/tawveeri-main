// scripts/tps-er/find-corroborations.ts
// Production ER — candidate generation over real observations, bounded & safe.
// Pipeline: embed masked titles (multilingual) → block by (brand, category) → within
// blocks take cross-store pairs with cosine ≥ τ AND verifySameProduct → union-find
// clusters → a ≥2-store cluster is a CANDIDATE CORROBORATION. Reports how many are
// NEW (not already ≥2-store corroborated) and samples them for precision review.
// Read-only; writes candidates to tps_er_candidates for review (never canonicals here).
import { config } from "dotenv"; import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import pg from "pg";
import { pipeline } from "@xenova/transformers";
import { canonicalizeBrand } from "../tps-core/brand-map";
import { determineCategory } from "../../src/lib/scraping/utils/category-utils";
import { maskIdentifiers } from "../../src/lib/entity-resolution/mask";
import { verifySameProduct, specNumbers, designationSet } from "../../src/lib/entity-resolution/resolver";

const TARGET = new Set(["smartphone", "tv", "tablet", "laptop", "audio", "camera", "monitor", "smartwatch", "refrigerator", "washing_machine", "air_conditioner"]);
const PER_CAT_CAP = 700; const TAU = 0.88;
const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

(async () => {
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect(); await client.query("set statement_timeout=0");

  // Load deduped representatives per (store, category, title-prefix)
  interface Obs { id: number; store: number; brand: string; title: string; category: string; price: number | null; resolved: boolean }
  const byCat = new Map<string, Obs[]>(); const seen = new Set<string>();
  let lastId = 0;
  for (;;) {
    const { rows } = await client.query(`select id, store_id, raw_name, payload from raw_observations where id>$1 order by id asc limit 8000`, [lastId]);
    if (!rows.length) break;
    for (const r of rows) {
      lastId = Number(r.id); const p = r.payload ?? {};
      const title = asStr(p.nameEn) ?? asStr(p.nameAr) ?? asStr(r.raw_name) ?? ""; if (title.length < 10) continue;
      const category = determineCategory(title) || "other"; if (!TARGET.has(category)) continue;
      const brand = canonicalizeBrand(asStr(p.brandEn) ?? asStr(p.brand) ?? asStr(p.brandAr));
      const store = Number(r.store_id);
      const key = `${store}|${category}|${title.slice(0, 55).toLowerCase()}`; if (seen.has(key)) continue; seen.add(key);
      const arr = byCat.get(category) ?? byCat.set(category, []).get(category)!;
      if (arr.length < PER_CAT_CAP) arr.push({ id: Number(r.id), store, brand, title, category, price: null, resolved: false });
    }
  }
  const obs = [...byCat.values()].flat();
  // mark which observations are already resolved (in staging → already have an identity)
  const { rows: res } = await client.query(`select raw_obs_id from tps_identity_staging where raw_obs_id = any($1) and status<>'invalid'`, [obs.map((o) => o.id)]);
  const resolvedIds = new Set(res.map((r) => Number(r.raw_obs_id)));
  for (const o of obs) o.resolved = resolvedIds.has(o.id);
  console.log(`loaded ${obs.length} target observations across ${byCat.size} categories`);

  const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");
  const vecs: number[][] = [];
  for (let i = 0; i < obs.length; i++) { const o = await extractor("query: " + maskIdentifiers(obs[i].title), { pooling: "mean", normalize: true }); vecs.push(Array.from(o.data as Float32Array)); if ((i + 1) % 500 === 0) console.log(`  embedded ${i + 1}/${obs.length}`); }
  const cos = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

  // Union-find over verified cross-store high-similarity pairs, blocked by (brand,category)
  const parent = obs.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };
  const block = new Map<string, number[]>();
  obs.forEach((o, i) => { if (!o.brand || o.brand === "unknown") return; const k = `${o.brand}|${o.category}`; (block.get(k) ?? block.set(k, []).get(k)!).push(i); });
  let pairChecks = 0, linked = 0;
  for (const idxs of block.values()) {
    for (let a = 0; a < idxs.length; a++) for (let b = a + 1; b < idxs.length; b++) {
      const i = idxs[a], j = idxs[b]; if (obs[i].store === obs[j].store) continue; pairChecks++;
      if (cos(vecs[i], vecs[j]) < TAU) continue;
      if (!verifySameProduct({ title: maskIdentifiers(obs[i].title), brand: obs[i].brand }, { title: maskIdentifiers(obs[j].title), brand: obs[j].brand })) continue;
      union(i, j); linked++;
    }
  }
  // clusters
  const rawClusters = new Map<number, number[]>();
  obs.forEach((_, i) => { const r = find(i); (rawClusters.get(r) ?? rawClusters.set(r, []).get(r)!).push(i); });
  // PURITY GUARD: union-find is transitive — one false pair fuses correct clusters.
  // Keep only the subset that ALL verify + cos≥τ against a representative (longest,
  // most-specific title) → star topology, conservative (false-merge cost ≫ missed-match).
  const vr = (i: number, j: number) => cos(vecs[i], vecs[j]) >= TAU && verifySameProduct({ title: maskIdentifiers(obs[i].title), brand: obs[i].brand }, { title: maskIdentifiers(obs[j].title), brand: obs[j].brand });
  const clusters = new Map<number, number[]>();
  for (const [root, members] of rawClusters) {
    if (members.length < 2) { clusters.set(root, members); continue; }
    // Representative = the most SPEC-COMPLETE member (star-center must carry the
    // discriminators, else conflicting members both pass). richness = specs+designations+len.
    const richness = (i: number) => { const t = maskIdentifiers(obs[i].title); return specNumbers(t).size * 3 + designationSet(t).size * 3 + obs[i].title.length / 100; };
    const rep = members.slice().sort((a, b) => richness(b) - richness(a))[0];
    clusters.set(root, members.filter((m) => m === rep || vr(rep, m)));
  }
  const multiStore = [...clusters.values()].filter((c) => new Set(c.map((i) => obs[i].store)).size >= 2);
  const newCorrob = multiStore.filter((c) => c.some((i) => !obs[i].resolved)); // touches an unresolved obs ⇒ likely a missed corroboration
  // CONFIDENCE TIER: high = every member pairwise-verifies (internally coherent clique);
  // medium = star-verified only (rep-consistent but not all pairs checked). Never auto-merge.
  const isClique = (c: number[]) => { for (let a = 0; a < c.length; a++) for (let b = a + 1; b < c.length; b++) if (obs[c[a]].store !== obs[c[b]].store && !vr(c[a], c[b])) return false; return true; };
  const review = multiStore.map((c) => ({
    category: obs[c[0]].category,
    brand: obs[c[0]].brand,
    stores: [...new Set(c.map((i) => obs[i].store))].sort(),
    confidence: isClique(c) ? "high" : "medium",
    has_unresolved: c.some((i) => !obs[i].resolved),
    listings: c.map((i) => ({ obs_id: obs[i].id, store: obs[i].store, title: obs[i].title, resolved: obs[i].resolved })),
  })).sort((a, b) => (b.confidence === "high" ? 1 : 0) - (a.confidence === "high" ? 1 : 0) || b.stores.length - a.stores.length);
  const high = review.filter((r) => r.confidence === "high");
  const out = resolve(process.cwd(), "scripts/tps-er/er-review-queue.json");
  const { writeFileSync } = await import("fs");
  writeFileSync(out, JSON.stringify({ generated_from_reps: obs.length, tau: TAU, candidates: review }, null, 2));
  console.log(`\npair checks=${pairChecks} linked=${linked}`);
  console.log(`≥2-store candidate corroborations: ${multiStore.length}  (touch unresolved: ${newCorrob.length})`);
  console.log(`  confidence: high (internally-coherent clique)=${high.length}  medium (star-only)=${review.length - high.length}`);
  console.log(`  review queue → ${out}  — NEVER auto-merged; adjudicated before entering canonicals`);
  console.log("\nsample HIGH-confidence candidates (all pairs verify):");
  for (const r of high.slice(0, 8)) {
    console.log(`  [${r.category}/${r.brand}] stores=${r.stores.join(",")} (${r.listings.length})`);
    for (const l of r.listings.slice(0, 2)) console.log(`     s${l.store}: ${l.title.slice(0, 62)}`);
  }
  await client.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
