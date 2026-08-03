// scripts/tps-core/merge-duplicate-canonicals.ts
// ─────────────────────────────────────────────────────────────────────────────
// DUPLICATE-CARD MERGE (ADR-184) — one product, one card.
//
// THE DEFECT. 130 products are held as TWO active, projected canonicals: one named by its
// bare MPN ("Apple MTJY3ZE/A", "Anker A3012H21") because the only listing that produced it
// gave nothing but a model number, and one named properly ("Apple Earpods Earbuds", "Anker
// Soundcore H30 Headphones"). A customer sees the same product twice, at two prices, which
// reads as a comparison and is not one. That is a trust defect, and it outranks growth.
//
// THE GATE IS ADR-176's, UNCHANGED. Two canonicals merge only when the SAME model number
// appears LITERALLY in the raw observation name on BOTH sides. Never inferred, never fuzzy,
// never on name similarity. If either side cannot show the model in its own evidence, the
// pair is left alone and reported.
//
// THE MECHANISM IS THE PROVEN ONE. Nothing bespoke: the loser's staging rows are re-keyed to
// the winner's identity key, then `corroboratePass` runs in both directions and any canonical
// left with no evidence is deactivated — exactly the path restage-category and
// cross-tier-merge already use. So identity, validation and dedup are unchanged.
//
// WINNER SELECTION is deterministic and stated: more stores first (it already carries more
// evidence), then a real name over a bare-MPN name, then the older canonical. A merge that
// picked by name alone could bury the side a customer can actually buy from.
//
// DRY BY DEFAULT · snapshots every move to docs/evidence/ · lane-locked (ADR-099).
// Usage: npx tsx scripts/tps-core/merge-duplicate-canonicals.ts [--apply] [--limit N]
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
import { extractManufacturerModel, extractManufacturerModelFromName } from "../../src/lib/identity/store-identifiers";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toPoolerDbUrl } = require("./pooler-url.js") as { toPoolerDbUrl: (raw: string) => string };

const LANE_KEY = 814_8148;
const asS = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const norm = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

