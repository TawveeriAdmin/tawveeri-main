// src/lib/scraping/store-identity.ts
// ─────────────────────────────────────────────────────────────────────────────
// Canonical store identity — the single resolver for the whole platform.
//
// `stores.id` (integer) is the canonical store identity. It is immune to
// language, spelling and display-form drift, and it is a real foreign key.
//
// The mapping is derived from the `stores` table at runtime. There are no
// hardcoded name maps here and there must never be any: three previously
// existed (STORE_NAME_ALIASES in the health endpoint, STORE_SLUG_TO_NAME in
// IngestionService, and adapter `dbName`), and they disagreed with each other
// and with the data.
//
// `store_name` is retained on observation tables as provenance — the label the
// producer actually wrote. Nothing resolves identity from it.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from '@/lib/database';

export interface StoreRecord {
  id: number;
  slug: string;
  name: string | null;
}

const CACHE_TTL_MS = 5 * 60_000;

let cache: { records: StoreRecord[]; bySlug: Map<string, StoreRecord>; byId: Map<number, StoreRecord>; loadedAt: number } | null = null;

async function load(force = false): Promise<typeof cache> {
  if (!force && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;

  const supabase = createServerClient();
  const { data, error } = await (supabase as any).from('stores').select('id, slug, name');

  if (error || !data) {
    // Serve a stale cache rather than losing identity resolution entirely.
    if (cache) {
      console.error('[store-identity] refresh failed, serving stale cache:', error?.message);
      return cache;
    }
    console.error('[store-identity] load failed and no cache available:', error?.message);
    return null;
  }

  const records = data as StoreRecord[];
  cache = {
    records,
    bySlug: new Map(records.map((r) => [r.slug, r])),
    byId: new Map(records.map((r) => [r.id, r])),
    loadedAt: Date.now(),
  };
  return cache;
}

/** Canonical store id for a slug. Returns null if the slug is not registered. */
export async function resolveStoreId(slug: string): Promise<number | null> {
  const c = await load();
  return c?.bySlug.get(slug)?.id ?? null;
}

/** Canonical slug for a store id. */
export async function resolveStoreSlug(id: number): Promise<string | null> {
  const c = await load();
  return c?.byId.get(id)?.slug ?? null;
}

/** Display name for a store id — presentation only, never identity. */
export async function resolveStoreName(id: number): Promise<string | null> {
  const c = await load();
  return c?.byId.get(id)?.name ?? null;
}

/** The full registry. */
export async function getStoreRegistry(): Promise<StoreRecord[]> {
  const c = await load();
  return c?.records ?? [];
}

/** Drop the cache — used after the registry changes. */
export function invalidateStoreIdentityCache(): void {
  cache = null;
}
