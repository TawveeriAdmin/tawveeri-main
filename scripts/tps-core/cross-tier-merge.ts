// scripts/tps-core/cross-tier-merge.ts
// ─────────────────────────────────────────────────────────────────────────────
// CROSS-TIER IDENTITY MERGE, UNDER THE PROTECTED TRUST POLICY (ADR-176)
//
// THE DEFECT (CHECKPOINT #49). Two stores can carry the identical commercial variant
// and still never compare, because they land on different IDENTITY TIERS: one keys
// `brand|MODEL:<mpn>`, the other `brand|<size>|<res>|<panel>|<hz>`. Corroboration groups
// on the key, so a model-keyed and a spec-keyed observation of the SAME product can
// never meet. #50 measured 157 genuine bridges and proved ADR-060's clean-create rule
// can convert ZERO of them: every one requires merging classes that both already own
// observations, which ADR-060 deliberately refuses.
//
// THE POLICY THAT MAKES IT SAFE (ADR-176, founder). A merge is permitted ONLY when the
// model number appears **literally in the raw name of BOTH sides**. Never inferred, never
// derived from similarity, never probabilistic. If the founder's rule makes the yield far
// smaller than the estimates, the smaller number is the correct one.
//
// SO THIS IS NOT A MATCHER. It is a literal-string test, run in both directions:
//   side A — some observation under `brand|MODEL:<mpn>` states <mpn> in its own raw name
//   side B — the spec-keyed observation states the SAME <mpn> in its own raw name
// plus the guards that stop a literal match from being the wrong literal:
//   · standalone TOKEN, never a substring (`75U7Q` must not match inside `75U7QPRO`)
//   · no longer model-shaped token in either name starts with it (the ADR-177 prefix test)
//   · the next word is not a variant word (PRO/PLUS/MAX/ULTRA/EVO/LITE)
//   · same category, same canonical brand
//
// DRY BY DEFAULT. `--apply` writes, holds the ADR-099 lane lock, and snapshots first.
// Usage: npx tsx scripts/tps-core/cross-tier-merge.ts [category ...] [--apply]
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
import { isUsableModelIdentity } from "../../src/lib/identity/store-identifiers";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toPoolerDbUrl } = require("./pooler-url.js") as { toPoolerDbUrl: (raw: string) => string };

const LANE_KEY = 814_8148;
const VARIANT_WORDS = new Set(["PRO", "PLUS", "MAX", "ULTRA", "EVO", "LITE"]);
const MODEL_TOKEN = /^[A-Za-z0-9][A-Za-z0-9\-/._]{3,23}$/;

