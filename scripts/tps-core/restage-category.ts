// scripts/tps-core/restage-category.ts
// ─────────────────────────────────────────────────────────────────────────────
// RE-STAGE ONE CATEGORY AGAINST THE CURRENT PARSER (ADR-177)
//
// WHY THIS EXISTS. `normalize-incremental` is cursor-based: it stages observations
// it has never seen. A PARSER change does not create new observations — it changes
// what the ones we already hold mean, and the engine has no path for that.
// `--replay-from` is dry-only by design, and resetting a store cursor replays every
// category for that store (846k observations) to fix one.
//
// So this recomputes identity for the rows ALREADY STAGED in one category, using the
// engine's own `normalize`/`buildIdentityKey`/`corroboratePass` — no second notion of
// what an identity is — and writes only what changed.
//
// SAFETY, in the order it matters:
//   · DRY BY DEFAULT. `--apply` is required to write anything.
//   · Takes the ADR-099 normalization lane lock, so the hourly chain's normalize step
//     (`--yield-if-locked`) stands down instead of running concurrently. Never run
//     this beside a refresh chain — that is the concurrency that wedged PostgREST.
//   · Snapshots every row it will change to docs/evidence/ BEFORE writing, so the
//     previous keys can be restored exactly.
//   · Corroborates in BOTH directions. A key that falls from 2 stores to 1 is skipped
//     by the default pass (it only writes >=2), which would leave the OLD canonical
//     live with its old offers — a comparison the evidence no longer supports. The
//     single-store pass rewrites those as Layer-2 resolved-single, and any key left
//     with NO members at all is reported for deactivation rather than left behind.
//
// Usage:
//   npx tsx scripts/tps-core/restage-category.ts tv            # dry
//   npx tsx scripts/tps-core/restage-category.ts tv --apply
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { writeFileSync, mkdirSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { CATEGORY_DEFS } from "./category-registry";
import { corroboratePass } from "./progressive-engine";
import { assertFingerprint } from "./tps-batch";
import { pickBestUrl } from "./url-util";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toPoolerDbUrl } = require("./pooler-url.js") as { toPoolerDbUrl: (raw: string) => string };

const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
/** Mirrors `adaptRow` in progressive-engine.ts — the same field mapping the sweep uses. */
function adaptRow(p: Record<string, unknown>, rawName: string | null) {
  const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(rawName) ?? "";
  const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
  const brand = asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null;
  return { nameAr, nameEn, brand, url: pickBestUrl(p) };
}

