// scripts/tps-core/backfill-model-numbers.ts
// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL MODEL-NUMBER BACKFILL (ADR-182) — metadata only, never identity.
//
// WHY. Overlap-seeded discovery (ADR-146) can only aim at a target whose MODEL NUMBER we
// hold, because the relevance gate requires that model to appear literally in the retailer's
// hit (ADR-176). Measured 2026-08-03: only 1,263 of 7,807 active canonicals carry one, so
// noon had 522 eligible targets out of 2,315 single-store candidates. The model was readable
// from evidence we already held for 2,516 more of them — we simply never stored it.
//
// WHAT THIS IS NOT. It does NOT touch `tps_identity_key` and cannot change how anything
// corroborates. Rescuing identity with a model number is a different, riskier change
// (ADR-175 measured it turning 23 corroborations into 18) and is deliberately not done here.
// This writes ONE metadata column so the seeding lever can aim.
//
// THE UNIQUE INDEX IS THE SAFETY GATE, and it is load-bearing:
//   canonical_products_brand_model_number_idx UNIQUE (brand, model_number) WHERE NOT NULL
// The schema already treats brand+model as an identity. So a proposed value that would
// collide with another canonical is NEVER written — a collision means two canonicals are
// the same product, which is a MERGE decision under the Protected Trust Policy, not a
// backfill. Those are reported, counted, and left alone.
//
// FILL-ONLY · idempotent · dry by default · snapshots before writing.
// Usage: npx tsx scripts/tps-core/backfill-model-numbers.ts [--apply]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { writeFileSync, mkdirSync } from "fs";
import { Client } from "pg";
import { toPoolerDbUrl } from "./pooler-url";
import { assertFingerprint } from "./tps-batch";
import { extractManufacturerModel, extractManufacturerModelFromName } from "../../src/lib/identity/store-identifiers";

const asS = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const apply = process.argv.includes("--apply");
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  const before = await pg.query<{ n: string; with_model: string }>(
    `select count(*) n, count(*) filter (where model_number is not null and length(model_number) >= 5) with_model
     from canonical_products where is_active`);
  console.log(`BEFORE: ${before.rows[0].with_model}/${before.rows[0].n} active canonicals carry a usable model number`);

  // Proposed value per canonical, read from its own linked observations (evidence-cited).
  const { rows } = await pg.query<{ cid: string; brand: string | null; raw_name: string | null; payload: Record<string, unknown> | null }>(`
    select cp.id::text cid, cp.brand, r.raw_name, r.payload
    from canonical_products cp
    join tps_identity_staging s on s.identity_key = cp.tps_identity_key
    join raw_observations r on r.id = s.raw_obs_id
    where cp.is_active and (cp.model_number is null or length(cp.model_number) < 5)`);

  const proposed = new Map<string, { model: string; brand: string | null }>();
  for (const r of rows) {
    if (proposed.has(r.cid)) continue;
    const p = r.payload ?? {};
    const nameAr = asS(p.nameAr) ?? asS(p.name_ar) ?? asS(p.name) ?? asS(r.raw_name) ?? "";
    const nameEn = asS(p.nameEn) ?? asS(p.name_en) ?? asS(p.title) ?? "";
    const m = extractManufacturerModel(p) ?? extractManufacturerModelFromName(`${nameAr} ${nameEn}`);
    if (m) proposed.set(r.cid, { model: m, brand: r.brand });
  }
  console.log(`proposed values read from evidence: ${proposed.size}`);

  // ── COLLISION DETECTION — against existing rows AND within the proposal itself ──
  const taken = new Map<string, string>();   // "brand|MODEL" → canonical id already holding it
  const existing = await pg.query<{ id: string; brand: string | null; model_number: string }>(
    `select id::text, brand, model_number from canonical_products where model_number is not null`);
  for (const e of existing.rows) taken.set(`${(e.brand ?? "").toLowerCase()}|${e.model_number.toUpperCase()}`, e.id);

  const byPair = new Map<string, string[]>();
  for (const [cid, v] of proposed) {
    const k = `${(v.brand ?? "").toLowerCase()}|${v.model.toUpperCase()}`;
    (byPair.get(k) ?? byPair.set(k, []).get(k)!).push(cid);
  }

  const safe: { cid: string; model: string }[] = [];
  const collidesExisting: string[] = [];
  const collidesWithinProposal: string[] = [];
  for (const [pair, cids] of byPair) {
    if (taken.has(pair)) { collidesExisting.push(`${pair} ↔ ${taken.get(pair)}`); continue; }
    if (cids.length > 1) { collidesWithinProposal.push(`${pair} × ${cids.length}`); continue; }
    safe.push({ cid: cids[0], model: proposed.get(cids[0])!.model });
  }

  console.log(`  SAFE to write                       : ${safe.length}`);
  console.log(`  collides with an existing canonical : ${collidesExisting.length}   ← same brand+model already held elsewhere`);
  console.log(`  two proposals share one brand+model : ${collidesWithinProposal.length}   ← duplicate canonicals of one product`);
  console.log(`\nA COLLISION IS A MERGE CANDIDATE, NOT A BACKFILL. Under the unique index`);
  console.log(`(brand, model_number) these are the SAME product held as separate canonicals.`);
  console.log(`Merging them is a Protected Trust decision (ADR-176) and is NOT done here.`);
  for (const s of [...collidesExisting.slice(0, 5), ...collidesWithinProposal.slice(0, 5)]) console.log(`   ${s}`);

  if (!apply) {
    console.log(`\n[dry] nothing written. Re-run with --apply to fill ${safe.length}.`);
    await pg.end();
    return;
  }

  mkdirSync(resolve(process.cwd(), "docs/evidence"), { recursive: true });
  const stamp = (await pg.query<{ t: string }>(`select to_char(now(),'YYYYMMDD-HH24MISS') t`)).rows[0].t;
  const snap = resolve(process.cwd(), `docs/evidence/model-backfill-${stamp}.json`);
  writeFileSync(snap, JSON.stringify({ stamp, filled: safe, collidesExisting, collidesWithinProposal }, null, 1));
  console.log(`snapshot: ${snap}`);

  let wrote = 0;
  for (let i = 0; i < safe.length; i += 200) {
    const chunk = safe.slice(i, i + 200);
    // Fill-only: the WHERE clause re-asserts emptiness so a concurrent writer cannot be
    // overwritten, and makes a re-run a no-op.
    const res = await pg.query(
      `update canonical_products c set model_number = v.model, data_updated_at = now()
       from (select unnest($1::uuid[]) id, unnest($2::text[]) model) v
       where c.id = v.id and (c.model_number is null or length(c.model_number) < 5)`,
      [chunk.map((x) => x.cid), chunk.map((x) => x.model)],
    );
    wrote += res.rowCount ?? 0;
  }
  const after = await pg.query<{ with_model: string; n: string }>(
    `select count(*) n, count(*) filter (where model_number is not null and length(model_number) >= 5) with_model
     from canonical_products where is_active`);
  console.log(`\n✓ filled ${wrote}`);
  console.log(`AFTER: ${after.rows[0].with_model}/${after.rows[0].n} active canonicals carry a usable model number`);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
