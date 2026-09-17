// scripts/worker/lib/store-sets.ts
//
// WHY (found live, 2026-09-17, during Stage 1 validation): scripts/scheduler.js
// computed its scraper-loop store list as INGEST_STORES MINUS whatever is in
// INGEST_FEED_STORES (ADR-089: "the _feedSet exclusion below guarantees no
// store is ever ingested by both paths"). Production's raw INGEST_STORES env
// var value includes 'almanea', which is ALSO in INGEST_FEED_STORES — the
// filter was the only thing keeping the old scheduler from ever actually
// scraping it. scripts/worker/jobs/price-update.ts and discovery.ts read the
// raw WORKER_INGEST_STORES value directly, without this filter, and stalled
// for 5+ minutes on 'almanea' during the first live validation run — it is
// not registered as a scraper target, only as a feed target. This
// reconstructs the same exclusion so both worker jobs behave exactly like
// the old scheduler.js did.
export function effectiveScraperStores(rawIngestStores: string, rawFeedStores: string): string[] {
  const feedSet = new Set(rawFeedStores.split(',').map((s) => s.trim()).filter(Boolean));
  return rawIngestStores.split(',').map((s) => s.trim()).filter(Boolean).filter((s) => !feedSet.has(s));
}
