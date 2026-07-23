// scripts/tps-analysis/normalization-gap.ts
// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZATION-GAP ANALYZER (ADR-060)
//
// Identity covers only ~20% of the Saudi catalog. That gap — not entity
// resolution — is the platform's largest remaining lever. But it is NOT one
// generic parser problem, and treating it as one would waste the effort.
//
// This attributes every unidentified listing to a SPECIFIC cause, so the work
// can be sequenced by measured yield instead of intuition:
//   • merchant           — is one store's payload shape the blocker?
//   • detected category  — or no category at all (no plugin claims it)
//   • failure reason     — the plugin's own `invalid` reason, verbatim
//   • missing field      — which identity attribute could not be read
//   • language           — Arabic-only titles vs English
//   • product vs accessory — accessories are low consumer value; excluding them
//                            stops a vanity metric from driving the roadmap
//
// Strictly READ-ONLY.
// Usage: npx tsx scripts/tps-analysis/normalization-gap.ts [--limit N]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { CATEGORY_DEFS } from "../tps-core/category-registry";
import { pickBestUrl } from "../tps-core/url-util";
import { resolveListingIdentity, isSaudiMarket } from "../../src/lib/identity/merchant-listing-identity";

const STORE_SLUG: Record<number, string> = { 1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 8: "swsg" };
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Accessory signals — low consumer comparison value, measured separately. */
const ACCESSORY = /\b(case|cover|كفر|غطاء|حماية|screen protector|واقي|cable|كابل|كيبل|charger|شاحن|adapter|محول|power bank|بور بانك|باور بانك|stand|حامل|mount|bag|حقيبة|شنطة|sleeve|strap|سوار|حزام|keyboard|كيبورد|mouse|ماوس|filter|فلتر|bulb|لمبة|remote|ريموت|bracket|holder|tripod|حامل ثلاثي|lens hood|memory card|بطاقة ذاكرة|طقم|accessor|ملحق)\b/i;

function bump(m: Map<string, number>, k: string) { m.set(k, (m.get(k) ?? 0) + 1); }
function top(m: Map<string, number>, n = 18) {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
function show(title: string, m: Map<string, number>, total: number, n = 18) {
  console.log(`\n── ${title}`);
  for (const [k, v] of top(m, n)) console.log(`   ${String(v).padStart(6)}  ${((100 * v) / Math.max(1, total)).toFixed(1).padStart(5)}%  ${k}`);
}

(async () => {
  const url = process.env.SUPABASE_DB_URL!;
  if (!/db\.vyceqrzttspyycdpojtn\.supabase\.co/.test(url)) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");
  const defs = Object.values(CATEGORY_DEFS);

  const seen = new Set<string>();
  let saudi = 0, identified = 0, unidentified = 0, accessories = 0;
  const byStore = new Map<string, number>();          // unidentified per merchant
  const byStoreTotal = new Map<string, number>();     // all Saudi listings per merchant
  const noPlugin = new Map<string, number>();         // no category plugin claimed it
  const byReason = new Map<string, number>();         // plugin's own invalid reason
  const byCategory = new Map<string, number>();       // detected but unidentified
  const byLang = new Map<string, number>();
  const accessoryByStore = new Map<string, number>();

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
      const slug = STORE_SLUG[store] ?? String(store);
      const ident = resolveListingIdentity(store, r.u as string | null, slug);
      if (!ident.key || !isSaudiMarket(ident.market)) continue;
      if (seen.has(ident.key)) continue;
      seen.add(ident.key); saudi++;
      bump(byStoreTotal, slug);

      const p = (r.payload ?? {}) as Record<string, unknown>;
      const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(r.raw_name) ?? "";
      const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
      const brand = asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null;
      const text = `${nameAr} ${nameEn}`;
      const isAccessory = ACCESSORY.test(text);

      let ok = false; const reasons: string[] = []; let detected = false;
      for (const def of defs) {
        if (!def.plugin.detect(nameAr, nameEn)) continue;
        detected = true;
        const norm = def.normalize(nameAr, nameEn, brand, p);
        const id = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
        if (id.status !== "invalid" && id.key) { ok = true; break; }
        reasons.push(`${def.category}: ${id.reason ?? "invalid"}`);
      }
      if (ok) { identified++; continue; }

      unidentified++;
      bump(byStore, slug);
      if (isAccessory) { accessories++; bump(accessoryByStore, slug); }
      if (!detected) {
        bump(noPlugin, slug);
        bump(byCategory, "(no plugin claims this listing)");
      } else {
        for (const rs of reasons.slice(0, 1)) {
          bump(byReason, rs);
          bump(byCategory, rs.split(":")[0]);
        }
      }
      const hasAr = /[؀-ۿ]/.test(text);
      bump(byLang, !nameEn && hasAr ? "Arabic title only" : nameEn && !hasAr ? "English title only" : hasAr ? "bilingual" : "neither/unknown");
    }
  }

  console.log(`\n╔══ NORMALIZATION GAP ══════════════════════════════════════════`);
  console.log(`   distinct Saudi listings : ${saudi}`);
  console.log(`   WITH an identity        : ${identified}  (${((100 * identified) / saudi).toFixed(1)}%)`);
  console.log(`   WITHOUT an identity     : ${unidentified}  (${((100 * unidentified) / saudi).toFixed(1)}%)`);
  console.log(`   of those, accessories   : ${accessories}  (${((100 * accessories) / Math.max(1, unidentified)).toFixed(1)}% of the gap — low comparison value)`);
  console.log(`   PRODUCT-GRADE GAP       : ${unidentified - accessories}  ← the number that matters`);

  console.log(`\n── unidentified by merchant (share of that merchant's own catalog)`);
  for (const [slug, n] of top(byStore, 10)) {
    const tot = byStoreTotal.get(slug) ?? 0;
    const acc = accessoryByStore.get(slug) ?? 0;
    console.log(`   ${String(n).padStart(6)} / ${String(tot).padStart(6)}  ${((100 * n) / Math.max(1, tot)).toFixed(1).padStart(5)}% unidentified   ${slug}  (accessories ${acc})`);
  }
  show("gap by category / cause", byCategory, unidentified);
  show("top plugin rejection reasons", byReason, unidentified);
  show("no plugin claims the listing, by merchant", noPlugin, unidentified);
  show("language of unidentified titles", byLang, unidentified);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