const LANE_KEY = 814_8148;

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const category = process.argv[2];
  const def = CATEGORY_DEFS[category as keyof typeof CATEGORY_DEFS];
  if (!def) throw new Error(`unknown category '${category}'; known: ${Object.keys(CATEGORY_DEFS).join(", ")}`);
  const apply = process.argv.includes("--apply");

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  // ── ADR-099 lane lease ────────────────────────────────────────────────────
  let lockClient: Client | null = null;
  if (apply) {
    lockClient = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
    await lockClient.connect();
    const got = (await lockClient.query<{ ok: boolean }>(`select pg_try_advisory_lock($1) ok`, [LANE_KEY])).rows[0].ok;
    if (!got) {
      console.error("REFUSING: the normalization lane is busy (ADR-099). Another writer holds it.");
      await lockClient.end(); await pg.end();
      process.exit(2);
    }
    console.log("lane lock acquired");
  }

  // ── recompute ─────────────────────────────────────────────────────────────
  type Row = { raw_obs_id: number; store_id: number | null; identity_key: string; status: string; raw_name: string | null; payload: Record<string, unknown> | null };
  const changed: { raw_obs_id: number; store_id: number | null; from: string; fromStatus: string; to: string | null; toStatus: string }[] = [];
  const affectedKeys = new Set<string>();
  let scanned = 0, same = 0;
  let cursor = -1;
  for (;;) {
    const page = await pg.query<Row>(
      `select s.raw_obs_id, s.store_id, s.identity_key, s.status, o.raw_name, o.payload
       from tps_identity_staging s join raw_observations o on o.id = s.raw_obs_id
       where s.category = $1 and s.raw_obs_id > $2 order by s.raw_obs_id asc limit 5000`,
      [category, cursor]
    );
    if (!page.rows.length) break;
    for (const r of page.rows) {
      cursor = Number(r.raw_obs_id); scanned++;
      const p = r.payload ?? {};
      const { nameAr, nameEn, brand } = adaptRow(p, r.raw_name);
      const norm = def.normalize(nameAr, nameEn, brand, p);
      const id = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
      const toKey = id.status === "invalid" ? null : id.key;
      if (toKey === r.identity_key && id.status === r.status) { same++; continue; }
      changed.push({ raw_obs_id: r.raw_obs_id, store_id: r.store_id, from: r.identity_key, fromStatus: r.status, to: toKey, toStatus: id.status });
      affectedKeys.add(r.identity_key);
      if (toKey) affectedKeys.add(toKey);
    }
  }

  console.log(`\ncategory=${category}  staged rows scanned=${scanned}  unchanged=${same}  CHANGED=${changed.length}`);
  console.log(`affected identity keys (old ∪ new): ${affectedKeys.size}`);
  const losingIdentity = changed.filter((c) => !c.to);
  console.log(`rows that lose identity entirely: ${losingIdentity.length}`);

  if (!apply) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    for (const c of changed.slice(0, 15)) console.log(`  ${c.from} [${c.fromStatus}] → ${c.to} [${c.toStatus}]`);
    await pg.end();
    return;
  }

  // ── snapshot before writing ───────────────────────────────────────────────
  mkdirSync(resolve(process.cwd(), "docs/evidence"), { recursive: true });
  const stamp = (await pg.query<{ t: string }>(`select to_char(now(),'YYYYMMDD-HH24MISS') t`)).rows[0].t;
  const snapPath = resolve(process.cwd(), `docs/evidence/restage-${category}-${stamp}.json`);
  writeFileSync(snapPath, JSON.stringify({ category, stamp, changed }, null, 1));
  console.log(`snapshot written: ${snapPath} (${changed.length} rows, restorable)`);

  // ── write the new keys ────────────────────────────────────────────────────
  // Rows that lose identity are DELETED from staging, exactly as a fresh sweep would
  // have never staged them — leaving them would keep an identity the parser refuses.
  let wrote = 0;
  for (let i = 0; i < changed.length; i += 500) {
    const slice = changed.slice(i, i + 500);
    const upserts = slice.filter((c) => c.to).map((c) => ({ category, raw_obs_id: c.raw_obs_id, identity_key: c.to, status: c.toStatus }));
    if (upserts.length) {
      const { error } = await sb.from("tps_identity_staging").upsert(upserts, { onConflict: "category,raw_obs_id" });
      if (error) throw new Error(`staging upsert: ${error.message}`);
      wrote += upserts.length;
    }
    const drops = slice.filter((c) => !c.to).map((c) => c.raw_obs_id);
    if (drops.length) {
      const { error } = await sb.from("tps_identity_staging").delete().eq("category", category).in("raw_obs_id", drops);
      if (error) throw new Error(`staging delete: ${error.message}`);
    }
  }
  console.log(`staging rows rewritten: ${wrote}  deleted: ${losingIdentity.length}`);

  // ── corroborate BOTH directions over every affected key ───────────────────
  const keys = [...affectedKeys];
  const multi = await corroboratePass(sb, def, keys);
  console.log(`corroborate (>=2 stores): considered=${multi.keysConsidered} corroborated=${multi.corroborated} canonicals=${multi.canonicalsWritten} matches=${multi.matches} prices=${multi.prices}`);
  const singles = await corroboratePass(sb, def, keys, { singleStore: true });
  console.log(`corroborate (exactly 1 store, Layer 2): resolved-single=${singles.singleStore} canonicals=${singles.canonicalsWritten}`);

  // ── canonicals this category owns whose key has NO evidence left ───────────
  //
  // THIS RAN AND SILENTLY DID NOTHING THE FIRST TIME. It passed 351 keys to a single
  // PostgREST `.in()` and destructured only `data`, so the failed request read as "no
  // orphans" and 97 TV canonicals — 10 of them still displaying a two-store comparison —
  // stayed live with zero observations behind them. A comparison with no evidence is the
  // exact thing the Constitution forbids, and the check that was supposed to catch it
  // reported success. Now: SQL, chunked, errors thrown, and the version filter that keeps
  // it from touching canonicals this category does not own.
  //
  // The `tps_version` filter is load-bearing. `model-corroboration-v1` (ADR-049) and
  // `alias-reconciliation-v1` (ADR-060) build canonicals from raw_observations WITHOUT
  // going through staging — 39 of them are legitimately comparable and legitimately have
  // no staging row. Deactivating on "no staging evidence" alone would have destroyed them.
  const orphanRows = await pg.query<{ id: string; tps_identity_key: string; store_count: number | null }>(
    `select c.id, c.tps_identity_key, p.store_count
       from canonical_products c
       left join tps_product_projection p on p.tps_identity_key = c.tps_identity_key
      where c.is_active = true
        and c.tps_version = $1
        and not exists (select 1 from tps_identity_staging s where s.identity_key = c.tps_identity_key)`,
    [def.version]
  );
  const orphans = orphanRows.rows;
  console.log(`\ncanonicals owned by ${def.version} with zero remaining evidence: ${orphans.length}` +
    ` (of which still shown as comparable: ${orphans.filter((o) => (o.store_count ?? 0) >= 2).length})`);
  if (orphans.length) {
    for (let i = 0; i < orphans.length; i += 200) {
      const ids = orphans.slice(i, i + 200).map((o) => o.id);
      const { error } = await sb.from("canonical_products")
        .update({ is_active: false, data_updated_at: new Date().toISOString() }).in("id", ids);
      if (error) throw new Error(`deactivate: ${error.message}`);
    }
    console.log(`DEACTIVATED ${orphans.length} canonicals whose identity key no longer has a single observation:`);
    for (const r of orphans.filter((o) => (o.store_count ?? 0) >= 2).slice(0, 20)) {
      console.log(`   ${r.tps_identity_key}  (was showing ${r.store_count} stores)`);
    }
  }

  try { await lockClient?.end(); } catch { /* ignore */ }
  await pg.end();
  console.log("\ndone. Run `npm run tps:refresh` next — serialized, never beside the hourly chain.");
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