const tokens = (s: string) =>
  s.toUpperCase().split(/[\s،,;:()[\]{}"'؛|–—]+/).map((t) => t.replace(/[.,،؛:]+$/, "")).filter(Boolean);

/**
 * ADR-176's test, as a function. True only when `mpn` stands in `name` as its own token,
 * is not the head of a longer model-shaped token, and is not followed by a variant word.
 */
function statesModelLiterally(name: string, mpn: string): boolean {
  const ws = tokens(name);
  const at = ws.indexOf(mpn);
  if (at === -1) return false;
  if (ws.some((w) => w.length > mpn.length && MODEL_TOKEN.test(w) && w.startsWith(mpn))) return false;
  if (VARIANT_WORDS.has(ws[at + 1] ?? "")) return false;
  return true;
}

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const apply = process.argv.includes("--apply");
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const cats = Object.values(CATEGORY_DEFS).filter((d) => !only.length || only.includes(d.category));

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  let lockClient: Client | null = null;
  if (apply) {
    lockClient = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
    await lockClient.connect();
    const got = (await lockClient.query<{ ok: boolean }>(`select pg_try_advisory_lock($1) ok`, [LANE_KEY])).rows[0].ok;
    if (!got) { console.error("REFUSING: normalization lane busy (ADR-099)."); await lockClient.end(); await pg.end(); process.exit(2); }
    console.log("lane lock acquired");
  }

  type Row = { raw_obs_id: number; store_id: number | null; category: string; identity_key: string; status: string; nm: string };
  const allMerges: { category: string; raw_obs_id: number; store_id: number | null; from: string; to: string; mpn: string }[] = [];

  for (const def of cats) {
    const rows: Row[] = [];
    let cursor = -1;
    for (;;) {
      const page = await pg.query<Row>(
        `select s.raw_obs_id, s.store_id, s.category, s.identity_key, s.status,
                coalesce(o.payload->>'nameAr', o.payload->>'name_ar', o.payload->>'name', o.raw_name, '') || ' ' ||
                coalesce(o.payload->>'nameEn', o.payload->>'name_en', o.payload->>'title', '') nm
         from tps_identity_staging s join raw_observations o on o.id = s.raw_obs_id
         where s.category = $1 and s.raw_obs_id > $2 order by s.raw_obs_id asc limit 5000`,
        [def.category, cursor]
      );
      if (!page.rows.length) break;
      rows.push(...page.rows);
      cursor = Number(page.rows[page.rows.length - 1].raw_obs_id);
    }
    if (!rows.length) continue;

    // ── side A: MODEL: keys whose OWN observations state the mpn literally ────
    const modelKeys = new Map<string, { brand: string; mpn: string; stores: Set<number>; literal: boolean }>();
    for (const r of rows) {
      const [brand, tail] = r.identity_key.split("|");
      if (!tail?.startsWith("MODEL:")) continue;
      const mpn = tail.slice(6).toUpperCase();
      // A merge amplifies a bad key across every listing it touches, so the TARGET is
      // re-validated against the authority rather than trusted because it is already in
      // staging. `dell|MODEL:DDR5/512` was written before that guard existed and the dry
      // run proposed folding 489 observations into it.
      if (!isUsableModelIdentity(mpn)) continue;
      const e = modelKeys.get(r.identity_key) ?? { brand, mpn, stores: new Set<number>(), literal: false };
      modelKeys.set(r.identity_key, e);
      if (r.store_id != null) e.stores.add(r.store_id);
      if (!e.literal && statesModelLiterally(r.nm, mpn)) e.literal = true;
    }
    const eligible = [...modelKeys].filter(([, e]) => e.literal);

    // ── side B: spec-keyed observations stating the SAME mpn literally ───────
    const byBrand = new Map<string, { key: string; mpn: string }[]>();
    for (const [key, e] of eligible) {
      if (!byBrand.has(e.brand)) byBrand.set(e.brand, []);
      byBrand.get(e.brand)!.push({ key, mpn: e.mpn });
    }
    const merges: typeof allMerges = [];
    for (const r of rows) {
      const [brand, tail] = r.identity_key.split("|");
      if (tail?.startsWith("MODEL:")) continue;          // already model-keyed
      const candidates = byBrand.get(brand);
      if (!candidates) continue;
      // THE DIMENSION GUARD — ADR-176's own example, enforced.
      //
      // The dry run proposed `samsung|85|4k|led|60 → samsung|MODEL:DU7000`. DU7000 is a
      // SERIES, not a model: Samsung ships it at 43", 55", 75" and 85" and the string
      // encodes none of them. Merging into it is exactly the founder's `QN90D-55` vs
      // `QN90D-65` case — a shopper buys the wrong size believing they found a better
      // price. A literal match on a string that cannot express the distinguishing
      // dimension is not evidence that two listings are the same product.
      //
      // So where the spec key LEADS with a numeric discriminator (TV/monitor screen size,
      // `brand|85|…`), that number must also appear inside the model string. `UHD50SLED`
      // for a `nikai|50|…` listing passes; `DU7000` for an `…|85|…` listing does not.
      const discriminator = r.identity_key.split("|")[1];
      const numericDim = /^\d+$/.test(discriminator ?? "") ? discriminator : null;
      const hits = candidates.filter((c) =>
        statesModelLiterally(r.nm, c.mpn) &&
        (!numericDim || (c.mpn.match(/\d+/g) ?? []).includes(numericDim))
      );
      // Two different model numbers in one name is not a literal identity — skip it
      // rather than pick one. Unknown beats incorrect.
      if (hits.length !== 1) continue;
      merges.push({ category: def.category, raw_obs_id: r.raw_obs_id, store_id: r.store_id, from: r.identity_key, to: hits[0].key, mpn: hits[0].mpn });
    }

    // ── what it would do to COMPARISONS, created and destroyed separately ────
    const storesOf = (key: string, exclude: Set<number>) => {
      const s = new Set<number>();
      for (const r of rows) {
        if (r.identity_key !== key || r.status !== "valid") continue;
        if (exclude.has(r.raw_obs_id)) continue;
        if (r.store_id != null) s.add(r.store_id);
      }
      return s;
    };
    const moving = new Set(merges.map((m) => m.raw_obs_id));
    const touchedFrom = new Set(merges.map((m) => m.from));
    const touchedTo = new Set(merges.map((m) => m.to));
    let destroyed = 0, created = 0;
    for (const k of touchedFrom) {
      const before = storesOf(k, new Set());
      const after = storesOf(k, moving);
      if (before.size >= 2 && after.size < 2) {
        destroyed++;
        console.log(`   DESTROYS ${k}: ${before.size} stores → ${after.size}` +
          `  (members leaving: ${merges.filter((m) => m.from === k).map((m) => m.to).join(", ")})`);
      }
    }
    for (const k of touchedTo) {
      const before = storesOf(k, new Set());
      const after = new Set(before);
      for (const m of merges) if (m.to === k && m.store_id != null) after.add(m.store_id);
      if (before.size < 2 && after.size >= 2) created++;
    }

    console.log(`\n── ${def.category}`);
    console.log(`   staged rows                     : ${rows.length}`);
    console.log(`   MODEL: keys                     : ${modelKeys.size}  (stating their own mpn literally: ${eligible.length})`);
    console.log(`   spec-keyed observations merged  : ${merges.length}`);
    console.log(`   comparisons CREATED             : ${created}`);
    console.log(`   comparisons DESTROYED           : ${destroyed}`);
    for (const m of merges.slice(0, 6)) console.log(`      ${m.from}  →  ${m.to}`);
    allMerges.push(...merges);
  }

  console.log(`\nTOTAL observations that would be re-keyed: ${allMerges.length}`);
  if (!apply) { console.log("DRY RUN — nothing written. Re-run with --apply."); await pg.end(); return; }
  if (!allMerges.length) { console.log("nothing to do."); try { await lockClient?.end(); } catch { /* */ } await pg.end(); return; }

  mkdirSync(resolve(process.cwd(), "docs/evidence"), { recursive: true });
  const stamp = (await pg.query<{ t: string }>(`select to_char(now(),'YYYYMMDD-HH24MISS') t`)).rows[0].t;
  const snap = resolve(process.cwd(), `docs/evidence/cross-tier-${stamp}.json`);
  writeFileSync(snap, JSON.stringify({ stamp, merges: allMerges }, null, 1));
  console.log(`snapshot: ${snap}`);

  for (let i = 0; i < allMerges.length; i += 500) {
    const slice = allMerges.slice(i, i + 500);
    const { error } = await sb.from("tps_identity_staging")
      .upsert(slice.map((m) => ({ category: m.category, raw_obs_id: m.raw_obs_id, identity_key: m.to, status: "valid" })), { onConflict: "category,raw_obs_id" });
    if (error) throw new Error(`staging upsert: ${error.message}`);
  }
  console.log(`re-keyed ${allMerges.length} observations`);

  for (const def of cats) {
    const keys = [...new Set(allMerges.filter((m) => m.category === def.category).flatMap((m) => [m.from, m.to]))];
    if (!keys.length) continue;
    const multi = await corroboratePass(sb, def, keys);
    const single = await corroboratePass(sb, def, keys, { singleStore: true });
    console.log(`${def.category}: corroborated=${multi.corroborated} canonicals=${multi.canonicalsWritten} | resolved-single=${single.singleStore}`);
    const orphans = await pg.query<{ id: string }>(
      `select c.id from canonical_products c where c.is_active and c.tps_version = $1
         and not exists (select 1 from tps_identity_staging s where s.identity_key = c.tps_identity_key)`, [def.version]);
    if (orphans.rows.length) {
      for (let i = 0; i < orphans.rows.length; i += 200) {
        const { error } = await sb.from("canonical_products").update({ is_active: false, data_updated_at: new Date().toISOString() })
          .in("id", orphans.rows.slice(i, i + 200).map((o) => o.id));
        if (error) throw new Error(`deactivate: ${error.message}`);
      }
      console.log(`${def.category}: deactivated ${orphans.rows.length} canonicals left with no evidence`);
    }
  }

  try { await lockClient?.end(); } catch { /* ignore */ }
  await pg.end();
  console.log("\ndone. Run `npm run tps:refresh` next — serialized.");
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
