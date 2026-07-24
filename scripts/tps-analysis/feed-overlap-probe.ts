// scripts/tps-analysis/feed-overlap-probe.ts
// ─────────────────────────────────────────────────────────────────────────────
// FEED OVERLAP PROBE (ADR-089 follow-up) — read-only, credential-free.
//
// Comparison growth is merchant-DATA-ACCESS-bound, not engineering-bound: adding a
// merchant only creates comparisons where its catalogue OVERLAPS ours (same brand +
// model that we already carry single-store). shaker proved a whole clean WooCommerce
// merchant can add ~0 comparisons when its catalogue (appliances/spare parts) doesn't
// overlap our electronics tail. So onboarding must be an EVIDENCE decision, not a guess.
//
// Given one or more candidate shop origins, this probe:
//   1. checks whether a PUBLIC WooCommerce Store API is exposed (credential-free path),
//   2. samples the catalogue through the same adapter production uses (EN/AR SKU-merged),
//   3. measures real overlap against our canonical graph — BRAND overlap AND same-brand
//      MODEL-CODE overlap with our SINGLE-STORE products (the comparison opportunity),
//   4. reports a comparison-potential estimate so onboarding (config-only) is a numbers
//      decision, not a guess. Estimates are an UPPER BOUND — realized comparisons still
//      require full identity+spec resolution downstream.
//
// It writes NOTHING. Usage:
//   npx tsx scripts/tps-analysis/feed-overlap-probe.ts <origin> [origin2 …] [--pages N]
//   e.g. npx tsx scripts/tps-analysis/feed-overlap-probe.ts https://shakersa.com --pages 6
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { wooCommerceFeedAdapter } from "../../src/lib/providers/sourcing/woocommerce-feed-adapter";
import type { RetailerProvider } from "../../src/lib/providers/types";

const normBrand = (b: string) => (b || "").toLowerCase().replace(/\s+/g, " ").trim();

/** STRONG model tokens: genuine alphanumeric model codes (letter+digit adjacency),
 * e.g. "s24", "a16", "55nano796", "60uq7900", "sm-x200". A bare spec number ("55",
 * "11kg") is deliberately EXCLUDED — those collide across unrelated products (a TV's
 * 55" vs a washer's capacity) and produced a false 68% on shaker. Sharing a strong
 * token WITHIN THE SAME BRAND is a real "same model" signal. */
const SPEC_TOKEN = /^\d+(kg|g|gb|tb|mb|w|kw|ml|l|hz|khz|mah|cm|mm|m|inch|in|k|v|a|p|nit|nits|wh|rpm|bar)$/;
function strongTokens(name: string): Set<string> {
  const out = new Set<string>();
  for (const t of (name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)) {
    if (t.length < 3) continue;
    if (SPEC_TOKEN.test(t)) continue;                  // a spec (10kg, 8gb, 4k), not a model code
    if (/[a-z]/.test(t) && /\d/.test(t)) out.add(t);   // alphanumeric model code (s24, uq7900)
    else if (/^\d{4,}$/.test(t)) out.add(t);            // long numeric code (SKU-ish)
  }
  return out;
}

async function loadCatalog(c: Client) {
  // Our brands + per-brand strong-token index, restricted to SINGLE-STORE canonicals
  // (has_comparison=false) — those are the ones a new merchant could turn comparable.
  const rows = (await c.query(
    `select coalesce(nullif(trim(p.brand),''),'') brand,
            coalesce(p.display_name_en,'') || ' ' || coalesce(p.display_name_ar,'') name
       from tps_product_projection p where p.has_comparison = false`
  )).rows as { brand: string; name: string }[];
  const brandSet = new Set<string>();
  const tokensByBrand = new Map<string, Set<string>>();
  for (const r of rows) {
    const b = normBrand(r.brand);
    if (!b) continue;
    brandSet.add(b);
    const set = tokensByBrand.get(b) ?? new Set<string>();
    strongTokens(r.name).forEach((t) => set.add(t));
    tokensByBrand.set(b, set);
  }
  // Longest brands first so multi-word brands ("black decker") win over substrings.
  const brandsByLen = [...brandSet].sort((a, b) => b.length - a.length);
  return { brandSet, brandsByLen, tokensByBrand, singleStoreCount: rows.length };
}

type Cat = Awaited<ReturnType<typeof loadCatalog>>;

/** Detect which of OUR brands a candidate product belongs to: prefer its feed brand
 * field, else scan the name for a known brand token (word-bounded). Null if none. */
function detectBrand(feedBrand: string, name: string, cat: Cat): string | null {
  const fb = normBrand(feedBrand);
  if (fb && cat.brandSet.has(fb)) return fb;
  const hay = ` ${name.toLowerCase()} `;
  for (const b of cat.brandsByLen) {
    if (b.length < 2) continue;
    if (hay.includes(` ${b} `) || hay.includes(` ${b}`)) return b;
  }
  return null;
}

