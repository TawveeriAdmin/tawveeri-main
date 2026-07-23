// scripts/tps-analysis/identity-impact.ts
// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY-CHANGE IMPACT ANALYZER (ADR-058)
//
// Identity keys are the moat. Any change to a plugin's parser or identity
// contract silently rewrites them the next time the backfill runs — and a wrong
// merge corrupts the graph (Constitution principle 6). Before this tool there
// was no way to see what a parser change would DO to production identity.
//
// This replays the exact normalize → buildIdentityKey path used by the
// progressive engine over the CURRENT production observations, and diffs the
// recomputed key against the key stored in `tps_identity_staging`.
//
// Strictly READ-ONLY — it never writes. Run it before and after any identity
// change, and require the corroboration delta to be understood before applying.
//
// Two modes:
//   (default)   diff the RECOMPUTED key against the key stored in staging.
//   --simulate  normalize raw_observations from scratch for a given store set,
//               deduplicated by merchant listing identity (ADR-059). This answers
//               "what would onboarding this merchant actually deliver?" WITHOUT
//               writing anything — the standard we hold before calling a merchant
//               operational.
//
// Usage: npx tsx scripts/tps-analysis/identity-impact.ts [category ...]
//        npx tsx scripts/tps-analysis/identity-impact.ts --simulate --stores 1,2,4,5
//        npx tsx scripts/tps-analysis/identity-impact.ts --simulate --stores 1,2,3,4,5,8
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { CATEGORY_DEFS } from "../tps-core/category-registry";
import { pickBestUrl } from "../tps-core/url-util";
import { reconcileIdentities, corroboratedClasses, type KeyedObservation } from "../../src/lib/identity/alias-graph";
import { resolveListingIdentity, isSaudiMarket } from "../../src/lib/identity/merchant-listing-identity";
import type { CategoryDef } from "../tps-core/category-registry";

const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Mirrors `adaptRow` in progressive-engine.ts — the field mapping under test. */
function adaptRow(p: Record<string, unknown>, rawName: string | null) {
  const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(rawName) ?? "";
  const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
  const brand = asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null;
  return { nameAr, nameEn, brand, url: pickBestUrl(p) };
}

interface Row { raw_obs_id: number; store_id: number; category: string; identity_key: string; payload: Record<string, unknown> | null; raw_name: string | null }

/** Distinct (category, key) → set of stores, i.e. the corroboration surface. */
function corroboration(pairs: { category: string; key: string; store: number }[]) {
  const m = new Map<string, Set<number>>();
  for (const p of pairs) {
    const k = `${p.category}|${p.key}`;
    (m.get(k) ?? m.set(k, new Set()).get(k)!).add(p.store);
  }
  const multistoreKeys = new Set<string>();
  for (const [k, s] of m) if (s.size >= 2) multistoreKeys.add(k);
  return { keys: m.size, multistore: multistoreKeys.size, multistoreKeys };
}

const STORE_SLUG: Record<number, string> = {
  1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 6: "samsung_ksa", 7: "shaker", 8: "swsg",
};

/**
 * SIMULATION MODE — normalize raw observations for a store set exactly as the
 * progressive engine would, deduplicated by merchant listing identity, and
 * report the corroboration surface with and without each store. Read-only.
 */
