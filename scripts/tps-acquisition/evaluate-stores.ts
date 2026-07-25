// scripts/tps-acquisition/evaluate-stores.ts
// ─────────────────────────────────────────────────────────────────────────────
// ACQUISITION ENGINE · Evaluation layer — turns ANY store domain into a scored
// onboarding decision. This is the durable asset: discovery sources come and go, but a
// domain-in → intelligence-out engine makes every future candidate (from Common Crawl, a
// directory, web search, or the Founder) instantly actionable at ~zero marginal cost.
//
// For each domain it: (1) auto-detects the platform by probing public structured endpoints
// (Shopify products.json · WooCommerce Store API · Salla/Zid sitemap+JSON-LD); (2) reconstructs
// a catalogue sample through the SAME adapters production ingests with; (3) SAR-gates (market
// scoping — never a foreign-currency feed); (4) scores real overlap vs our SINGLE-STORE catalogue
// (the comparison opportunity); (5) emits a full intelligence record (platform, catalog size,
// public-discoverability, discovery method, confidence, integration difficulty, connector,
// priority). Writes a CSV artifact; no production DB writes (ADR-099-safe).
//
// Usage:
//   npx tsx scripts/tps-acquisition/evaluate-stores.ts <domain|url> [more…] [--pages N] [--out file.csv]
//   npx tsx scripts/tps-acquisition/evaluate-stores.ts --stdin        # domains (one per line) on stdin
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { writeFileSync } from "fs";
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { resolveSourcingAdapter } from "../../src/lib/providers/sourcing/router";
import type { RetailerProvider } from "../../src/lib/providers/types";
import { loadCatalog, strongTokens, detectBrand } from "../tps-analysis/feed-overlap-probe";

const UA = "Mozilla/5.0 (compatible; TawveeriBot/1.0; +acquisition)";
type Cat = Awaited<ReturnType<typeof loadCatalog>>;
type Platform = "shopify" | "woocommerce" | "salla_or_zid" | "unknown";

const origin = (d: string) => {
  let s = d.trim().replace(/\s+/g, "");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s.replace(/\/+$/, "");
};

