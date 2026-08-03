// scripts/tps-core/remediate-locale-names.ts
// ADR-185 — repair display names that are not in the language of the surface showing them.
//
// Measured on production before this ran: 463 of 5,366 projected products (135 of them
// comparable) carried an Arabic name with no Arabic character in it. Every registered
// category plugin composes a real Arabic name except mobile-v1 and smartwatch-v1, plus the
// model/alias canonical writers which set name_ar = name_en = one display string.
//
// TWO repair paths, and neither invents anything:
//   COMPOSED  — mobile-v1 / smartwatch-v1 recomputed from their UNCHANGED tps_identity_key
//               through `arabic-naming.ts`, exactly as remediate-ac-names.ts did for AC.
//   OBSERVED  — model-corroboration-v1 / alias-reconciliation-v1 take the merchant's OWN
//               published Arabic title from an observation already matched to that
//               canonical. The most honest Arabic name available is the one the merchant
//               printed; we do not compose over it.
//
// canonical_products and tps_product_projection are both DERIVED layers, so this is a
// display-name rewrite only: tps_identity_key, prices, offers and provenance are untouched.
// `canonical_products` carries UNIQUE (lower(trim(name_ar)), lower(trim(brand))) — collisions
// are DETECTED and SKIPPED before any write, never discovered by a failing statement.
//
// Dry by default. Writes a before/after snapshot to docs/evidence/ for rollback.
//   npx tsx scripts/tps-core/remediate-locale-names.ts [--apply]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { writeFileSync, mkdirSync } from "fs";
import { toPoolerDbUrl } from "./pooler-url";
import { assertFingerprint } from "./tps-batch";
import { mobileNames, smartwatchNames, hasArabic } from "./arabic-naming";

type Row = { id: string; tps_identity_key: string; tps_version: string; brand: string; name_ar: string; name_en: string };
type Update = { id: string; key: string; version: string; brand: string; path: "composed" | "observed"; beforeAr: string; beforeEn: string; afterAr: string; afterEn: string };

const COMPOSERS: Record<string, (k: string) => { nameAr: string; nameEn: string }> = {
  "mobile-v1": mobileNames,
  "smartwatch-v1": smartwatchNames,
};
/** Key shapes the composers expect. A shorter key means the canonical was named by another
 *  path and must not be overwritten — the same guard remediate-ac-names.ts applies. */
const EXPECTED_PARTS: Record<string, number> = { "mobile-v1": 5, "smartwatch-v1": 6 };

