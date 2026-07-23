// scripts/tps-analysis/catalog-funnel.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE CATALOGUE FUNNEL (ADR-065) — where does value leak between evidence and
// the customer?
//
// Tawveeri measures many things well but had no single view of the ONE question
// a CEO asks: of everything we have already paid to scrape, how much actually
// reaches a shopper — and where is the rest lost?
//
//   Saudi listings ─▶ has identity ─▶ is a canonical ─▶ in projection ─▶ comparable
//
// Each arrow is a leak with a different owner: detectors and parsers own the
// first, corroboration owns the third, merchant coverage owns the last. Reporting
// them together stops us optimising a stage that is not the bottleneck — and
// accessories are separated out, because "coverage" that is mostly phone cases
// is a vanity metric, not customer value.
//
// Read-only. Usage: npm run tps:funnel
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { CATEGORY_DEFS } from "../tps-core/category-registry";
import { resolveListingIdentity, isSaudiMarket } from "../../src/lib/identity/merchant-listing-identity";

const STORE_SLUG: Record<number, string> = { 1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 8: "swsg" };
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const ACCESSORY = /\b(case|cover|كفر|غطاء|حماية|جراب|screen protector|واقي|cable|كابل|كيبل|سلك|charger|شاحن|adapter|محول|power ?bank|بور بانك|stand|حامل|mount|bag|حقيبة|sleeve|strap|حزام|سوار|holder|tripod|lens|عدسة|memory card|بطاقة ذاكرة|طقم|accessor|ملحق)\b/i;

const bar = (n: number, total: number, w = 28) => {
  const filled = total ? Math.round((n / total) * w) : 0;
  return "█".repeat(filled) + "░".repeat(Math.max(0, w - filled));
};

(async () => {
  const url = process.env.SUPABASE_DB_URL!;
  if (!/db\.vyceqrzttspyycdpojtn\.supabase\.co/.test(url)) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");
  const defs = Object.values(CATEGORY_DEFS);

  // Stage 1–2: distinct Saudi listings, and how many get an identity.
  const seen = new Set<string>();
  let listings = 0, accessories = 0, identified = 0, identifiedAccessory = 0;
  const claimedBy = new Map<string, number>();
  const unclaimedByStore = new Map<string, number>();
  let cursor = 0;
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
      seen.add(ident.key); listings++;

      const p = (r.payload ?? {}) as Record<string, unknown>;
      const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(r.raw_name) ?? "";
      const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
      const brand = asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null;
      const isAcc = ACCESSORY.test(`${nameAr} ${nameEn}`);
      if (isAcc) accessories++;

      let ok = false;
      for (const def of defs) {
        if (!def.plugin.detect(nameAr, nameEn)) continue;
        const norm = def.normalize(nameAr, nameEn, brand, p);
        const id = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
        if (id.status !== "invalid" && id.key) {
          ok = true;
          claimedBy.set(def.category, (claimedBy.get(def.category) ?? 0) + 1);
          break;
        }
      }
      if (ok) { identified++; if (isAcc) identifiedAccessory++; }
      else if (!isAcc) {
        const slug = STORE_SLUG[store] ?? String(store);
        unclaimedByStore.set(slug, (unclaimedByStore.get(slug) ?? 0) + 1);
      }
    }
  }

  // Stages 3–5 from the serving tables.
  const { rows: [agg] } = await pg.query<{ canonicals: number; projection: number; comparable: number; multi3: number }>(`
    select (select count(*) from canonical_products where is_active)::int canonicals,
           (select count(*) from tps_product_projection)::int projection,
           (select count(*) from tps_product_projection where store_count >= 2)::int comparable,
           (select count(*) from tps_product_projection where store_count >= 3)::int multi3`);

  const productGrade = listings - accessories;
  const stages: [string, number, string][] = [
    ["Saudi listings ingested", listings, "merchant coverage + scraping"],
    ["  of which product-grade", productGrade, `${accessories} accessories excluded`],
    ["given an identity", identified, "detectors + parsers"],
    ["reach the projection", agg.projection, "corroboration + canonical write"],
    ["COMPARABLE (>=2 stores)", agg.comparable, "the core promise"],
    ["deep compare (>=3 stores)", agg.multi3, "merchant overlap"],
  ];

  console.log(`\n╔══ CATALOGUE FUNNEL — evidence to customer ════════════════════\n`);
  for (const [label, n, owner] of stages) {
    const pct = productGrade ? (100 * n) / productGrade : 0;
    console.log(`  ${label.padEnd(28)} ${String(n).padStart(6)}  ${bar(n, productGrade)} ${pct.toFixed(1).padStart(5)}%   ${owner}`);
  }

  const lostAtIdentity = productGrade - identified;
  console.log(`\n  BIGGEST LEAK: ${lostAtIdentity} product-grade listings (${((100 * lostAtIdentity) / Math.max(1, productGrade)).toFixed(1)}%) never get an identity.`);
  console.log(`  Every downstream layer — comparison, search, trust, Waffar — is capped by this number.`);

  console.log(`\n  identified per registered category:`);
  for (const [c, n] of [...claimedBy.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(5)}  ${c}`);
  }
  console.log(`\n  product-grade listings with NO identity, by merchant:`);
  for (const [s, n] of [...unclaimedByStore.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(5)}  ${s}`);
  }
  console.log("");
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