async function getJson(url: string, ms = 12000): Promise<unknown | null> {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
async function getText(url: string, ms = 12000): Promise<string | null> {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

interface Detected { platform: Platform; currency: string | null; discoverable: boolean; note: string; }

/** Probe public structured endpoints in cheapest-first order. */
async function detectPlatform(o: string): Promise<Detected> {
  // Shopify — universal /products.json (credential-free, full catalogue, paginated).
  const shop = await getJson(`${o}/products.json?limit=1`);
  if (shop && Array.isArray((shop as { products?: unknown[] }).products)) {
    const meta = (await getJson(`${o}/meta.json`)) as { currency?: string } | null;
    return { platform: "shopify", currency: meta?.currency ?? null, discoverable: true, note: "shopify products.json" };
  }
  // WooCommerce Store API.
  const woo = await getJson(`${o}/wp-json/wc/store/v1/products?per_page=1`);
  if (Array.isArray(woo) && woo.length >= 0 && woo !== null) {
    const cur = (woo as { prices?: { currency_code?: string } }[])?.[0]?.prices?.currency_code ?? null;
    // Distinguish a real Woo store (array, even empty, from the wc/store route) — the route
    // 200s only on WooCommerce. Empty array still means Woo (just no products on page 1).
    if (Array.isArray(woo)) return { platform: "woocommerce", currency: cur, discoverable: true, note: "woocommerce store-api" };
  }
  // Salla / Zid — JSON-LD storefronts. Detect via sitemap product-URL shapes.
  const sm = await getText(`${o}/sitemap.xml`);
  if (sm) {
    const isSallaZid = /\/(?:-\/)?p\d{4,}(?:$|[/?#<])/i.test(sm) || /\/products\/[^/?#<]{2,}/i.test(sm) || /salla|zid/i.test(sm);
    if (isSallaZid) return { platform: "salla_or_zid", currency: null, discoverable: true, note: "salla/zid sitemap+json-ld" };
  }
  // Homepage platform fingerprint fallback.
  const home = await getText(o);
  if (home) {
    if (/cdn\.salla|s-cdn\.salla|salla\.sa/i.test(home)) return { platform: "salla_or_zid", currency: null, discoverable: true, note: "salla fingerprint" };
    if (/zid\.store|from\.zid/i.test(home)) return { platform: "salla_or_zid", currency: null, discoverable: true, note: "zid fingerprint" };
    if (/cdn\.shopify|myshopify\.com/i.test(home)) return { platform: "shopify", currency: null, discoverable: true, note: "shopify fingerprint (no products.json)" };
    if (/wp-content|woocommerce/i.test(home)) return { platform: "woocommerce", currency: null, discoverable: false, note: "woo fingerprint (store-api closed)" };
  }
  return { platform: "unknown", currency: null, discoverable: false, note: "no known platform signal" };
}

interface Sample { count: number; currency: string | null; products: { name: string; brand: string }[]; }

/** Reconstruct a bounded catalogue sample for overlap scoring. */
async function sampleCatalog(o: string, det: Detected, pages: number): Promise<Sample> {
  if (det.platform === "shopify") {
    const products: { name: string; brand: string }[] = [];
    for (let page = 1; page <= pages; page++) {
      const j = (await getJson(`${o}/products.json?limit=250&page=${page}`)) as { products?: { title?: string; vendor?: string }[] } | null;
      const arr = j?.products ?? [];
      if (!arr.length) break;
      for (const p of arr) products.push({ name: String(p.title || ""), brand: String(p.vendor || "") });
    }
    return { count: products.length, currency: det.currency, products };
  }
  // Salla/Zid and WooCommerce go through the production adapters (exactly what we'd ingest).
  const provider = (det.platform === "salla_or_zid"
    ? { slug: "probe", storeId: -1, displayName: "p", enabled: true, sourcing: "api", affiliate: null, salla: { origin: o } }
    : { slug: "probe", storeId: -1, displayName: "p", enabled: true, sourcing: "api", affiliate: null, feedUrl: o }) as unknown as RetailerProvider;
  try {
    const res = await resolveSourcingAdapter(provider).fetchOffers(provider, { maxPages: pages });
    return { count: res.count, currency: det.currency, products: res.products.map((p) => ({ name: p.name_en || p.name_ar || "", brand: (p as { brand?: string }).brand || "" })) };
  } catch { return { count: 0, currency: det.currency, products: [] }; }
}

const CONNECTOR: Record<Platform, string> = {
  shopify: "shopify-products-json (adapter TBD — trivial)",
  woocommerce: "woocommerce-store-api (adapter EXISTS)",
  salla_or_zid: "salla-json-ld (adapter EXISTS, covers Salla+Zid)",
  unknown: "none (scraper fallback / skip)",
};
const DIFFICULTY: Record<Platform, string> = { shopify: "low", woocommerce: "low", salla_or_zid: "low", unknown: "high" };

interface Intel {
  domain: string; platform: Platform; catalog_size_sampled: number; currency: string | null; sar_ok: boolean;
  brand_overlap_pct: number; model_overlap_pct: number; discoverable: boolean; discovery_method: string;
  integration_difficulty: string; connector: string; priority: string; confidence: number; note: string; sample_hits: string;
}

async function evaluate(domain: string, cat: Cat, pages: number, discoveryMethod: string): Promise<Intel> {
  const o = origin(domain);
  const det = await detectPlatform(o);
  const base: Intel = {
    domain: o.replace(/^https?:\/\//, ""), platform: det.platform, catalog_size_sampled: 0, currency: det.currency,
    sar_ok: false, brand_overlap_pct: 0, model_overlap_pct: 0, discoverable: det.discoverable, discovery_method: discoveryMethod,
    integration_difficulty: DIFFICULTY[det.platform], connector: CONNECTOR[det.platform], priority: "SKIP", confidence: 0.3, note: det.note, sample_hits: "",
  };
  if (det.platform === "unknown") return base;

  const s = await sampleCatalog(o, det, pages);
  base.catalog_size_sampled = s.count;
  base.currency = s.currency ?? det.currency;
  const sarOk = base.currency == null || base.currency === "SAR";
  base.sar_ok = sarOk;
  if (!s.count) { base.priority = "SKIP"; base.note += " · no catalogue sampled"; base.confidence = 0.4; return base; }

  let brandOverlap = 0, modelOverlap = 0;
  const hits: string[] = [];
  for (const p of s.products) {
    const b = detectBrand(p.brand, p.name, cat);
    if (!b) continue;
    brandOverlap++;
    const pool = cat.tokensByBrand.get(b);
    if (pool) for (const t of strongTokens(p.name)) { if (pool.has(t)) { modelOverlap++; if (hits.length < 4) hits.push(`${b}:${p.name.slice(0, 34)}`); break; } }
  }
  base.brand_overlap_pct = Math.round((brandOverlap / s.count) * 100);
  base.model_overlap_pct = Math.round((modelOverlap / s.count) * 100);
  base.sample_hits = hits.join(" | ");
  base.confidence = Math.min(0.9, 0.5 + s.count / 1000);

  // Priority: currency gates outright (market scoping). Then model-overlap dominates.
  if (!sarOk) { base.priority = "DISQUALIFIED_NON_SAR"; }
  else if (base.model_overlap_pct >= 12) base.priority = "HIGH";
  else if (base.model_overlap_pct >= 4) base.priority = "MEDIUM";
  else if (base.brand_overlap_pct >= 15) base.priority = "LOW_WATCH";
  else base.priority = "SKIP_NO_OVERLAP";
  return base;
}

(async () => {
  const args = process.argv.slice(2);
  const pi = args.indexOf("--pages"); const pages = pi > -1 ? Number(args[pi + 1]) || 2 : 2;
  const oi = args.indexOf("--out"); const outFile = oi > -1 ? args[oi + 1] : null;
  let domains = args.filter((a, i) => !a.startsWith("--") && !(pi > -1 && i === pi + 1) && !(oi > -1 && i === oi + 1));
  if (args.includes("--stdin")) {
    const stdin = await new Promise<string>((r) => { let d = ""; process.stdin.on("data", (c) => d += c); process.stdin.on("end", () => r(d)); });
    domains = domains.concat(stdin.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  }
  if (!domains.length) { console.error("usage: evaluate-stores <domain…> [--pages N] [--out f.csv] | --stdin"); process.exit(1); }

  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const cat = await loadCatalog(c);
  await c.end();
  console.error(`◆ overlap target: ${cat.singleStoreCount} single-store canonicals · ${cat.brandSet.size} brands · evaluating ${domains.length} domain(s)\n`);

  const rows: Intel[] = [];
  for (const d of domains) {
    const r = await evaluate(d, cat, pages, "manual/seed");
    rows.push(r);
    console.error(`${r.priority.padEnd(20)} ${r.domain.padEnd(28)} ${r.platform.padEnd(13)} cat~${String(r.catalog_size_sampled).padStart(4)} ${r.currency ?? "?"} brand=${r.brand_overlap_pct}% model=${r.model_overlap_pct}% [${r.connector}]${r.sample_hits ? "  " + r.sample_hits : ""}`);
  }

  // Rank: HIGH → MEDIUM → LOW_WATCH → rest; then by model overlap.
  const rank = (p: string) => ({ HIGH: 0, MEDIUM: 1, LOW_WATCH: 2 } as Record<string, number>)[p] ?? 3;
  rows.sort((a, b) => rank(a.priority) - rank(b.priority) || b.model_overlap_pct - a.model_overlap_pct);

  const cols = Object.keys(rows[0]) as (keyof Intel)[];
  const csv = [cols.join(","), ...rows.map((r) => cols.map((k) => `"${String(r[k]).replace(/"/g, "'")}"`).join(","))].join("\n");
  const file = outFile ?? resolve(process.cwd(), "docs/acquisition-store-intelligence.csv");
  writeFileSync(file, csv);
  const worth = rows.filter((r) => ["HIGH", "MEDIUM"].includes(r.priority)).length;
  console.error(`\n✓ ${rows.length} evaluated · ${worth} worth onboarding (HIGH/MEDIUM) · written → ${file}\n`);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
