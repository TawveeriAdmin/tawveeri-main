// scripts/tps-core/recorroborate-stuck-keys.ts
//
// ONE-TIME (repeatable, idempotent) RECOVERY for identity keys stuck in
// `tps_identity_staging` that never reached `canonical_products`.
//
// ROOT CAUSE (Samsung KSA global closure mission, 2026-09-12, proven via the live
// production debug endpoint GET /api/debug/scheduler): the hourly "normalize" step
// (`normalize-incremental.ts` -> `runSweepUnit` -> `corroboratePass`) only ever
// corroborates identity keys TOUCHED by that pass's own freshly-normalized
// observations (`progressive-engine.ts`'s `touched` set). `corroboratePass` had no
// guard against `canonical_products_brand_model_number_idx` (a GLOBAL unique index
// on (category, brand, model_number)) — a defect class already fixed once for the
// single-store writer (`write-resolved-single.ts`, ADR-241-class) but never applied
// to this, the PRIMARY multi-store path the hourly chain actually runs. The result:
// `write_ac_batch(microwave): duplicate key value violates ... brand_model_number_idx`
// FATALed the "normalize" step on repeated hourly runs, aborting EVERY downstream
// step (resolved-single, storefront-link, projection, presentation, search, edges)
// for the WHOLE hourly chain, not just microwave — measured system-wide backlog:
// ~1,233 distinct identity keys across 18 categories sitting in staging with no
// canonical row, tv/monitor/vacuum the largest (325/209/131).
//
// The guard is now fixed in `progressive-engine.ts` (`takenPair`), so future hourly
// runs recover on their own FOR NEWLY-TOUCHED keys. This script is the one-time catch
// -up for keys that are ALREADY stuck and will never be "touched" again on their own
// (no new observation is coming for most of them) — it re-drives corroboration over
// the FULL accumulated staging per category, exactly the same call `runSweepUnit`
// makes per-pass, just scoped to what is already staged rather than what is new.
//
// SAFE BY CONSTRUCTION: corroboratePass is idempotent (upsert-based) and every key
// that already has a canonical row is filtered out up front — re-running this any
// number of times, on any subset of categories, changes nothing already correct.
// Bounded: chunks of 150 keys per write_ac_batch RPC (same bound the hourly chain
// itself uses). Resumable: safe to re-run after any partial failure — already-
// written keys are simply skipped on the next pass via the same staging/canonical
// diff query.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { CATEGORY_DEFS } from "./category-registry";
import { corroboratePass } from "./progressive-engine";
import { assertFingerprint } from "./tps-batch";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toPoolerDbUrl } = require("./pooler-url.js") as { toPoolerDbUrl: (raw: string) => string };

const KEY_CHUNK = 150;

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const onlyCategory = (() => {
    const i = process.argv.indexOf("--category");
    return i >= 0 ? process.argv[i + 1] : null;
  })();
  const dry = process.argv.includes("--dry");

  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { rows } = await pg.query(
    `select s.category, s.identity_key
       from (select distinct category, identity_key from tps_identity_staging where identity_key is not null) s
       left join canonical_products cp on cp.tps_identity_key = s.identity_key
      where cp.id is null`,
  );
  await pg.end();

  const keysByCategory = new Map<string, string[]>();
  for (const r of rows as { category: string; identity_key: string }[]) {
    if (onlyCategory && r.category !== onlyCategory) continue;
    if (!keysByCategory.has(r.category)) keysByCategory.set(r.category, []);
    keysByCategory.get(r.category)!.push(r.identity_key);
  }

  console.log(`${dry ? "[DRY] " : ""}stuck keys found: ${[...keysByCategory.values()].reduce((a, v) => a + v.length, 0)} across ${keysByCategory.size} categor${keysByCategory.size === 1 ? "y" : "ies"}`);

  const summary: Record<string, unknown> = {};
  for (const [category, keys] of keysByCategory) {
    const def = CATEGORY_DEFS[category as keyof typeof CATEGORY_DEFS];
    if (!def) { console.log(`  ${category}: SKIP — no CategoryDef registered`); continue; }
    let corroborated = 0, single = 0, written = 0, pairDeferred = 0, errors = 0;
    for (let i = 0; i < keys.length; i += KEY_CHUNK) {
      const chunk = keys.slice(i, i + KEY_CHUNK);
      try {
        const multi = await corroboratePass(sb, def, chunk, { dry });
        const singles = await corroboratePass(sb, def, chunk, { dry, singleStore: true });
        corroborated += multi.corroborated; single += singles.singleStore;
        written += multi.canonicalsWritten + singles.canonicalsWritten;
        pairDeferred += multi.pairDeferred + singles.pairDeferred;
      } catch (e) {
        errors++;
        console.error(`  ${category} chunk ${i}-${i + chunk.length}: ${e instanceof Error ? e.message : e}`);
      }
    }
    summary[category] = { keys: keys.length, corroborated, singleStore: single, written, pairDeferred, errors };
    console.log(`  ${category}: keys=${keys.length} corroborated=${corroborated} singleStore=${single} written=${written} pairDeferred=${pairDeferred}${errors ? ` ERRORS=${errors}` : ""}`);
  }
  console.table(summary);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
