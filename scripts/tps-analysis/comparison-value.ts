// scripts/tps-analysis/comparison-value.ts
// ─────────────────────────────────────────────────────────────────────────────
// RETURN-ON-ENGINEERING INSTRUMENT (ADR-068)
//
// A plugin's headline "% identified" is a metric, not a value. Tawveeri exists to
// COMPARE prices, and a product sold by exactly one merchant can never be
// compared no matter how perfectly we identify it. So the number that should
// drive parser effort is not "what fraction did we identify?" but:
//
//     of the listings where a comparison is even POSSIBLE, how many do we identify?
//
// This splits a candidate plugin's listings by whether their brand appears in
// ≥2 merchants, and reports the identification rate for each half. A large
// unidentified tail of single-merchant no-name brands is cheap to ignore; an
// unidentified multi-merchant brand is a lost comparison and worth real effort.
//
// Read-only. Usage: npm run tps:comparison-value <plugin>
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import type { CategoryPlugin } from "../tps-core/types";
import { mobilePlugin } from "../tps-plugins/mobile";
import { smartwatchPlugin } from "../tps-plugins/smartwatch";
import { tvPlugin } from "../tps-plugins/tv";
import { tabletPlugin } from "../tps-plugins/tablet";
import { laptopPlugin } from "../tps-plugins/laptop";
import { audioPlugin } from "../tps-plugins/audio";
import { monitorPlugin } from "../tps-plugins/monitor";
import { printerPlugin } from "../tps-plugins/printer";
import { canonicalizeBrand } from "../tps-core/brand-map";
import { resolveListingIdentity, isSaudiMarket } from "../../src/lib/identity/merchant-listing-identity";

const CANDIDATES: Record<string, CategoryPlugin> = { mobile: mobilePlugin, smartwatch: smartwatchPlugin, tv: tvPlugin, tablet: tabletPlugin, laptop: laptopPlugin, audio: audioPlugin, monitor: monitorPlugin, printer: printerPlugin };
const SLUG: Record<number, string> = { 1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 8: "swsg" };
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

interface BrandStat { stores: Set<number>; ok: number; fail: number; samples: string[] }

(async () => {
  const name = process.argv[2] ?? "smartwatch";
  const plugin = CANDIDATES[name];
  if (!plugin) throw new Error(`unknown plugin '${name}'; known: ${Object.keys(CANDIDATES).join(", ")}`);
  const url = process.env.SUPABASE_DB_URL!;
  if (!/db\.vyceqrzttspyycdpojtn\.supabase\.co/.test(url)) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  const seen = new Set<string>();
  const byBrand = new Map<string, BrandStat>();
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
      const ident = resolveListingIdentity(store, r.u as string | null, SLUG[store]);
      if (!ident.key || !isSaudiMarket(ident.market) || seen.has(ident.key)) continue;
      seen.add(ident.key);

      const p = (r.payload ?? {}) as Record<string, unknown>;
      const ar = s(p.nameAr) ?? s(p.name_ar) ?? s(p.name) ?? s(r.raw_name) ?? "";
      const en = s(p.nameEn) ?? s(p.name_en) ?? s(p.title) ?? "";
      const rawBrand = s(p.brandEn) ?? s(p.brand) ?? s(p.brandAr) ?? null;
      if (!plugin.detect(ar, en)) continue;

      const norm = (plugin.normalize as (a: string, b: string, c: string | null, d?: Record<string, unknown>) => ReturnType<CategoryPlugin["normalize"]>)(ar, en, rawBrand, p);
      const id = plugin.buildIdentityKey(rawBrand, norm.payload, { model_number: norm.model_number });
      const brand = canonicalizeBrand(rawBrand) || "unknown";

      const e = byBrand.get(brand) ?? { stores: new Set<number>(), ok: 0, fail: 0, samples: [] };
      e.stores.add(store);
      if (id.status !== "invalid" && id.key) e.ok++;
      else { e.fail++; if (e.samples.length < 3) e.samples.push((ar || en).slice(0, 66)); }
      byBrand.set(brand, e);
    }
  }

  const rows = [...byBrand.entries()].map(([brand, e]) => ({ brand, stores: e.stores.size, ok: e.ok, fail: e.fail, total: e.ok + e.fail, samples: e.samples }));
  // "unknown" brand can never corroborate — the identity key would be brandless.
  const comparable = rows.filter((r) => r.stores >= 2 && r.brand !== "unknown");
  const isolated = rows.filter((r) => r.stores < 2 || r.brand === "unknown");
  const sum = (a: typeof rows) => a.reduce((x, r) => ({ ok: x.ok + r.ok, total: x.total + r.total }), { ok: 0, total: 0 });
  const c = sum(comparable), i = sum(isolated);
  const pct = (o: number, t: number) => (t ? ((100 * o) / t).toFixed(1) : "—");

  console.log(`\n╔══ RETURN ON ENGINEERING: ${name} ═══════════════════════════`);
  console.log(`\n  WHERE COMPARISON IS POSSIBLE (brand sold by >=2 merchants)`);
  console.log(`     identified ${c.ok}/${c.total}  = ${pct(c.ok, c.total)}%   ← the number that matters`);
  console.log(`\n  WHERE COMPARISON IS IMPOSSIBLE (single-merchant or unknown brand)`);
  console.log(`     identified ${i.ok}/${i.total} = ${pct(i.ok, i.total)}%   ← effort here cannot produce a comparison`);
  console.log(`\n  headline "% identified" across everything: ${pct(c.ok + i.ok, c.total + i.total)}%`);

  console.log(`\n  multi-merchant brands (effort here BUYS comparisons):`);
  for (const r of comparable.sort((a, b) => b.fail - a.fail).slice(0, 12)) {
    console.log(`     ${r.brand.padEnd(12)} stores=${r.stores}  identified ${r.ok}/${r.total}${r.fail ? `   missing ${r.fail}` : ""}`);
    if (r.fail) for (const smp of r.samples) console.log(`        ↳ ${smp}`);
  }
  console.log(`\n  largest isolated brands (effort here buys catalogue, not comparison):`);
  for (const r of isolated.sort((a, b) => b.total - a.total).slice(0, 8)) {
    console.log(`     ${r.brand.padEnd(14)} stores=${r.stores}  identified ${r.ok}/${r.total}`);
  }
  console.log("");
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
