// scripts/tps-matcher/run-progressive.ts
// Driver: single-pass progressive SWEEP across all evidence-backed categories.
// One id-indexed scan over raw_observations (durable global per-store cursor),
// classifying each row through every category detector, staging + corroborating.
// Runs repeated ≤500-obs units until the scan is exhausted or a per-invocation
// safety cap. Resumable via the durable cursor. By-category metrics.
//
// Usage: MAX_BATCHES=300 LIMIT=500 npx tsx scripts/tps-matcher/run-progressive.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { runSweepUnit } from "../tps-core/progressive-engine";
import { CATEGORY_DEFS } from "../tps-core/category-registry";
import { assertFingerprint } from "../tps-core/tps-batch";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const EXPECTED = "vyceqrzttspyycdpojtn";

(async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("no supabase env");
  assertFingerprint(SUPABASE_URL, EXPECTED);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const defs = Object.values(CATEGORY_DEFS);
  const maxBatches = Number(process.env.MAX_BATCHES || 300);
  const limit = Math.min(500, Number(process.env.LIMIT || 500));
  console.log(`Progressive SWEEP — categories=[${defs.map((d) => d.category).join(",")}] maxBatches=${maxBatches} limit=${limit}`);

  const agg: Record<string, { detected: number; valid: number; written: number }> = {};
  for (const d of defs) agg[d.category] = { detected: 0, valid: 0, written: 0 };
  let totalFetched = 0, batches = 0;
  for (let b = 0; b < maxBatches; b++) {
    const r = await runSweepUnit(sb, defs, limit);
    batches++; totalFetched += r.normalize.fetched;
    for (const d of defs) {
      const cm = r.normalize.byCategory[d.category];
      agg[d.category].detected += cm.detected; agg[d.category].valid += cm.valid;
      agg[d.category].written += r.corroborate[d.category]?.canonicalsWritten ?? 0;
    }
    if (r.normalize.saturated) { console.log(`SATURATED after ${batches} batches, ${totalFetched} obs scanned`); break; }
    if (b % 20 === 19) console.log(`  batch ${batches}: scanned=${totalFetched} | ` + defs.map((d) => `${d.category}:v${agg[d.category].valid}`).join(" "));
  }
  console.log(`\n=== SWEEP SUMMARY (batches=${batches}, obs scanned=${totalFetched}) ===`);
  console.table(agg);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
