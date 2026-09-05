-- 49-product-recovery-requests.sql — Async demand-driven catalog recovery (Truth Hardening
-- Final Closure mission, 2026-09-05, ADR-292).
--
-- REAL SHOPPER QUERY -> local search -> CATALOG_MISSING classification (src/lib/agent/
-- catalog-gap.ts) -> a durable row here -> async worker (POST /api/cron/product-recovery,
-- driven by scripts/scheduler.js the SAME way every other background loop already is) ->
-- approved provider search-scraper (src/lib/scraping/search/, already Next.js-proven —
-- POST /api/search/scrape already runs the identical code in this same runtime) -> a light
-- plausibility check (accessory rejection, requested brand/model tokens present in the
-- candidate title) -> raw_observations (append-only, safe — the SAME write path the feed/
-- scraper ingestion loops already use, via IngestionService.ingestBatch).
--
-- DELIBERATELY DOES NOT build a canonical_products row, a commercial variant, or an offer
-- directly. The real TPS identity/corroboration decision (category-registry.ts's plugin
-- normalize/buildIdentityKey, requireValidTier, corroboration) stays 100% owned by the
-- EXISTING, unchanged, hourly refresh-intelligence.ts chain (ADR-067) that already runs via
-- scripts/scheduler.js -- this worker never runs concurrently with it (ADR-099: never run
-- heavy pipeline writers concurrently with the scheduler) and never re-derives identity logic
-- in a second, untested code path. This makes recovery FUTURE-JOURNEY (the originating
-- shopper's own request does not wait for or receive the recovered product; a later
-- equivalent query does, once the next scheduled refresh cycle has run) -- the safest
-- available v1 architecture, not a convenience shortcut (see ADR-292 for the full comparison).
--
-- service_role only (same pattern as migration 44/46) -- no anon/authenticated grant, since
-- every read/write happens server-side (the search route's insert, the cron worker's
-- processing). RLS enabled per CLAUDE.md's standing rule even though the table holds no
-- customer PII (session_id is nullable and used only for provenance, never a join key back to
-- a person).

create table if not exists public.product_recovery_requests (
  id                 uuid primary key default gen_random_uuid(),
  -- Deterministic identity for idempotency (Part 8): normalized category + brand/model text,
  -- built by src/lib/agent/recovery-eligibility.ts's buildRecoveryDedupKey() -- the SAME
  -- normalization (normalizeArabic) the search route already uses, so "Galaxy S27 Ultra
  -- 512GB" and "galaxy s27 ultra 512gb" collapse to one request, not two.
  dedup_key          text not null,
  category           text not null,
  raw_query          text not null,
  normalized_query   text not null,
  -- Real/test provenance (Part 19) -- a TEST/internal search can never create a real
  -- recovery job; is_test rows are fully isolated and never processed by the live worker's
  -- default query (the worker explicitly filters is_test = false).
  is_test            boolean not null default false,
  status             text not null default 'PENDING'
    check (status in (
      'PENDING', 'PROCESSING', 'RECOVERED', 'NO_PROVIDER_RESULT',
      'REJECTED_PRODUCT_TRUTH', 'MATCH_EXISTING_CANONICAL',
      'RETRYABLE_FAILURE', 'PERMANENT_FAILURE'
    )),
  attempt_count      int not null default 0,
  -- One entry per provider tried this request's lifetime: {store, outcome, at}. Small,
  -- bounded (at most a handful of approved providers), never raw scraped payload (that goes
  -- to raw_observations only, via the normal ingestion contract).
  provider_attempts  jsonb not null default '[]'::jsonb,
  last_error         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_attempt_at    timestamptz
);

-- Idempotency (Part 8): the search route does a plain `insert ... on conflict (dedup_key) do
-- nothing` -- a repeated identical missing-model search can NEVER create a second job,
-- regardless of how many times it's searched. No cooldown/TTL/retry-reset logic in v1 --
-- a terminal row (RECOVERED/NO_PROVIDER_RESULT/REJECTED_PRODUCT_TRUTH/MATCH_EXISTING_CANONICAL/
-- PERMANENT_FAILURE) simply stays terminal; only RETRYABLE_FAILURE rows are picked up again
-- by the worker (bounded by attempt_count). Documented v1 limitation, not an oversight --
-- see ADR-292.
create unique index if not exists idx_product_recovery_dedup on product_recovery_requests (dedup_key);
create index if not exists idx_product_recovery_status on product_recovery_requests (status, created_at) where status in ('PENDING', 'RETRYABLE_FAILURE');

alter table public.product_recovery_requests enable row level security;
-- service_role only -- matches migration 44/46's own precedent exactly.
revoke all on public.product_recovery_requests from anon, authenticated;
