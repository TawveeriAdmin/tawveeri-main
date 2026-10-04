// scripts/tps-core/build-identity-signals.ts — ADR-403 identity gate (2026-10-04).
// ─────────────────────────────────────────────────────────────────────────────
// Computes the per-listing identity verdicts (`tps_offer_identity_signals`) that every surface
// grouping listings reads as an exclusion. Same `resolveGroup` the compare page calls, same inputs
// (listing title + the source-declared manufacturer model + the key's own MODEL code), so the
// projection / search / UCP / agents cannot disagree with the compare page.
//
// FLAG-DRIVEN, DEFAULT OFF. A category is processed only when `identityGateEnabled(category)`
// (TPS_IDENTITY_GATE and/or TPS_IDENTITY_V2). With NO category enabled the job performs no DDL and
// reads nothing but `to_regclass` — and, if the table exists from an earlier enablement, DELETES
// every row: turning the flag off IS the read-path rollback, and it takes effect on the next
// chain run (readers also stop consulting the table the moment the flag is unset, so the effect is
// immediate there).
//
// Fully derived and idempotent: each run recomputes every enabled category and deletes rows that no
// longer hold. Writes are one transaction. A runaway verdict share aborts without writing.
//
//   npx tsx scripts/tps-core/build-identity-signals.ts [--dry] [--category=tv] [--max-share=0.7]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { TPS_STORES } from "./category-registry";
import { toPoolerDbUrl } from "./pooler-url";
import { identityGateEnabled } from "./identity-flags";
import { extractManufacturerModel } from "../../src/lib/identity/store-identifiers";
import { resolveApprovedSlug } from "../../src/lib/retailers/approved-retailers";
import { computeIdentitySignals, IDENTITY_RULES_VERSION, type IdentitySignal, type SignalCanonical } from "../../src/lib/identity/identity-signals";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const ONLY = argv.find((a) => a.startsWith("--category="))?.split("=")[1] ?? null;
const EXAMPLES_N = Number(argv.find((a) => a.startsWith("--examples"))?.split("=")[1] ?? (argv.includes("--examples") ? 8 : 0));
const EXAMPLES = EXAMPLES_N > 0;
const EX_VERDICT = argv.find((a) => a.startsWith("--verdict="))?.split("=")[1] ?? null;
const MAX_SHARE = Number(argv.find((a) => a.startsWith("--max-share="))?.split("=")[1] ?? 0.7);
const STORE_NAME = new Map<number, string>(TPS_STORES.map((s) => [s.id, s.name]));

function assertTarget(url: string) {
  const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
  const prod = url.includes("vyceqrzttspyycdpojtn") && !url.includes("ffpsjjazsluolysgithg");
  if (!local && !prod) throw new Error("refusing: neither production nor a local rehearsal database");
}

export interface RawListing { cid: string; storeId: number; title: string; rawId: number | null }

