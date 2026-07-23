// scripts/tps-core/sync-search-index.ts
// Rebuild the owned TPS search index from `tps_product_projection` and stamp
// `algolia_synced_at`. A thin, independently-runnable wrapper so the refresh
// orchestrator (ADR-062) can invoke it as a normal step and isolate its failure
// — a missing Algolia credential must fail the SEARCH step alone, never the
// whole intelligence chain.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { syncTpsIndex } from "../tps-algolia-sync";

(async () => {
  const r = await syncTpsIndex();
  console.log(`index=${r.index} synced=${r.synced} stamped=${r.stamped}`);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
