// scripts/tps-matcher/run-progressive.ts
// Driver: run repeated bounded progressive units for a category (or all) until
// the eligible backlog is exhausted (cursor saturation) or a per-invocation
// safety cap. Resumable via the durable cursor. Prints by-category metrics.
//
// Usage:
//   CATEGORY=camera MAX_BATCHES=50 npx tsx scripts/tps-matcher/run-progressive.ts
//   CATEGORY=all    MAX_BATCHES=40 npx tsx scripts/tps-matcher/run-progressive.ts
//   LIMIT=500 (per-run observation bound, ≤500)
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { runProgressiveUnit } from "../tps-core/progressive-engine";
import { CATEGORY_DEFS } from "../tps-core/category-registry";
import { assertFingerprint } from "../tps-core/tps-batch";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const EXPECTED = "vyceqrzttspyycdpojtn";

async function runCategory(sb: ReturnType<typeof createClient>, category: string, maxBatches: number, limit: number) {
  const agg = { batches: 0, fetched: 0, detected: 0, valid: 0, lowConfidence: 0, invalid: 0, corroborated: 0, canonicalsWritten: 0, prices: 0 };
  for (let b = 0; b < maxBatches; b++) {
    const r = await runProgressiveUnit(sb, category, limit);
    agg.batches++;
    agg.fetched += r.normalize.fetched; agg.detected += r.normalize.detected; agg.valid += r.normalize.valid;
    agg.lowConfidence += r.normalize.lowConfidence; agg.invalid += r.normalize.invalid;
    agg.corroborated = r.corroborate.corroborated; // latest (cumulative view for touched keys)
    agg.canonicalsWritten += r.corroborate.canonicalsWritten; agg.prices += r.corroborate.prices;
    if (r.normalize.saturated) { console.log(`  [${category}] SATURATED after ${agg.batches} batches (backlog exhausted)`); break; }
    if (b % 10 === 9) console.log(`  [${category}] batch ${agg.batches}: fetched=${agg.fetched} valid=${agg.valid} written(cum)=${agg.canonicalsWritten}`);
  }
  return agg;
}

(async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("no supabase env");
  assertFingerprint(SUPABASE_URL, EXPECTED);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const which = process.env.CATEGORY || "all";
  const maxBatches = Number(process.env.MAX_BATCHES || 40);
  const limit = Math.min(500, Number(process.env.LIMIT || 500));
  const cats = which === "all" ? Object.keys(CATEGORY_DEFS) : [which];
  console.log(`Progressive batching — categories=[${cats.join(",")}] maxBatches=${maxBatches} limit=${limit}`);
  const results: Record<string, unknown> = {};
  for (const c of cats) {
    if (!CATEGORY_DEFS[c]) { console.log(`  skip unknown ${c}`); continue; }
    console.log(`\n=== ${c} ===`);
    results[c] = await runCategory(sb, c, maxBatches, limit);
    console.log(`  [${c}] done:`, JSON.stringify(results[c]));
  }
  console.log("\n=== SUMMARY ===");
  console.table(results);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
