// src/app/api/cron/product-recovery/route.ts — Truth Hardening Final Closure mission
// (2026-09-05), ADR-292. The async worker half of demand-driven catalog recovery.
//
// REAL SHOPPER QUERY -> local search -> CATALOG_MISSING -> a durable
// product_recovery_requests row (src/app/api/search/route.ts, fire-and-forget insert) ->
// THIS route (driven by scripts/scheduler.js the same way every other background loop
// already is, never by customer traffic directly) -> ONE approved provider search-scraper
// at a time (src/lib/scraping/search/ — the SAME code POST /api/search/scrape already runs
// in this exact Next.js runtime, proven safe) -> a light plausibility check (accessory
// rejection + every significant query token present in the candidate title) -> a SINGLE
// raw_observations row via IngestionService.ingestBatch (the SAME append-only write path
// every other ingestion loop uses).
//
// DELIBERATELY DOES NOT build a canonical_products row directly. The real TPS identity/
// corroboration decision (scripts/tps-core/category-registry.ts's plugin normalize/
// buildIdentityKey/requireValidTier) stays 100% owned by the EXISTING, unchanged, hourly
// refresh-intelligence.ts chain that scripts/scheduler.js already runs (ADR-067) — this
// worker never re-derives identity logic in a second, untested code path, and never runs
// concurrently with that chain (ADR-099: never run heavy pipeline writers concurrently with
// the scheduler — ingestBatch's raw_observations insert is the SAME lightweight, safe
// operation every ingestion loop already performs continuously alongside the scheduler).
// This makes recovery FUTURE-JOURNEY, not current-journey — the safest available v1
// architecture, not a convenience shortcut. See ADR-292 for the full comparison.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { SCRAPERS } from '@/lib/scraping/search/search-orchestrator';
import { hasAccessoryHint } from '@/app/api/search/route';
import { IngestionService } from '@/lib/scraping/services/ingestion-service';
import { normalizeArabic } from '@/lib/search/arabic-normalize';
import type { SearchProduct } from '@/lib/scraping/search/types';

export const maxDuration = 120;

// Part 9 — provider cascade order, not "query every provider by default". Chosen from the
// existing STORE_TIMEOUTS table (search-orchestrator.ts): the three fastest, most reliable
// approved fetch+cheerio scrapers (no Puppeteer latency). SWSG excluded here even though
// approved — its own documented Bunny Shield JS-challenge outage (memory: 2026-08-25) makes
// it a poor first-cascade candidate; noon/almanea excluded from THIS cascade for the same
// "richest-signal-first" reasoning (a future pass can widen this with real yield evidence,
// not guessed — Part 9's own "measured evidence should determine provider order").
const PROVIDER_CASCADE = ['jarir', 'extra', 'amazon'] as const;
const MAX_ATTEMPTS_BEFORE_PERMANENT_FAILURE = 3;
const BATCH_SIZE = 5;

// Generic stopwords stripped before the plausibility check — the SAME class of word this
// codebase's own PREFERENCE_WRAPPER/STOPWORDS sets already exclude from literal title
// matching (search/route.ts), kept minimal and local here since this check only needs to
// avoid requiring trivial function words, not replicate that file's full vocabulary.
const GENERIC_TOKENS = new Set(['ابي', 'ابغى', 'اريد', 'احتاج', 'من', 'في', 'على', 'the', 'a', 'an', 'for', 'in']);

export function significantTokens(text: string): string[] {
  // normalizeArabic folds hamza/ة/ى/digit variants but does not touch Latin case — lowercase
  // explicitly so a query's "Galaxy" matches a candidate title's "galaxy".
  return normalizeArabic(text).toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !GENERIC_TOKENS.has(t));
}

/** Part 3/10 plausibility gate — NOT full TPS identity validation (deliberately; see file
 *  header). Rejects accessories outright; requires every significant query token to appear
 *  in the candidate's own title, the same "constraint language is not the only thing that
 *  must match" precision-over-recall discipline the search route's own relevanceGroups gate
 *  already applies to ordinary search results. */
export function isPlausibleCandidate(candidate: SearchProduct, queryTokens: string[]): boolean {
  if (hasAccessoryHint(candidate.name_ar || '', candidate.name_en || '')) return false;
  const hay = normalizeArabic(`${candidate.name_ar || ''} ${candidate.name_en || ''} ${candidate.brand || ''}`).toLowerCase();
  return queryTokens.every((t) => hay.includes(t));
}

