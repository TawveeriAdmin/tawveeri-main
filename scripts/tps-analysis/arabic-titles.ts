// scripts/tps-analysis/arabic-titles.ts
// ADR-185 — give an Arabic title to STOREFRONT (`products`) rows whose name_ar is the
// merchant's English one. Replaces `arabic-titles.js`, which was unsafe to run: its composer
// read capacity from `specifications` only, and `capacity_btu` is null for every English-named
// air conditioner in the layer, so it would have renamed
//   "Haier Nano Cool Split AC, 22,200 BTU, Heat & Cool, Wi-Fi"  →  «مكيف سبليت هاير»
// destroying the number an AC shopper decides on, and then failed silently on the name_ar
// UNIQUE index inside a bare `catch {}`.
//
// Composition and the refuse-on-loss gate live in `tps-core/storefront-arabic-title.ts` and are
// unit-tested. This file is the query, the collision gate, and the report.
//
//   npx tsx scripts/tps-analysis/arabic-titles.ts [--apply] [--all]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { assertFingerprint } from "../tps-core/tps-batch";
import { composeStorefrontArabic } from "../tps-core/storefront-arabic-title";
import { hasArabic } from "../tps-core/arabic-naming";

// The founder-approved active retailers (ADR-125 scope + ADR-106).
const APPROVED_STORE_IDS = [1, 2, 3, 4, 5, 23, 24];

type Row = { id: string; name_en: string; name_ar: string; brand: string | null; category: string; specifications: Record<string, unknown> | null };

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const apply = process.argv.includes("--apply");
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  try {
    const rows = (await c.query(
      `select distinct p.id, coalesce(p.name_en,'') name_en, coalesce(p.name_ar,'') name_ar,
              p.brand, p.category, p.specifications
         from products p join product_stores ps on ps.product_id = p.id
        where ps.store_id = any($1) and p.is_active
          and (p.name_ar is null or p.name_ar !~ '[؀-ۿ]')`,
    //  ↑ NOT filtered by `p.category`. The stored category is unreliable — the split air
    //    conditioners a shopper still reads in English on the «مكيف» page are filed under
    //    `accessories` — so every English-named row is offered to the composer and the
    //    composer's own `no_category` refusal is the gate. It reads the type out of the
    //    merchant's title and declines everything it cannot identify.
      [APPROVED_STORE_IDS]
    )).rows as Row[];

    const refused: Record<string, number> = {};
    const proposals: { id: string; before: string; after: string }[] = [];
    for (const r of rows) {
      const res = composeStorefrontArabic({ category: r.category, nameEn: r.name_en || r.name_ar, brand: r.brand, specifications: r.specifications });
      if (!res.title) { refused[res.refusedBecause || "unknown"] = (refused[res.refusedBecause || "unknown"] ?? 0) + 1; continue; }
      if (!hasArabic(res.title)) { refused.no_arabic_produced = (refused.no_arabic_produced ?? 0) + 1; continue; }
      if (res.title === r.name_ar) continue;
      proposals.push({ id: r.id, before: r.name_ar, after: res.title });
    }

    // `products` carries UNIQUE (name_ar). Detect collisions against the rows that will REMAIN
    // and against each other, and refuse — the old script discovered them with `catch {}` and
    // reported the failures as successes.
    const changing = new Set(proposals.map((p) => p.id));
    const taken = new Set<string>();
    for (const r of (await c.query(`select id, coalesce(name_ar,'') name_ar from products`)).rows as { id: string; name_ar: string }[]) {
      if (!changing.has(r.id)) taken.add(r.name_ar.trim());
    }
    const applied: typeof proposals = [], collided: typeof proposals = [];
    for (const p of proposals) {
      if (taken.has(p.after.trim())) { collided.push(p); continue; }
      taken.add(p.after.trim());
      applied.push(p);
    }

    console.log(`\n◆ storefront Arabic titles${apply ? "" : "  [DRY]"}`);
    console.log(`  English-named rows in approved retailers : ${rows.length}`);
    console.log(`  refused by the composer                  : ${JSON.stringify(refused)}`);
    console.log(`  refused — name_ar collision              : ${collided.length}`);
    console.log(`  will update                              : ${applied.length}`);
    console.log(`\n  samples:`);
    for (const p of applied.slice(0, 12)) console.log(`   • "${p.before.slice(0, 52)}"\n       →  "${p.after}"`);
    if (process.argv.includes("--all")) for (const p of applied) console.log(`   ${p.before}\n     → ${p.after}`);

    if (!apply) { console.log(`\n[dry] no writes. Re-run with --apply.\n`); return; }

    let done = 0, failed = 0;
    for (const p of applied) {
      try { await c.query(`update products set name_ar=$1 where id=$2`, [p.after, p.id]); done++; }
      catch (e) { failed++; console.error(`  ! ${p.id}: ${e instanceof Error ? e.message : e}`); }
    }
    const left = (await c.query(
      `select count(distinct p.id) n from products p join product_stores ps on ps.product_id=p.id
        where ps.store_id = any($1) and p.is_active and p.name_ar !~ '[؀-ۿ]'`, [APPROVED_STORE_IDS]
    )).rows[0].n;
    console.log(`\n✓ updated ${done} storefront titles · failed ${failed}`);
    console.log(`  English-named storefront rows remaining (all categories): ${left}\n`);
  } finally {
    await c.end();
  }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