interface Member {
  cid: string; key: string; category: string; name: string;
  storeCount: number; created: string;
  /** Does this side's OWN raw evidence state the model literally? ADR-176's test. */
  literal: boolean;
}

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const apply = process.argv.includes("--apply");
  const li = process.argv.indexOf("--limit");
  const LIMIT = li > -1 ? Number(process.argv[li + 1]) || 500 : 500;

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

  const { rows } = await pg.query(`
    select cp.id::text cid, cp.tps_identity_key key, cp.category, cp.brand, cp.model_number,
           coalesce(cp.name_en, cp.name_ar) nm, cp.created_at::text created,
           r.raw_name, r.payload, p.store_count
    from canonical_products cp
    join tps_identity_staging s on s.identity_key = cp.tps_identity_key
    join raw_observations r on r.id = s.raw_obs_id
    join tps_product_projection p on p.tps_identity_key = cp.tps_identity_key
    where cp.is_active and cp.brand is not null and cp.tps_identity_key is not null`);

  // Per canonical: its model, and whether its OWN evidence states that model literally.
  const seen = new Map<string, { brand: string; model: string; m: Member }>();
  for (const r of rows as any[]) {
    const p = r.payload ?? {};
    const nameAr = asS(p.nameAr) ?? asS(p.name_ar) ?? asS(p.name) ?? asS(r.raw_name) ?? "";
    const nameEn = asS(p.nameEn) ?? asS(p.name_en) ?? asS(p.title) ?? "";
    const stored = r.model_number && String(r.model_number).length >= 5 ? String(r.model_number) : null;
    const model = stored ?? extractManufacturerModel(p) ?? extractManufacturerModelFromName(`${nameAr} ${nameEn}`);
    if (!model) continue;
    const literal = norm(`${nameAr} ${nameEn}`).includes(norm(model));
    const prev = seen.get(r.cid);
    // Keep the strongest evidence we have seen for this canonical.
    if (prev && !(literal && !prev.m.literal)) continue;
    seen.set(r.cid, {
      brand: String(r.brand).toLowerCase(), model: model.toUpperCase(),
      m: { cid: r.cid, key: r.key, category: r.category, name: r.nm ?? "", storeCount: Number(r.store_count ?? 0), created: r.created, literal },
    });
  }

  const groups = new Map<string, Member[]>();
  for (const v of seen.values()) {
    const k = `${v.brand}|${v.model}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(v.m);
  }

  const merges: { pair: string; winner: Member; loser: Member }[] = [];
  const refused: string[] = [];
  for (const [pair, g] of groups) {
    if (g.length < 2) continue;
    // ADR-176: every member must state the model in its own evidence, or we do not merge.
    if (!g.every((m) => m.literal)) { refused.push(`${pair}: model not literal on all sides`); continue; }
    if (new Set(g.map((m) => m.category)).size > 1) { refused.push(`${pair}: members span categories`); continue; }
    // Name quality = how much the name says BEYOND brand + model. A bare-MPN card
    // ("Apple MTJY3ZE/A") scores 0; "Apple Earpods Earbuds" scores 2. Counting descriptive
    // tokens rather than pattern-matching a bare MPN is script-agnostic — an earlier regex
    // was Latin-only and would have kept «بيسوس A00075500113B1» over
    // «بيسوس A00075500113-B1 Headphones», burying the better name on an Arabic listing.
    // A descriptive token carries NO DIGITS — "Earbuds", "Headphones", «سماعات». A model
    // number always does. (An earlier version tested /^[A-Z0-9…]+$/i, which with the `i` flag
    // matches ordinary words too, so every name scored 0 and the tie-break silently did
    // nothing — it kept "Apple MTJY3ZE/A" over "Apple Earpods Earbuds".)
    const descriptiveness = (m: Member) =>
      m.name.split(/\s+/).filter((t) => t.length > 2 && !/\d/.test(t)).length;
    const ranked = [...g].sort((a, b) =>
      b.storeCount - a.storeCount
      || descriptiveness(b) - descriptiveness(a)
      || a.created.localeCompare(b.created));
    const [winner, ...losers] = ranked;
    for (const loser of losers) merges.push({ pair, winner, loser });
  }

  console.log(`duplicate brand+model groups : ${[...groups.values()].filter((g) => g.length > 1).length}`);
  console.log(`  merges proposed            : ${merges.length}`);
  console.log(`  REFUSED (gate)             : ${refused.length}`);
  for (const r of refused.slice(0, 5)) console.log(`     ${r}`);
  for (const m of merges.slice(0, 6)) {
    console.log(`\n  ${m.pair}`);
    console.log(`     KEEP  stores=${m.winner.storeCount}  ${m.winner.name.slice(0, 60)}`);
    console.log(`     MERGE stores=${m.loser.storeCount}  ${m.loser.name.slice(0, 60)}`);
  }

  const todo = merges.slice(0, LIMIT);
  if (!apply) { console.log(`\n[dry] nothing written. Re-run with --apply to merge ${todo.length}.`); await pg.end(); return; }

  mkdirSync(resolve(process.cwd(), "docs/evidence"), { recursive: true });
  const stamp = (await pg.query<{ t: string }>(`select to_char(now(),'YYYYMMDD-HH24MISS') t`)).rows[0].t;
  const snap = resolve(process.cwd(), `docs/evidence/dupe-merge-${stamp}.json`);
  writeFileSync(snap, JSON.stringify({ stamp, merges: todo, refused }, null, 1));
  console.log(`snapshot: ${snap}`);

  const touched = new Map<string, Set<string>>();
  let moved = 0;
  for (const m of todo) {
    const res = await sb.from("tps_identity_staging")
      .update({ identity_key: m.winner.key })
      .eq("category", m.loser.category).eq("identity_key", m.loser.key).select("raw_obs_id");
    if (res.error) { console.error(`merge ${m.pair}: ${res.error.message}`); continue; }
    moved += res.data?.length ?? 0;
    const set = touched.get(m.loser.category) ?? new Set<string>();
    touched.set(m.loser.category, set);
    set.add(m.winner.key); set.add(m.loser.key);
  }
  console.log(`staging rows re-keyed onto the surviving canonical: ${moved}`);

  for (const [cat, keys] of touched) {
    const def = CATEGORY_DEFS[cat as keyof typeof CATEGORY_DEFS];
    if (!def) continue;
    const k = [...keys];
    const multi = await corroboratePass(sb, def, k);
    const single = await corroboratePass(sb, def, k, { singleStore: true });
    console.log(`${cat}: corroborated=${multi.corroborated} resolved-single=${single.singleStore}`);
    const orphans = await pg.query<{ id: string }>(
      `select c.id from canonical_products c where c.is_active and c.tps_version = $1
         and not exists (select 1 from tps_identity_staging s where s.identity_key = c.tps_identity_key)`, [def.version]);
    if (orphans.rows.length) {
      for (let i = 0; i < orphans.rows.length; i += 200) {
        const { error } = await sb.from("canonical_products")
          .update({ is_active: false, data_updated_at: new Date().toISOString() })
          .in("id", orphans.rows.slice(i, i + 200).map((o) => o.id));
        if (error) throw new Error(`deactivate: ${error.message}`);
      }
      console.log(`${cat}: deactivated ${orphans.rows.length} emptied canonical(s)`);
    }
  }

  try { await lockClient?.end(); } catch { /* ignore */ }
  await pg.end();
  console.log("\ndone. Run `npm run tps:refresh` next — serialized.");
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