async function lookupStoreId(storeSlug: string): Promise<number | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('stores').select('id').eq('slug', storeSlug).maybeSingle();
  return (data as { id?: number } | null)?.id ?? null;
}

interface RecoveryRow {
  id: string;
  dedup_key: string;
  category: string;
  raw_query: string;
  normalized_query: string;
  attempt_count: number;
  provider_attempts: Array<{ store: string; outcome: string; at: string }>;
}

// product_recovery_requests is not yet in the generated Supabase types (migration 49) —
// same untyped-table pattern already used throughout command-center-queries.ts for this
// exact reason, not a new workaround.
type UntypedClient = { from: (table: string) => any };

async function processOne(supabase: UntypedClient, row: RecoveryRow) {
  await supabase.from('product_recovery_requests').update({
    status: 'PROCESSING', attempt_count: row.attempt_count + 1, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', row.id);

  const queryTokens = significantTokens(row.raw_query);
  const attempts: Array<{ store: string; outcome: string; at: string }> = [...(row.provider_attempts || [])];
  let finalStatus: string = 'NO_PROVIDER_RESULT';
  let lastError: string | null = null;

  for (const store of PROVIDER_CASCADE) {
    const at = new Date().toISOString();
    try {
      const scraper = SCRAPERS[store]();
      const { products, error } = await scraper.search({ query: row.raw_query, pages: 1 });
      if (error) { attempts.push({ store, outcome: `error:${error}`, at }); continue; }
      const candidate = (products || []).find((p) => isPlausibleCandidate(p, queryTokens));
      if (!candidate) { attempts.push({ store, outcome: 'no_plausible_candidate', at }); continue; }

      const storeId = await lookupStoreId(store);
      if (storeId == null) { attempts.push({ store, outcome: 'store_id_unresolved', at }); continue; }

      const ingestion = new IngestionService();
      const saved = await ingestion.ingestBatch(store, [candidate], storeId, null);
      attempts.push({ store, outcome: saved > 0 ? 'candidate_ingested' : 'ingest_failed', at });
      if (saved > 0) { finalStatus = 'RECOVERED'; break; }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      attempts.push({ store, outcome: `exception:${lastError}`, at });
    }
  }

  if (finalStatus !== 'RECOVERED' && lastError) {
    finalStatus = row.attempt_count + 1 >= MAX_ATTEMPTS_BEFORE_PERMANENT_FAILURE ? 'PERMANENT_FAILURE' : 'RETRYABLE_FAILURE';
  }

  await supabase.from('product_recovery_requests').update({
    status: finalStatus, provider_attempts: attempts, last_error: lastError, updated_at: new Date().toISOString(),
  }).eq('id', row.id);

  return { id: row.id, status: finalStatus, attempts: attempts.length };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient() as unknown as UntypedClient;
  // PENDING first-come-first-served, plus RETRYABLE_FAILURE rows still under the attempt
  // ceiling (Part 8's bounded retry) — never a terminal row (RECOVERED/NO_PROVIDER_RESULT/
  // REJECTED_PRODUCT_TRUTH/MATCH_EXISTING_CANONICAL/PERMANENT_FAILURE).
  const { data: rows, error } = await supabase
    .from('product_recovery_requests')
    .select('id, dedup_key, category, raw_query, normalized_query, attempt_count, provider_attempts')
    .in('status', ['PENDING', 'RETRYABLE_FAILURE'])
    .lt('attempt_count', MAX_ATTEMPTS_BEFORE_PERMANENT_FAILURE)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ processed: 0, results: [] });

  const results = [];
  // Sequential, not parallel — this is a low-volume background worker (Part 19: bounded cost/
  // rate limits), not a customer-facing path; staggering across providers/requests keeps
  // provider load predictable, same discipline scripts/scheduler.js's own STAGGER_MS uses.
  for (const row of rows as RecoveryRow[]) {
    results.push(await processOne(supabase, row));
  }
  return NextResponse.json({ processed: results.length, results });
}

export async function GET() {
  return NextResponse.json({
    status: 'ok', route: '/api/cron/product-recovery', method: 'POST required',
    auth: 'Authorization: Bearer <CRON_SECRET>',
  });
}
