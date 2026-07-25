// scripts/tps-analysis/gtin-coverage.ts
// ─────────────────────────────────────────────────────────────────────────────
// GTIN COVERAGE + CANDIDATE-COMPARISON REPORT (ADR-100) — measure-first, read-only.
//
// The GTIN lever (src/lib/enrichment) only pays off where feed stores actually EMIT a
// checksum-valid GTIN and where the SAME GTIN appears across ≥2 stores. This tool measures
// both before any write pass is wired, so corroboration is an evidence decision, not a guess.
//
// Two modes, both write NOTHING:
//   --probe [slug …]   Live-source each feed store through the PRODUCTION adapter and report
//                      how many products carry a valid GTIN (does the feed even expose one?).
//                      No DB access. Defaults to all GTIN-capturing feed providers.
//   (default)          Read raw_observations.payload->>'gtin' from the DB: per-store coverage,
//                      and ≥2-store GTIN groups = candidate cross-store comparisons.
//
// Usage:
//   npx tsx scripts/tps-analysis/gtin-coverage.ts --probe
//   npx tsx scripts/tps-analysis/gtin-coverage.ts --probe najm hdf almanea shaker
//   npx tsx scripts/tps-analysis/gtin-coverage.ts            # DB coverage (read-only)
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { listProviders, getProvider } from "../../src/lib/providers/registry";
import { sourceOffers } from "../../src/lib/providers/sourcing/router";
import { isValidGtin, gtinKey } from "../../src/lib/enrichment/icecat";
import { groupByGtin } from "../../src/lib/enrichment/gtin-identity";

/** Feed providers whose adapters capture GTINs (Salla/Zid, Algolia, WooCommerce). */
function gtinFeedProviders() {
  return listProviders().filter((p) => p.sourcing === "api" && (p.salla?.origin || p.algolia || p.feedUrl));
}

async function runProbe(slugs: string[], pages: number) {
  const providers = slugs.length
    ? slugs.map((s) => getProvider(s)).filter((p): p is NonNullable<typeof p> => !!p)
    : gtinFeedProviders();
  if (!providers.length) { console.error("no feed providers to probe"); process.exit(1); }

  console.log(`\n◆ GTIN feed probe — ${providers.length} store(s), maxPages=${pages} (live, no DB write)\n`);
  let anyGtin = false;
  for (const provider of providers) {
    const t0 = Date.now();
    let res;
    try {
      res = await sourceOffers(provider, { maxPages: pages });
    } catch (e) {
      console.log(`✗ ${provider.slug} — source failed: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const total = res.products.length;
    const withGtin = res.products.filter((p) => isValidGtin((p as { gtin?: unknown }).gtin as string)).length;
    const pct = total ? Math.round((withGtin / total) * 100) : 0;
    if (withGtin) anyGtin = true;
    const samples = res.products
      .filter((p) => isValidGtin((p as { gtin?: unknown }).gtin as string))
      .slice(0, 3)
      .map((p) => `${(p as { gtin?: string }).gtin} (${(p.name_en || p.name_ar).slice(0, 34)})`);
    console.log(`${withGtin ? "✓" : "·"} ${provider.slug.padEnd(14)} sampled=${String(total).padStart(4)}  GTINs=${String(withGtin).padStart(4)} (${pct}%)  ${secs}s${res.errors ? `  ⚠ ${res.errors.join("; ").slice(0, 60)}` : ""}`);
    if (samples.length) console.log(`   e.g. ${samples.join(" | ")}`);
  }
  console.log(
    anyGtin
      ? `\n→ At least one feed emits GTINs — the corroboration pass has fuel once these re-ingest (scheduler).\n`
      : `\n→ NO feed emitted a GTIN in this sample. GTIN corroboration will yield ~0 from current stores;\n  the lever needs GTIN-rich sources (Amazon/Jarir JSON-LD capture, or Icecat reverse-lookup). Honest finding.\n`
  );
}

async function runDbCoverage() {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    // Per-store raw-observation GTIN presence (payload->>'gtin'). Read-only, indexed by store.
    const perStore = (await c.query(
      `select store_id,
              count(*) total,
              count(payload->>'gtin') with_gtin
         from raw_observations
        group by store_id order by store_id`
    )).rows as { store_id: number; total: string; with_gtin: string }[];

    const totals = perStore.reduce((a, r) => ({ total: a.total + Number(r.total), withGtin: a.withGtin + Number(r.with_gtin) }), { total: 0, withGtin: 0 });
    console.log(`\n◆ raw_observations GTIN coverage (read-only)\n`);
    console.log(`  total observations: ${totals.total.toLocaleString()}   with a 'gtin' field: ${totals.withGtin.toLocaleString()} (${totals.total ? ((totals.withGtin / totals.total) * 100).toFixed(1) : 0}%)`);
    for (const r of perStore.filter((r) => Number(r.with_gtin) > 0)) {
      console.log(`    store ${String(r.store_id).padStart(3)}: ${Number(r.with_gtin).toLocaleString()} / ${Number(r.total).toLocaleString()} carry a gtin`);
    }

    if (totals.withGtin === 0) {
      console.log(`\n→ No GTINs in raw_observations yet. Capture deployed 2026-07-25 (ADR-100); coverage accrues as\n  Salla/Zid/Algolia/Woo stores re-ingest hourly. Re-run after the next scheduler cycle.\n`);
      return;
    }

    // Pull the (store, gtin) pairs that HAVE a gtin and validate + group across stores.
    const pairs = (await c.query(
      `select distinct store_id, payload->>'gtin' gtin
         from raw_observations
        where payload->>'gtin' is not null`
    )).rows as { store_id: number; gtin: string }[];
    const valid = pairs.filter((p) => isValidGtin(p.gtin));
    const groups = groupByGtin(valid.map((p) => ({ store_id: p.store_id, gtin: p.gtin })));
    const comparisons = groups.filter((g) => g.isComparison);
    console.log(`\n  checksum-valid distinct GTIN×store pairs: ${valid.length.toLocaleString()}`);
    console.log(`  distinct GTIN products: ${groups.length.toLocaleString()}`);
    console.log(`  ≥2-store GTIN groups (candidate cross-store comparisons): ${comparisons.length.toLocaleString()}`);
    for (const g of comparisons.slice(0, 15)) {
      console.log(`    ${g.gtinKey}  ×${g.stores.length} stores: [${g.stores.join(", ")}]`);
    }
    console.log(
      comparisons.length
        ? `\n→ ${comparisons.length} candidate comparisons available for the corroboration pass.\n`
        : `\n→ GTINs present but none shared across ≥2 stores yet — no new comparisons available. Re-check as coverage grows.\n`
    );
  } finally {
    await c.end();
  }
}

(async () => {
  const args = process.argv.slice(2);
  const pIdx = args.indexOf("--pages");
  const pages = pIdx > -1 ? Number(args[pIdx + 1]) || 3 : 3;
  if (args.includes("--probe")) {
    const slugs = args.filter((a, i) => !a.startsWith("--") && !(pIdx > -1 && i === pIdx + 1));
    await runProbe(slugs, pages);
  } else {
    await runDbCoverage();
  }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
