// scripts/build-tps-projection.ts
// TPS Layer 5 — Build Projection v2
// يقرأ من: canonical_products + price_history
// يكتب في: tps_product_projection (upsert)
// لا يلمس affiliate_best_url — يُعبَّأ من سكربت مستقل لاحقاً

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("TPS Layer 5 — Building Projection v2...\n");

  const { data: canonicals, error: cpErr } = await supabase
    .from("canonical_products")
    .select("id, name_ar, name_en, brand, category, tps_identity_key, identity_confidence, attributes")
    .not("tps_identity_key", "is", null);

  if (cpErr || !canonicals) { console.error("Failed:", cpErr); process.exit(1); }
  console.log(`Found ${canonicals.length} canonical products`);

  let built = 0, errors = 0;

  for (const cp of canonicals as any[]) {
    try {
      const { data: prices } = await supabase
        .from("price_history")
        .select("store_name, price, observed_at")
        .eq("canonical_product_id", cp.id)
        .not("tps_observation_id", "is", null)
        .order("observed_at", { ascending: false })
        .limit(20);

      const latestByStore: Record<string, number> = {};
      for (const ph of (prices || [])) {
        if (!latestByStore[ph.store_name]) {
          latestByStore[ph.store_name] = parseFloat(ph.price);
        }
      }

      const storePrices = Object.entries(latestByStore)
        .map(([store, price]) => ({ store, price }))
        .filter(s => s.price > 0)
        .sort((a, b) => a.price - b.price);

      const lowestPrice   = storePrices[0]?.price ?? null;
      const highestPrice  = storePrices[storePrices.length - 1]?.price ?? null;
      const cheapestStore = storePrices[0]?.store ?? null;
      const storeCount    = storePrices.length;
      const hasComparison = storeCount >= 2;

      const saving = (lowestPrice && highestPrice && highestPrice > lowestPrice)
        ? parseFloat((highestPrice - lowestPrice).toFixed(2))
        : null;

      const priceSpreadPct = (lowestPrice && highestPrice && lowestPrice > 0)
        ? parseFloat((((highestPrice - lowestPrice) / lowestPrice) * 100).toFixed(2))
        : null;

      const compareUrl = cp.tps_identity_key
        ? `/ar/compare/${encodeURIComponent(cp.tps_identity_key)}`
        : null;

      // ── text_for_search ───────────────────────────────────────
      const attrs = cp.attributes || {};
      const attrText = [
        attrs.capacity_btu ? `${attrs.capacity_btu} BTU` : null,
        attrs.technology,
        attrs.cooling_mode === 'hot_cold' ? 'حار وبارد hot and cold' : null,
        attrs.cooling_mode === 'cool_only' ? 'بارد فقط cool only' : null,
        attrs.ac_type,
        attrs.series_or_platform,
        attrs.storage_gb ? `${attrs.storage_gb}GB` : null,
        attrs.family,
        attrs.generation,
        attrs.variant,
      ].filter(Boolean).join(" ");

      const textForSearch = [
        cp.name_ar,
        cp.name_en,
        cp.brand,
        cp.category,
        cheapestStore,
        lowestPrice ? `${lowestPrice} ريال` : null,
        attrText,
      ].filter(Boolean).join(" ");

      // ── Upsert — بدون affiliate_best_url ─────────────────────
      const { error: upsertErr } = await supabase
        .from("tps_product_projection")
        .upsert({
          canonical_id:        cp.id,
          tps_identity_key:    cp.tps_identity_key,
          display_name_ar:     cp.name_ar,
          display_name_en:     cp.name_en,
          brand:               cp.brand,
          category:            cp.category,
          lowest_price:        lowestPrice,
          highest_price:       highestPrice,
          saving,
          price_spread_pct:    priceSpreadPct,
          cheapest_store:      cheapestStore,
          store_count:         storeCount,
          compare_url:         compareUrl,
          has_comparison:      hasComparison,
          identity_confidence: cp.identity_confidence,
          text_for_search:     textForSearch,
          updated_at:          new Date().toISOString(),
        }, { onConflict: "tps_identity_key" });

      if (upsertErr) {
        console.error(`  ✗ [${cp.tps_identity_key}]:`, upsertErr.message);
        errors++;
      } else {
        console.log(`  ✅ ${cp.tps_identity_key}`);
        console.log(`     lowest: ${lowestPrice} | spread: ${priceSpreadPct}% | stores: ${storeCount}`);
        console.log(`     text: ${textForSearch.slice(0, 80)}...`);
        built++;
      }
    } catch (e: any) {
      console.error(`  ✗ Error:`, e.message);
      errors++;
    }
  }

  console.log(`\n── Results ──────────────────────────`);
  console.log(`  Projections built : ${built}`);
  console.log(`  Errors            : ${errors}`);

  console.log(`\nVerify:
SELECT
  tps_identity_key,
  display_name_ar,
  lowest_price,
  highest_price,
  price_spread_pct,
  saving,
  store_count,
  has_comparison,
  LEFT(text_for_search, 100) as text_preview
FROM tps_product_projection
ORDER BY updated_at DESC;`);
}

main().catch(console.error);