// scripts/sync-tps-projection-to-algolia.ts
// TPS Layer 5 — Algolia Sync (Production Ready)
// algoliasearch v5 compatible
// يقرأ من: tps_product_projection (has_comparison=true)
// يكتب في: tawveeri_tps_products
// يحدّث: algolia_synced_at في Supabase بعد النجاح

import { createClient } from "@supabase/supabase-js";
import { algoliasearch } from "algoliasearch";

// ── Config ────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ALGOLIA_APP   = process.env.ALGOLIA_APP_ID!;
const ALGOLIA_ADMIN = process.env.ALGOLIA_ADMIN_KEY!;
const INDEX_NAME    = "tawveeri_tps_products";
const BATCH_SIZE    = 500;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const algolia  = algoliasearch(ALGOLIA_APP, ALGOLIA_ADMIN);

// ── buildAlgoliaRecord ────────────────────────────────────────
function buildAlgoliaRecord(p: any): Record<string, unknown> {
  return {
    objectID:            p.tps_identity_key,
    tps_identity_key:    p.tps_identity_key,
    canonical_id:        p.canonical_id,
    display_name_ar:     p.display_name_ar ?? "",
    display_name_en:     p.display_name_en ?? "",
    brand:               p.brand ?? "",
    category:            p.category ?? "",
    lowest_price:        Number(p.lowest_price)     || 0,
    highest_price:       Number(p.highest_price)    || 0,
    saving:              Number(p.saving)            || 0,
    price_spread_pct:    Number(p.price_spread_pct) || 0,
    cheapest_store:      p.cheapest_store ?? "",
    store_count:         Number(p.store_count)       || 0,
    has_comparison:      Boolean(p.has_comparison),
    compare_url:         p.compare_url ?? "",
    identity_confidence: Number(p.identity_confidence) || 0,
    text_for_search:     p.text_for_search ?? "",
    source:              "tps",
    built_at:            p.updated_at ?? new Date().toISOString(),
  };
}

// ── syncBatch ─────────────────────────────────────────────────
async function syncBatch(
  records: Record<string, unknown>[],
  batchNum: number,
  total: number
): Promise<{ success: number; failed: number }> {
  try {
    // v5: saveObjects بدون initIndex، بدون waitForTasks
    await algolia.saveObjects({
      indexName: INDEX_NAME,
      objects:   records,
    });
    console.log(`  ✓ Batch ${batchNum}/${total} — ${records.length} records`);
    return { success: records.length, failed: 0 };
  } catch (err: any) {
    console.error(`  ✗ Batch ${batchNum}/${total} FAILED:`, err.message);
    const failedIDs = records.map(r => r.objectID).join(", ");
    console.error(`    Failed IDs: ${failedIDs}`);
    return { success: 0, failed: records.length };
  }
}

// ── updateSyncedAt ────────────────────────────────────────────
async function updateSyncedAt(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("tps_product_projection")
    .update({ algolia_synced_at: new Date().toISOString() })
    .in("tps_identity_key", ids);
  if (error) console.warn("  ⚠ algolia_synced_at update failed:", error.message);
  else       console.log(`  ✓ algolia_synced_at updated for ${ids.length} records`);
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`TPS → Algolia Sync | Index: ${INDEX_NAME}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── Step 1: قراءة الـ Projection ─────────────────────────────
  // INCIDENT FOLLOW-UP (2026-08-28): a plain .select() caps at Supabase's default
  // 1000-row page size. With 1,341 has_comparison=true rows (measured this same day),
  // this silently dropped ~25% of the comparison-eligible catalog from every sync —
  // which product/order was arbitrary rather than deterministic, since a bulk
  // build-tps-projection.ts upsert gives every row nearly-identical updated_at values,
  // so the "first 1000 by updated_at desc" tie-break could exclude any given product on
  // any given run. Paginate explicitly so a full sync always covers every eligible row.
  console.log("Step 1: Reading tps_product_projection...");
  const PAGE = 1000;
  const projections: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: dbErr } = await supabase
      .from("tps_product_projection")
      .select("*")
      .eq("has_comparison", true)
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (dbErr) { console.error("DB read failed:", dbErr); process.exit(1); }
    if (!page || page.length === 0) break;
    projections.push(...page);
    if (page.length < PAGE) break;
  }

  console.log(`  Found ${projections.length} records`);

  if (!projections.length) {
    console.log("\n⚠ Nothing to sync. Run build-tps-projection.ts first.");
    process.exit(0);
  }

  // ── Step 2: بناء الـ Records ──────────────────────────────────
  console.log("\nStep 2: Building Algolia records...");
  const records = projections.map(buildAlgoliaRecord);
  records.forEach(r => {
    console.log(`  → ${r.objectID}`);
    console.log(`    ${r.display_name_ar || r.display_name_en}`);
    console.log(`    lowest: ${r.lowest_price} SAR | stores: ${r.store_count} | spread: ${r.price_spread_pct}%`);
  });

  // ── Step 3: Batch Sync ────────────────────────────────────────
  console.log(`\nStep 3: Syncing in batches of ${BATCH_SIZE}...`);
  let totalSuccess = 0, totalFailed = 0;
  const syncedKeys: string[] = [];

  const batches: Record<string, unknown>[][] = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE)
    batches.push(records.slice(i, i + BATCH_SIZE));

  for (let i = 0; i < batches.length; i++) {
    const { success, failed } = await syncBatch(batches[i], i + 1, batches.length);
    totalSuccess += success;
    totalFailed  += failed;
    if (success > 0)
      syncedKeys.push(...batches[i].map(r => String(r.objectID)));
  }

  // ── Step 4: تحديث Supabase ────────────────────────────────────
  if (syncedKeys.length) {
    console.log("\nStep 4: Updating algolia_synced_at in Supabase...");
    await updateSyncedAt(syncedKeys);
  }

  // ── Summary ───────────────────────────────────────────────────
  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Synced  : ${totalSuccess}/${projections.length}`);
  console.log(`  Failed  : ${totalFailed}`);
  console.log(`  Duration: ${duration}s`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!totalFailed) {
    console.log(`\n✅ Done! Check Algolia Dashboard → ${INDEX_NAME}`);
    console.log(`   Search: "WindFree" | "مكيف سامسونج" | "حار وبارد" | "20000"`);
  } else {
    console.log(`\n⚠ ${totalFailed} records failed. Re-run to retry.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("\n✗ Error:", err.message);
  process.exit(1);
});