const norm = (s: string) => s.trim().toLowerCase();

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const apply = process.argv.includes("--apply");
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const updates: Update[] = [];

    // ── PATH 1 · COMPOSED ────────────────────────────────────────────────────────────
    const composable = (await c.query(
      `select id, tps_identity_key, tps_version, coalesce(brand,'') brand, coalesce(name_ar,'') name_ar, coalesce(name_en,'') name_en
         from canonical_products where is_active and tps_version = any($1)`,
      [Object.keys(COMPOSERS)]
    )).rows as Row[];

    let wrongShape = 0;
    for (const r of composable) {
      const parts = (r.tps_identity_key || "").split("|");
      if (parts.length !== EXPECTED_PARTS[r.tps_version]) { wrongShape++; continue; }
      const n = COMPOSERS[r.tps_version](r.tps_identity_key);
      if (!n.nameAr || !n.nameEn) continue;
      if (/undefined|NO_STORAGE|NO_SIZE/.test(n.nameAr + n.nameEn)) continue; // sentinel guard
      if (n.nameAr === r.name_ar && n.nameEn === r.name_en) continue;
      updates.push({ id: r.id, key: r.tps_identity_key, version: r.tps_version, brand: r.brand, path: "composed", beforeAr: r.name_ar, beforeEn: r.name_en, afterAr: n.nameAr, afterEn: n.nameEn });
    }

    // ── PATH 2 · OBSERVED ────────────────────────────────────────────────────────────
    // The merchant's own Arabic title, from an observation ALREADY matched to this
    // canonical. Highest Arabic ratio wins, longest breaks a tie — the same "richest
    // observed name" rule write-model-canonicals.ts already uses, applied per script.
    const observed = (await c.query(
      `select c.id, c.tps_identity_key, c.tps_version, coalesce(c.brand,'') brand,
              coalesce(c.name_ar,'') name_ar, coalesce(c.name_en,'') name_en, n.raw_name
         from canonical_products c
         join normalized_product_observations n on n.canonical_product_id = c.id
        where c.is_active
          and c.tps_version in ('model-corroboration-v1','alias-reconciliation-v1')
          and c.name_ar !~ '[؀-ۿ]'
          and n.raw_name ~ '[؀-ۿ]'`
    )).rows as (Row & { raw_name: string })[];

    const bestArabic = new Map<string, Row & { raw_name: string }>();
    const arRatio = (s: string) => {
      const a = (s.match(/[؀-ۿ]/g) || []).length, l = (s.match(/[A-Za-z]/g) || []).length;
      return a + l === 0 ? 0 : a / (a + l);
    };
    for (const r of observed) {
      const name = (r.raw_name || "").trim();
      if (name.length < 8 || name.length > 200) continue; // a title, not a fragment or a page dump
      const cur = bestArabic.get(r.id);
      if (!cur) { bestArabic.set(r.id, { ...r, raw_name: name }); continue; }
      const better = arRatio(name) > arRatio(cur.raw_name) || (arRatio(name) === arRatio(cur.raw_name) && name.length > cur.raw_name.length);
      if (better) bestArabic.set(r.id, { ...r, raw_name: name });
    }
    for (const r of bestArabic.values()) {
      if (r.raw_name === r.name_ar) continue;
      updates.push({ id: r.id, key: r.tps_identity_key, version: r.tps_version, brand: r.brand, path: "observed", beforeAr: r.name_ar, beforeEn: r.name_en, afterAr: r.raw_name, afterEn: r.name_en });
    }

    // ── COLLISION GATE ───────────────────────────────────────────────────────────────
    // UNIQUE (lower(trim(name_ar)), lower(trim(brand))). Check the proposed names against
    // the rows that will REMAIN as well as against each other, and drop any that clash.
    const taken = new Map<string, string>(); // "name_ar|brand" -> canonical id holding it
    const changing = new Set(updates.map((u) => u.id));
    for (const r of (await c.query(`select id, coalesce(name_ar,'') name_ar, coalesce(brand,'') brand from canonical_products where is_active`)).rows as { id: string; name_ar: string; brand: string }[]) {
      if (changing.has(r.id)) continue; // this row's name is being replaced
      taken.set(`${norm(r.name_ar)}|${norm(r.brand)}`, r.id);
    }
    const applied: Update[] = [], collided: Update[] = [];
    for (const u of updates) {
      const k = `${norm(u.afterAr)}|${norm(u.brand)}`;
      if (taken.has(k)) { collided.push(u); continue; }
      taken.set(k, u.id);
      applied.push(u);
    }

    // ── REPORT ───────────────────────────────────────────────────────────────────────
    const byVersion: Record<string, number> = {};
    for (const u of applied) byVersion[u.version] = (byVersion[u.version] ?? 0) + 1;
    const gained = applied.filter((u) => !hasArabic(u.beforeAr) && hasArabic(u.afterAr)).length;
    console.log(`\n◆ ADR-185 locale-name remediation${apply ? "" : "  [DRY]"}`);
    console.log(`  composable canonicals scanned : ${composable.length}  (skipped, unexpected key shape: ${wrongShape})`);
    console.log(`  proposed updates              : ${updates.length}`);
    console.log(`  refused — name_ar collision   : ${collided.length}`);
    console.log(`  will update                   : ${applied.length}   ${JSON.stringify(byVersion)}`);
    console.log(`  names that GAIN Arabic        : ${gained}`);
    console.log(`\n  samples:`);
    for (const u of applied.slice(0, 8)) console.log(`   • [${u.path}] "${u.beforeAr}"  →  "${u.afterAr}"`);
    for (const u of collided.slice(0, 5)) console.log(`   ✗ collision: "${u.beforeAr}" → "${u.afterAr}" (brand ${u.brand})`);

    // A sample of eight hides exactly the defects this pass exists to remove. Scan the WHOLE
    // proposed set for the two failure shapes a composed name can take — a token repeated
    // back-to-back ("Flip 7 Flip"), and a model label so thin it names nothing — and print
    // every one. `--all` dumps the full before/after list for eyeballing.
    const repeated = applied.filter((u) => /\b(\S+)\s+\1\b/i.test(u.afterEn));
    // "Xiaomi 17 512GB" and "Honor 60 256GB" are CORRECT — a brand whose family segment IS
    // the brand leaves a bare generation, which is the real product name. Only flag a label
    // that is empty or a lone letter, which would name nothing.
    const thin = applied.filter((u) => {
      const label = u.afterEn.replace(/^\S+\s*/, "").replace(/\s*(\d+GB|\d+mm( Cellular)?)$/, "").trim();
      return label.length === 0 || /^[A-Za-z]$/.test(label);
    });
    if (repeated.length) {
      console.log(`\n  ⚠ ${repeated.length} proposed names repeat a token:`);
      for (const u of repeated.slice(0, 20)) console.log(`     ${u.key}  →  "${u.afterEn}"`);
    }
    if (thin.length) {
      console.log(`\n  ⚠ ${thin.length} proposed names have a near-empty model label:`);
      for (const u of thin.slice(0, 20)) console.log(`     ${u.key}  →  "${u.afterEn}"`);
    }
    if (process.argv.includes("--all")) {
      console.log(`\n  full proposal:`);
      for (const u of applied) console.log(`   [${u.path}] ${u.key}\n      ar: "${u.beforeAr}" → "${u.afterAr}"\n      en: "${u.beforeEn}" → "${u.afterEn}"`);
    }

    if (!apply) { console.log(`\n[dry] no writes. Re-run with --apply.\n`); return; }

    mkdirSync(resolve(process.cwd(), "docs/evidence"), { recursive: true });
    const snapshot = resolve(process.cwd(), `docs/evidence/locale-name-remediation-${new Date().toISOString().slice(0, 10)}.json`);
    writeFileSync(snapshot, JSON.stringify({ applied, collided }, null, 2), "utf8");

    let done = 0, failed = 0;
    for (const u of applied) {
      try {
        await c.query(`update canonical_products set name_ar=$1, name_en=$2, data_updated_at=now() where id=$3`, [u.afterAr, u.afterEn, u.id]);
        // The projection is the layer the customer surfaces read. Repair it in the same
        // pass so the fix is visible without waiting on a full projection rebuild.
        await c.query(`update tps_product_projection set display_name_ar=$1, display_name_en=$2, updated_at=now() where canonical_id=$3`, [u.afterAr, u.afterEn, u.id]);
        done++;
      } catch (e) {
        failed++;
        console.error(`  ! ${u.id}: ${e instanceof Error ? e.message : e}`);
      }
    }

    const left = (await c.query(
      `select count(*) n from tps_product_projection where display_name_ar !~ '[؀-ۿ]'`
    )).rows[0].n;
    console.log(`\n✓ updated ${done} canonicals (+projection rows) · failed ${failed}`);
    console.log(`  projected products still showing no Arabic: ${left}`);
    console.log(`  rollback snapshot: ${snapshot}\n`);
  } finally {
    await c.end();
  }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
