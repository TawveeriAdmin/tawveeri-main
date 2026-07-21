// scripts/tps-algolia-sync.ts
// E5 — Algolia Sync Restoration. Feeds the OWNED TPS index from
// tps_product_projection. Reproducible (atomic full rebuild via
// replaceAllObjects). Zero live-search impact until E14 cuts over to this index.
// Stamps tps_product_projection.algolia_synced_at.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { algoliasearch } from "algoliasearch";
import { createClient } from "@supabase/supabase-js";

const APP_ID = process.env.ALGOLIA_APP_ID || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "";
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY || "";
const INDEX = process.env.ALGOLIA_TPS_INDEX || "tawveeri_tps_products";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface ProjRow {
  canonical_id: string; tps_identity_key: string;
  display_name_ar: string | null; display_name_en: string | null;
  brand: string | null; category: string | null;
  lowest_price: number | null; highest_price: number | null; saving: number | null;
  price_spread_pct: number | null; cheapest_store: string | null;
  store_count: number | null; has_comparison: boolean | null;
  compare_url: string | null; image_url: string | null;
  identity_confidence: number | null; text_for_search: string | null;
}

export async function syncTpsIndex(): Promise<{ index: string; synced: number; stamped: number }> {
  if (!APP_ID || !ADMIN_KEY) throw new Error("missing ALGOLIA_APP_ID / ALGOLIA_ADMIN_KEY");
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("missing supabase env");
  const client = algoliasearch(APP_ID, ADMIN_KEY);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // Read the whole projection (paginated).
  let rows: ProjRow[] = [];
  for (let fromIdx = 0; ; fromIdx += 1000) {
    const { data, error } = await supabase.from("tps_product_projection").select("*").range(fromIdx, fromIdx + 999);
    if (error) throw new Error(`projection read: ${error.message}`);
    rows = rows.concat((data ?? []) as ProjRow[]);
    if (!data || data.length < 1000) break;
  }

  const objects = rows.map((r) => ({
    objectID: r.canonical_id,
    tps_identity_key: r.tps_identity_key,
    display_name_ar: r.display_name_ar, display_name_en: r.display_name_en,
    brand: r.brand, category: r.category,
    lowest_price: r.lowest_price, highest_price: r.highest_price, saving: r.saving,
    price_spread_pct: r.price_spread_pct, cheapest_store: r.cheapest_store,
    store_count: r.store_count, has_comparison: r.has_comparison,
    compare_url: r.compare_url, image_url: r.image_url,
    identity_confidence: r.identity_confidence, text_for_search: r.text_for_search,
  }));

  await client.setSettings({
    indexName: INDEX,
    indexSettings: {
      searchableAttributes: ["text_for_search", "display_name_ar", "display_name_en", "brand"],
      attributesForFaceting: ["searchable(category)", "searchable(brand)", "has_comparison", "cheapest_store"],
      customRanking: ["desc(has_comparison)", "desc(store_count)", "asc(lowest_price)"],
    },
  });

  // Atomic full rebuild — the index is always reproducible from the projection.
  await client.replaceAllObjects({ indexName: INDEX, objects, batchSize: 1000 });

  // Stamp sync time on the projection.
  const now = new Date().toISOString();
  const ids = rows.map((r) => r.canonical_id);
  let stamped = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from("tps_product_projection").update({ algolia_synced_at: now }).in("canonical_id", ids.slice(i, i + 200));
    if (!error) stamped += Math.min(200, ids.length - i);
  }
  return { index: INDEX, synced: objects.length, stamped };
}

if (require.main === module) {
  syncTpsIndex().then((r) => { console.log(JSON.stringify(r)); process.exit(0); })
    .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