/** Pure grouping step, exported for tests: raw listing rows → canonicals with declared models resolved. */
export function assembleCanonicals(
  canonicals: { id: string; key: string | null; category: string }[],
  listings: RawListing[],
  modelByRawId: Map<number, string>,
): SignalCanonical[] {
  const byId = new Map<string, SignalCanonical>(canonicals.map((c) => [c.id, { id: c.id, key: c.key, category: c.category, listings: [] }]));
  for (const l of listings) byId.get(l.cid)?.listings.push({ storeId: l.storeId, title: l.title ?? "", model: l.rawId != null ? modelByRawId.get(l.rawId) ?? null : null });
  return [...byId.values()];
}

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL missing");
  assertTarget(url);
  const t0 = Date.now();
  const pg = new Client({ connectionString: /@(localhost|127\.0\.0\.1)(:|\/)/.test(url) ? url : toPoolerDbUrl(url), ssl: /@(localhost|127\.0\.0\.1)(:|\/)/.test(url) ? undefined : { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");
  try {
    const { rows: catRows } = await pg.query<{ category: string }>("select distinct category from canonical_products where is_active and category is not null");
    const gated = catRows.map((r) => r.category).filter((c) => identityGateEnabled(c) && (!ONLY || c === ONLY)).sort();
    const exists = (await pg.query<{ t: string | null }>("select to_regclass('tps_offer_identity_signals') as t")).rows[0].t !== null;

    if (!gated.length) {
      let removed = 0;
      if (exists && !DRY) removed = (await pg.query("delete from tps_offer_identity_signals")).rowCount ?? 0;
      console.log(JSON.stringify({ job: "identity-signals", mode: DRY ? "dry" : "write", gated_categories: [], table_exists: exists, rows_removed: removed, note: "gate flags unset — no category processed", ms: Date.now() - t0 }));
      return;
    }

    if (!exists) {
      if (DRY) console.log("[identity-signals] table missing — a real run creates it (037_offer_identity_signals.sql)");
      else await pg.query(readFileSync(resolve(process.cwd(), "scripts/database/knowledge-db/037_offer_identity_signals.sql"), "utf8"));
    }

    // ── inputs ──
    const { rows: canonicals } = await pg.query<{ id: string; key: string | null; category: string }>(
      "select id::text as id, tps_identity_key as key, category from canonical_products where is_active and category = any($1::text[])", [gated]);
    const { rows: cur } = await pg.query<{ cid: string; store_id: number; title: string; raw_id: string | null }>(
      `select c.id::text as cid, co.store_id, co.name as title, co.raw_obs_id::text as raw_id
         from canonical_products c join tps_current_offers co on co.identity_key = c.tps_identity_key
        where c.is_active and c.category = any($1::text[]) and co.status = 'valid' and co.payload->>'_superseded_by_identity' is null`, [gated]);
    const { rows: superseded } = await pg.query<{ cid: string; store_id: number }>(
      `select c.id::text as cid, co.store_id from canonical_products c join tps_current_offers co on co.identity_key = c.tps_identity_key
        where c.category = any($1::text[]) and co.payload->>'_superseded_by_identity' is not null`, [gated]);
    const { rows: hist } = await pg.query<{ cid: string; store_id: number; title: string | null; raw_id: string | null }>(
      `select distinct on (ph.canonical_product_id, ph.store_id)
              ph.canonical_product_id::text as cid, ph.store_id, n.raw_name as title, (n.normalized_payload->>'_raw_id') as raw_id
         from price_history ph
         join canonical_products c on c.id = ph.canonical_product_id and c.is_active and c.category = any($1::text[])
         left join normalized_product_observations n on n.id = ph.tps_observation_id
        where ph.tps_observation_id is not null and ph.store_id is not null
        order by ph.canonical_product_id, ph.store_id, ph.observed_at desc`, [gated]);

    const have = new Set(cur.map((r) => `${r.cid}|${r.store_id}`));
    const retired = new Set(superseded.map((r) => `${r.cid}|${r.store_id}`));
    const listings: RawListing[] = [
      ...cur.map((r) => ({ cid: r.cid, storeId: Number(r.store_id), title: r.title, rawId: r.raw_id ? Number(r.raw_id) : null })),
      ...hist.filter((r) => !have.has(`${r.cid}|${r.store_id}`) && !retired.has(`${r.cid}|${r.store_id}`) && r.title)
        .map((r) => ({ cid: r.cid, storeId: Number(r.store_id), title: r.title as string, rawId: r.raw_id && /^\d+$/.test(r.raw_id) ? Number(r.raw_id) : null })),
    ];

    // Source-declared manufacturer models for exactly the raw observations those listings point at.
    const rawIds = [...new Set(listings.map((l) => l.rawId).filter((v): v is number => v != null))];
    const modelByRawId = new Map<number, string>();
    for (let i = 0; i < rawIds.length; i += 2000) {
      const { rows } = await pg.query<{ id: string; mpn: string | null; modelNumber: string | null; model_number: string | null; model: string | null }>(
        `select id::text as id, payload->>'mpn' as mpn, payload->>'modelNumber' as "modelNumber", payload->>'model_number' as model_number, payload->>'model' as model
           from raw_observations where id = any($1::bigint[])`, [rawIds.slice(i, i + 2000)]);
      for (const r of rows) { const m = extractManufacturerModel({ mpn: r.mpn, modelNumber: r.modelNumber, model_number: r.model_number, model: r.model }); if (m) modelByRawId.set(Number(r.id), m); }
    }

    // ── compute ──
    const assembled = assembleCanonicals(canonicals, listings, modelByRawId);
    const desired = new Map<string, IdentitySignal>();
    const ledger: Record<string, { canonicals: number; multi_store: number; listings_in_multi: number; review: number; reject: number }> = {};
    const reasonHist: Record<string, number> = {};
    const examples: Record<string, unknown[]> = {};
    const siblingTitles = new Map<string, string[]>();
    for (const c of assembled) {
      const L = (ledger[c.category] ??= { canonicals: 0, multi_store: 0, listings_in_multi: 0, review: 0, reject: 0 });
      L.canonicals++;
      const stores = new Set(c.listings.map((l) => l.storeId)).size;
      if (stores < 2) continue;
      L.multi_store++; L.listings_in_multi += stores;
      siblingTitles.set(c.id, c.listings.map((l) => `${l.storeId}: ${l.title.slice(0, 70)}`));
      for (const s of computeIdentitySignals(c)) {
        if (EXAMPLES && (!EX_VERDICT || s.verdict === EX_VERDICT)) { const ex = (examples[c.category] ??= []); if (ex.length < EXAMPLES_N) ex.push({ verdict: s.verdict, store: s.store_id, reasons: s.reasons, listing: s.listing_name.slice(0, 80), group: siblingTitles.get(c.id), key: c.key }); }
        desired.set(`${s.canonical_product_id}|${s.store_id}`, s);
        L[s.verdict]++;
        for (const r of s.reasons) { const k = r.replace(/^vs [^:]+: /, "").split(":")[0]; reasonHist[k] = (reasonHist[k] ?? 0) + 1; }
      }
    }
    for (const [cat, L] of Object.entries(ledger)) {
      const share = L.listings_in_multi ? (L.review + L.reject) / L.listings_in_multi : 0;
      if (L.listings_in_multi >= 20 && share > MAX_SHARE) throw new Error(`refusing to write: ${cat} verdict share ${(share * 100).toFixed(1)}% exceeds ${(MAX_SHARE * 100).toFixed(0)}% — verifier or inputs look wrong`);
    }

    // ── write (one transaction) ──
    let upserted = 0, deleted = 0;
    if (!DRY) {
      const { rows: existing } = await pg.query<{ canonical_product_id: string; store_id: number; verdict: string; reasons: string[]; listing_name: string | null; rules_version: string; category: string }>(
        "select canonical_product_id::text as canonical_product_id, store_id, verdict, reasons, listing_name, rules_version, category from tps_offer_identity_signals");
      const existingByKey = new Map(existing.map((r) => [`${r.canonical_product_id}|${r.store_id}`, r]));
      const toDelete = existing.filter((r) => !gated.includes(r.category) || (!desired.has(`${r.canonical_product_id}|${r.store_id}`)));
      const toUpsert = [...desired.values()].filter((s) => {
        const e = existingByKey.get(`${s.canonical_product_id}|${s.store_id}`);
        return !e || e.verdict !== s.verdict || e.listing_name !== s.listing_name || e.rules_version !== IDENTITY_RULES_VERSION || e.reasons.join("\u0001") !== s.reasons.join("\u0001");
      });
      await pg.query("begin");
      try {
        for (let i = 0; i < toDelete.length; i += 1000) {
          const chunk = toDelete.slice(i, i + 1000);
          await pg.query("delete from tps_offer_identity_signals where (canonical_product_id, store_id) in (select * from unnest($1::uuid[], $2::int[]))", [chunk.map((r) => r.canonical_product_id), chunk.map((r) => r.store_id)]);
        }
        deleted = toDelete.length;
        for (let i = 0; i < toUpsert.length; i += 500) {
          const chunk = toUpsert.slice(i, i + 500); const params: unknown[] = [];
          const values = chunk.map((s, j) => {
            const b = j * 9; params.push(s.canonical_product_id, s.store_id, resolveApprovedSlug(s.store_id), STORE_NAME.get(s.store_id) ?? String(s.store_id), s.category, s.verdict, s.reasons, s.listing_name, IDENTITY_RULES_VERSION);
            return `($${b + 1}::uuid,$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7}::text[],$${b + 8},$${b + 9},now())`;
          });
          await pg.query(
            `insert into tps_offer_identity_signals (canonical_product_id, store_id, store_slug, store_display_name, category, verdict, reasons, listing_name, rules_version, computed_at)
             values ${values.join(",")}
             on conflict (canonical_product_id, store_id) do update set store_slug = excluded.store_slug, store_display_name = excluded.store_display_name,
               category = excluded.category, verdict = excluded.verdict, reasons = excluded.reasons, listing_name = excluded.listing_name,
               rules_version = excluded.rules_version, computed_at = now()`, params);
        }
        upserted = toUpsert.length;
        await pg.query("commit");
      } catch (e) { await pg.query("rollback"); throw e; }
    }
    console.log(JSON.stringify({ job: "identity-signals", mode: DRY ? "dry" : "write", rules_version: IDENTITY_RULES_VERSION, gated_categories: gated, signals_desired: desired.size, upserted, deleted, by_category: ledger, reasons: reasonHist, ...(EXAMPLES ? { examples } : {}), ms: Date.now() - t0 }));
  } finally {
    await pg.end();
  }
}

const executedDirectly = require.main === module || process.argv[1]?.replace(/\\/g, "/").endsWith("build-identity-signals.ts");
if (executedDirectly) main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