async function simulate(pg: Client, defs: CategoryDef[], stores: number[]) {
  const seen = new Set<string>();
  const rows: (KeyedObservation & { listingKey: string })[] = [];
  let cursor = 0, scanned = 0, foreign = 0;
  for (;;) {
    const page = await pg.query(
      `select id, store_id, raw_name, payload,
              coalesce(payload->>'productUrl', payload->>'url', payload->>'product_url', raw_url) u
       from raw_observations where store_id = any($1) and id > $2 order by id asc limit 20000`,
      [stores, cursor]
    );
    if (!page.rows.length) break;
    for (const r of page.rows) {
      cursor = Number(r.id); scanned++;
      const store = Number(r.store_id);
      const ident = resolveListingIdentity(store, r.u as string | null, STORE_SLUG[store]);
      if (!ident.key) continue;
      if (!isSaudiMarket(ident.market)) { foreign++; continue; }
      if (seen.has(ident.key)) continue;      // one representative per real listing
      seen.add(ident.key);

      const p = (r.payload ?? {}) as Record<string, unknown>;
      const { nameAr, nameEn, brand } = adaptRow(p, r.raw_name);
      for (const def of defs) {
        if (!def.plugin.detect(nameAr, nameEn)) continue;
        const norm = def.normalize(nameAr, nameEn, brand, p);
        const withModel = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
        const fallback = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: null });
        const modelKey = withModel.key && withModel.key.includes("|MODEL:") ? withModel.key : null;
        const specKey = fallback.status !== "invalid" && fallback.key ? fallback.key : null;
        if (!modelKey && !specKey) continue;
        rows.push({ id: Number(r.id), storeId: store, category: def.category, modelKey, specKey, listingKey: ident.key });
        break; // first matching category wins, as in the engine's staging order
      }
    }
  }
  console.log(`\nSIMULATION — stores ${stores.join(",")}`);
  console.log(`  observations scanned      : ${scanned}`);
  console.log(`  non-Saudi excluded        : ${foreign}`);
  console.log(`  distinct Saudi listings   : ${seen.size}`);
  console.log(`  listings with an identity : ${rows.length}  (${((100 * rows.length) / Math.max(1, seen.size)).toFixed(1)}% identity coverage)`);

  // 2x2 DECOMPOSITION. The store-addition gain and the aliasing gain must be
  // reported as SEPARATE, non-overlapping effects — two measurements of the same
  // identities would double-count the prize. `noAlias` reproduces exact-key
  // corroboration by giving each observation a single key and no bridges.
  const noAlias = rows.map((r) => ({ ...r, modelKey: r.modelKey ?? r.specKey, specKey: null }));
  const exactClasses = reconcileIdentities(noAlias);
  const exactCorrob = corroboratedClasses(exactClasses);
  const classes = reconcileIdentities(rows);
  const corrob = corroboratedClasses(classes);
  console.log(`  identity classes          : ${classes.length}`);
  console.log(`  corroborated EXACT-KEY    : ${exactCorrob.length}   (no aliasing)`);
  console.log(`  CORROBORATED (>=2 stores) : ${corrob.length}   (with aliasing, +${corrob.length - exactCorrob.length})`);

  const perStore = new Map<number, number>();
  for (const r of rows) perStore.set(r.storeId, (perStore.get(r.storeId) ?? 0) + 1);
  console.log(`  identities per store      : ${[...perStore.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => `${STORE_SLUG[s]}=${n}`).join("  ")}`);

  // Which stores actually participate in a corroborated identity — the real
  // test of "operational", not "ingesting".
  const participating = new Map<number, number>();
  for (const c of corrob) for (const s of c.storeIds) participating.set(s, (participating.get(s) ?? 0) + 1);
  console.log(`  stores IN corroborations  : ${[...participating.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${STORE_SLUG[s]}=${n}`).join("  ") || "(none)"}`);
  return { corroborated: corrob.length, classes: classes.length, listings: seen.size, corrob };
}

(async () => {
  const url = process.env.SUPABASE_DB_URL!;
  if (!/db\.vyceqrzttspyycdpojtn\.supabase\.co/.test(url)) throw new Error("refusing: not production");
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--") && !/^\d/.test(a));

  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  const defs = Object.values(CATEGORY_DEFS).filter((d) => !only.length || only.includes(d.category));
  if (!defs.length) throw new Error(`no such category; known: ${Object.values(CATEGORY_DEFS).map((d) => d.category).join(", ")}`);

  if (process.argv.includes("--simulate")) {
    const arg = process.argv[process.argv.indexOf("--stores") + 1] ?? "1,2,4,5";
    const stores = arg.split(",").map(Number).filter(Number.isFinite);
    await simulate(pg, defs, stores);
    await pg.end();
    return;
  }

  // One deduplicated representative per (store, url) — daily re-scrapes inflate
  // raw counts 8–23x and would swamp the diff with duplicates.
  const { rows } = await pg.query<Row>(
    `select distinct on (s.store_id, s.url)
            s.raw_obs_id, s.store_id, s.category, s.identity_key, o.payload, o.raw_name
     from tps_identity_staging s
     join raw_observations o on o.id = s.raw_obs_id
     where s.category = any($1) and s.status = 'valid'
     order by s.store_id, s.url, s.observed_at desc`,
    [defs.map((d) => d.category)]
  );

  const before: { category: string; key: string; store: number }[] = [];
  const after: { category: string; key: string; store: number }[] = [];
  const aliasRows: KeyedObservation[] = [];
  const changes = new Map<string, { from: string; to: string; n: number }>();
  let unchanged = 0, changed = 0, nowInvalid = 0;

  for (const r of rows) {
    const def = defs.find((d) => d.category === r.category);
    if (!def) continue;
    const p = r.payload ?? {};
    const { nameAr, nameEn, brand } = adaptRow(p, r.raw_name);
    before.push({ category: r.category, key: r.identity_key, store: r.store_id });

    const norm = def.normalize(nameAr, nameEn, brand, p);
    const id = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });

    // Both key spaces for alias reconciliation: force the fallback by withholding
    // the model number, so we learn the spec key this listing ALSO evidences.
    const fallback = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: null });
    aliasRows.push({
      id: r.raw_obs_id, storeId: r.store_id, category: r.category,
      modelKey: id.key && id.key.includes("|MODEL:") ? id.key : null,
      specKey: fallback.status !== "invalid" && fallback.key ? fallback.key : null,
    });

    if (id.status === "invalid" || !id.key) { nowInvalid++; continue; }
    after.push({ category: r.category, key: id.key, store: r.store_id });

    if (id.key === r.identity_key) { unchanged++; continue; }
    changed++;
    const sig = `${r.identity_key} → ${id.key}`;
    const e = changes.get(sig) ?? { from: r.identity_key, to: id.key, n: 0 };
    e.n++; changes.set(sig, e);
  }

  const b = corroboration(before), a = corroboration(after);
  console.log(`\ncategories: ${defs.map((d) => d.category).join(", ")}`);
  console.log(`deduplicated listings analyzed: ${rows.length}`);
  console.log(`  key unchanged : ${unchanged}`);
  console.log(`  key CHANGED   : ${changed}   (${changes.size} distinct rewrites)`);
  console.log(`  now INVALID   : ${nowInvalid}  (would drop out of staging)`);
  console.log(`\ncorroboration surface (distinct keys / keys present in >=2 stores)`);
  console.log(`  before : ${b.keys} keys, ${b.multistore} multi-store`);
  console.log(`  after  : ${a.keys} keys, ${a.multistore} multi-store`);
  const delta = a.multistore - b.multistore;
  console.log(`  DELTA  : ${delta >= 0 ? "+" : ""}${delta} corroborated identities`);

  // Scenario 3: new parsers PLUS alias reconciliation (ADR-058 alias-graph),
  // which bridges the model/spec key spaces using co-occurrence evidence only.
  const classes = reconcileIdentities(aliasRows);
  const corrob = corroboratedClasses(classes);
  console.log(`\nwith ALIAS RECONCILIATION (model/spec key spaces bridged by evidence)`);
  console.log(`  identity classes : ${classes.length}`);
  console.log(`  corroborated     : ${corrob.length} (>=2 stores)`);
  const d2 = corrob.length - b.multistore;
  console.log(`  DELTA vs today   : ${d2 >= 0 ? "+" : ""}${d2} corroborated identities`);
  const bridged = classes.filter((c) => c.memberKeys.length > 1 && c.storeIds.length >= 2);
  if (bridged.length) {
    console.log(`\n  corroborations that EXIST ONLY because of aliasing (${bridged.length}):`);
    for (const c of bridged.slice(0, 15)) {
      console.log(`   [${c.category}] stores=${c.storeIds.join(",")}  ${c.memberKeys.join("  ==  ")}`);
    }
  }

  // The decision-critical output: WHICH corroborations were lost or gained.
  // A negative delta must be explained before any identity change is applied.
  const lost = [...b.multistoreKeys].filter((k) => !a.multistoreKeys.has(k));
  const gained = [...a.multistoreKeys].filter((k) => !b.multistoreKeys.has(k));
  if (lost.length) {
    console.log(`\nLOST corroborations (${lost.length}) — these stop being multi-store:`);
    for (const k of lost.slice(0, 25)) console.log(`  - ${k}`);
  }
  if (gained.length) {
    console.log(`\nGAINED corroborations (${gained.length}):`);
    for (const k of gained.slice(0, 25)) console.log(`  + ${k}`);
  }

  const sample = [...changes.values()].sort((x, y) => y.n - x.n).slice(0, 15);
  if (sample.length) {
    console.log(`\ntop key rewrites:`);
    for (const c of sample) console.log(`  [${c.n}]  ${c.from}\n        → ${c.to}`);
  }
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
