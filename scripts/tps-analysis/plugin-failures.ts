// scripts/tps-analysis/plugin-failures.ts
// READ-ONLY. Sample the ACTUAL listing titles a candidate plugin claims but
// cannot identify, grouped by failure signature — so parser work is driven by
// real Saudi listings rather than by reading the regexes and guessing.
// Usage: npx tsx scripts/tps-analysis/plugin-failures.ts mobile [--brand] [--n 40]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import type { CategoryPlugin } from "../tps-core/types";
import { mobilePlugin } from "../tps-plugins/mobile";
import { smartwatchPlugin } from "../tps-plugins/smartwatch";
import { resolveListingIdentity, isSaudiMarket } from "../../src/lib/identity/merchant-listing-identity";

const CANDIDATES: Record<string, CategoryPlugin> = { mobile: mobilePlugin, smartwatch: smartwatchPlugin };
const STORE_SLUG: Record<number, string> = { 1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 8: "swsg" };
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const ACCESSORY = /\b(case|cover|كفر|غطاء|حماية|جراب|screen protector|واقي|شاشة حماية|cable|كابل|كيبل|charger|شاحن|adapter|محول|power ?bank|بور بانك|باور بانك|stand|حامل|mount|bag|حقيبة|sleeve|strap|سوار|حزام|holder|tripod|lens|عدسة|memory card|بطاقة ذاكرة|airtag|popsocket|ring|خاتم|طقم|accessor|ملحق|سماعة|earbud|headphone|buds)\b/i;

(async () => {
  const name = process.argv[2] ?? "mobile";
  const plugin = CANDIDATES[name];
  if (!plugin) throw new Error(`unknown candidate '${name}'`);
  const N = Number(process.argv[process.argv.indexOf("--n") + 1]) || 30;
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("set statement_timeout = 0");

  const seen = new Set<string>();
  const buckets = new Map<string, { n: number; samples: string[] }>();
  const brandCount = new Map<string, { claimed: number; failed: number }>();
  let claimed = 0, failed = 0, accessoryFailed = 0, cursor = 0;

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
      const bk = (brand ?? "(none)").toLowerCase();
      const bc = brandCount.get(bk) ?? { claimed: 0, failed: 0 }; bc.claimed++; brandCount.set(bk, bc);

      const norm = (plugin.normalize as (a: string, b: string, c: string | null, d?: Record<string, unknown>) => ReturnType<CategoryPlugin["normalize"]>)(nameAr, nameEn, brand, p);
      const id = plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
      if (id.status !== "invalid" && id.key) continue;
      failed++; bc.failed++;
      const title = (nameAr || nameEn).slice(0, 92);
      const isAcc = ACCESSORY.test(`${nameAr} ${nameEn}`);
      if (isAcc) accessoryFailed++;
      const sig = `${isAcc ? "ACCESSORY | " : ""}${id.reason ?? "invalid"}`;
      const b = buckets.get(sig) ?? { n: 0, samples: [] };
      b.n++; if (b.samples.length < N) b.samples.push(`[${STORE_SLUG[store]}|${brand ?? "-"}] ${title}`);
      buckets.set(sig, b);
    }
  }

  console.log(`\n╔══ ${name}: claimed=${claimed}  failed=${failed}  (of failures, ${accessoryFailed} look like ACCESSORIES)`);
  for (const [sig, b] of [...buckets.entries()].sort((a, c) => c[1].n - a[1].n)) {
    console.log(`\n── ${b.n}  ${sig}`);
    for (const s of b.samples) console.log(`     ${s}`);
  }
  if (process.argv.includes("--brand")) {
    console.log(`\n── claimed vs failed by store-supplied brand`);
    for (const [b, c] of [...brandCount.entries()].sort((x, y) => y[1].failed - x[1].failed).slice(0, 30)) {
      console.log(`   ${String(c.failed).padStart(5)}/${String(c.claimed).padStart(5)} failed  ${b}`);
    }
  }
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
