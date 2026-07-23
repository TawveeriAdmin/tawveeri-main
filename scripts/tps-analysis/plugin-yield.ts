// scripts/tps-analysis/plugin-yield.ts
// ─────────────────────────────────────────────────────────────────────────────
// CANDIDATE-PLUGIN YIELD (ADR-060 follow-up)
//
// The normalization gap is 77% "no category plugin claims the listing", so the
// lever is category COVERAGE. Before registering a plugin in CATEGORY_DEFS —
// which changes production identity — measure what it would actually yield:
// how many Saudi listings it claims, how many get a valid identity, how many
// corroborate across stores, and how many would COLLIDE with canonicals that
// already exist (the duplicate-card risk).
//
// Strictly READ-ONLY.
// Usage: npx tsx scripts/tps-analysis/plugin-yield.ts mobile
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import type { CategoryPlugin } from "../tps-core/types";
import { mobilePlugin } from "../tps-plugins/mobile";
import { resolveListingIdentity, isSaudiMarket } from "../../src/lib/identity/merchant-listing-identity";

const CANDIDATES: Record<string, CategoryPlugin> = { mobile: mobilePlugin };
const STORE_SLUG: Record<number, string> = { 1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 8: "swsg" };
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

(async () => {
  const name = process.argv[2];
  const plugin = CANDIDATES[name];
  if (!plugin) throw new Error(`unknown candidate '${name}'; known: ${Object.keys(CANDIDATES).join(", ")}`);
  const url = process.env.SUPABASE_DB_URL!;
  if (!/db\.vyceqrzttspyycdpojtn\.supabase\.co/.test(url)) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  const seen = new Set<string>();
  const keyStores = new Map<string, Set<number>>();
  const perStore = new Map<string, number>();
  const reasons = new Map<string, number>();
  let claimed = 0, valid = 0, invalid = 0, cursor = 0;

  for (;;) {
    const page = await pg.query(
      `select id, store_id, raw_name, payload,
              coalesce(payload->>'productUrl', payload->>'url', payload->>'product_url', raw_url) u
       from raw_observations where id > $1 order by id asc limit 20000`, [cursor]);
    if (!page.rows.length) break;
    for (const r of page.rows) {
      cursor = Number(r.id);
      const store = Number(r.store_id);
      const ident = resolveListingIdentity(store, r.u as string | null, STORE_SLUG[store]);
      if (!ident.key || !isSaudiMarket(ident.market) || seen.has(ident.key)) continue;
      seen.add(ident.key);

      const p = (r.payload ?? {}) as Record<string, unknown>;
      const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(r.raw_name) ?? "";
      const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
      const brand = asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null;
      if (!plugin.detect(nameAr, nameEn)) continue;
      claimed++;
      perStore.set(STORE_SLUG[store] ?? String(store), (perStore.get(STORE_SLUG[store] ?? String(store)) ?? 0) + 1);

      // `CategoryPlugin.normalize` is declared with 3 params; the payload-aware
      // 4th argument is the registry's `CategoryDef.normalize` overload. Call the
      // widened signature explicitly so payload fields are still used.
      const normalizeWithPayload = plugin.normalize as (
        a: string, b: string, c: string | null, d?: Record<string, unknown>
      ) => ReturnType<CategoryPlugin["normalize"]>;
      const norm = normalizeWithPayload(nameAr, nameEn, brand, p);
      const id = plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
      if (id.status === "invalid" || !id.key) {
        invalid++;
        reasons.set(id.reason ?? "invalid", (reasons.get(id.reason ?? "invalid") ?? 0) + 1);
        continue;
      }
      valid++;
      (keyStores.get(id.key) ?? keyStores.set(id.key, new Set()).get(id.key)!).add(store);
    }
  }

  const keys = [...keyStores.entries()];
  const multi = keys.filter(([, s]) => s.size >= 2);
  // Would any produced key collide with a canonical that already exists?
  const { rows: existing } = await pg.query(
    `select tps_identity_key from canonical_products where is_active and tps_identity_key = any($1)`,
    [keys.map(([k]) => k)]
  );
  const taken = new Set(existing.map((r) => r.tps_identity_key));
  const freshMulti = multi.filter(([k]) => !taken.has(k));

  console.log(`\n╔══ CANDIDATE PLUGIN YIELD: ${name} ══════════════════════`);
  console.log(`   Saudi listings scanned  : ${seen.size}`);
  console.log(`   CLAIMED by this plugin  : ${claimed}`);
  console.log(`   → valid identity        : ${valid}   (${((100 * valid) / Math.max(1, claimed)).toFixed(1)}% of claimed)`);
  console.log(`   → rejected              : ${invalid}`);
  console.log(`   distinct identity keys  : ${keys.length}`);
  console.log(`   CORROBORATED (>=2 store): ${multi.length}`);
  console.log(`   → already have a canonical: ${multi.length - freshMulti.length}  (upsert, no duplicate)`);
  console.log(`   → NEW comparisons        : ${freshMulti.length}`);
  console.log(`\n   claimed per store: ${[...perStore.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}=${n}`).join("  ")}`);
  console.log(`\n   top rejection reasons:`);
  for (const [k, v] of [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`     ${String(v).padStart(5)}  ${k}`);
  console.log(`\n   sample NEW cross-store comparisons:`);
  for (const [k, s] of freshMulti.slice(0, 12)) console.log(`     [${[...s].sort().join(",")}]  ${k}`);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