/** Read the feed's default currency from one product. Tawveeri is a Saudi (SAR)
 * platform — a KWD/QAR/AED feed must NEVER be ingested (it would fabricate a wrong
 * price and break market scoping). danzaastore proved this: a clean feed, real
 * overlap on NAMES, but priced in KWD → out of scope. */
async function detectCurrency(origin: string): Promise<string | null> {
  try {
    const u = `${origin.replace(/\/+$/, "")}/wp-json/wc/store/v1/products?per_page=1&page=1`;
    const res = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (compatible; TawveeriBot/1.0)", accept: "application/json" } });
    if (!res.ok) return null;
    const rows = (await res.json()) as { prices?: { currency_code?: string } }[];
    return rows?.[0]?.prices?.currency_code ?? null;
  } catch { return null; }
}

async function probe(origin: string, pages: number, cat: Cat) {
  const provider = { slug: "probe", storeId: -1, displayName: "probe", enabled: true, sourcing: "api", affiliate: null, feedUrl: origin } as unknown as RetailerProvider;
  const t0 = Date.now();
  const currency = await detectCurrency(origin);
  let res;
  try {
    res = await wooCommerceFeedAdapter.fetchOffers(provider, { maxPages: pages });
  } catch (e) {
    return { origin, ok: false as const, reason: e instanceof Error ? e.message : String(e) };
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.count) return { origin, ok: false as const, reason: `no public WooCommerce Store API / empty (${res.errors?.join("; ") ?? "no rows"})`, secs };
  const currencyOk = currency == null || currency === "SAR";

  const brandCount = new Map<string, number>();
  let brandOverlap = 0;   // products whose brand we already carry single-store
  let modelOverlap = 0;   // products sharing a same-brand model code (real comparison signal)
  const hitSamples: string[] = [];
  for (const p of res.products) {
    const name = (p.name_en || p.name_ar || "");
    const b = detectBrand((p as { brand?: string }).brand || "", name, cat);
    if (!b) continue;
    brandCount.set(b, (brandCount.get(b) ?? 0) + 1);
    brandOverlap++;
    const pool = cat.tokensByBrand.get(b)!;
    let hit = false;
    for (const t of strongTokens(name)) { if (pool.has(t)) { hit = true; break; } }
    if (hit) { modelOverlap++; if (hitSamples.length < 5) hitSamples.push(`${b}: ${name.slice(0, 46)}`); }
  }
  const topBrands = [...brandCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return {
    origin, ok: true as const, secs, catalog: res.count, currency, currencyOk,
    brandOverlap, brandOverlapPct: Math.round((brandOverlap / res.count) * 100),
    modelOverlap, modelOverlapPct: Math.round((modelOverlap / res.count) * 100),
    topBrands, hitSamples,
  };
}

(async () => {
  const args = process.argv.slice(2);
  const pIdx = args.indexOf("--pages");
  const pages = pIdx > -1 ? Number(args[pIdx + 1]) || 6 : 6;
  const origins = args.filter((a, i) => !a.startsWith("--") && !(pIdx > -1 && i === pIdx + 1));
  if (!origins.length) { console.error("usage: feed-overlap-probe <origin> [origin2 …] [--pages N]"); process.exit(1); }

  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const cat = await loadCatalog(c);
  console.log(`\n◆ comparison opportunity: ${cat.singleStoreCount} single-store canonicals across ${cat.brandSet.size} brands\n`);

  for (const origin of origins) {
    const r = await probe(origin, pages, cat);
    if (!r.ok) { console.log(`✗ ${origin} — ${r.reason}`); continue; }
    console.log(`✓ ${origin}  (${r.secs}s) catalogue=${r.catalog}  currency=${r.currency ?? "?"}${r.currencyOk ? "" : "  ⚠ NON-SAR"}`);
    console.log(`   BRAND overlap (candidate carries a brand we hold single-store): ${r.brandOverlap} (${r.brandOverlapPct}%)`);
    console.log(`   MODEL-code overlap (same-brand model match — upper-bound comparisons): ${r.modelOverlap} (${r.modelOverlapPct}%)`);
    console.log(`   top overlapping brands: ${r.topBrands.map(([b, n]) => `${b}(${n})`).join(", ") || "—"}`);
    if (r.hitSamples.length) console.log(`   sample model hits: ${r.hitSamples.join(" | ")}`);
    // Currency gates onboarding outright — a non-SAR feed can never be ingested (it
    // would fabricate a wrong price + break market scoping), regardless of overlap.
    const v = !r.currencyOk ? `DISQUALIFIED — ${r.currency} feed, out of Saudi scope (never ingest)`
      : r.modelOverlapPct >= 12 ? "STRONG — onboard"
      : r.modelOverlapPct >= 4 ? "MODERATE — worth onboarding"
      : "WEAK — skip (≈0 new comparisons, like shaker)";
    console.log(`   → verdict: ${v}\n`);
  }
  await c.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
