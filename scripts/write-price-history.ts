// scripts/write-price-history.ts
// TPS Layer 3 — Price History
// يقرأ: product_matches + normalized_product_observations
// يكتب: price_history فقط (append-only)
// لا يلمس: canonical_products, products, product_stores, raw_observation_id

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
 console.log("Layer 3 — Price History");
 console.log("Reading product_matches (confidence=100)...\n");

 // ── الخطوة 1: كل matches بثقة 100 ────────────────────────
 const { data:matches, error:mErr } = await supabase
   .from("product_matches")
   .select("id, canonical_product_id, raw_observation_id, confidence")
   .eq("confidence", 100)
   .not("canonical_product_id", "is", null);

 if (mErr||!matches) { console.error("Failed to read matches:", mErr); process.exit(1); }
 console.log(`Found ${matches.length} matches with confidence=100`);

 let inserted=0, skipped=0, errors=0;

 for (const match of matches as any[]) {
   // ── الخطوة 2: اجلب الـ observation ───────────────────────
   const { data:obs, error:obsErr } = await supabase
     .from("normalized_product_observations")
     .select("id, store_id, raw_payload")
     .eq("id", match.raw_observation_id)
     .maybeSingle();

   if (obsErr||!obs) {
     console.error(`  ✗ Observation not found for match ${match.id}`);
     errors++; continue;
   }

   const raw = obs.raw_payload || {};

   // استخراج السعر
   const priceRaw = raw.current_price;
   const price    = priceRaw ? parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) : null;

   if (!price || isNaN(price) || price <= 0) {
     console.log(`  ⏭ Skipped — no valid price for ${obs.store_id}`);
     skipped++; continue;
   }

   // ── الخطوة 3: تجنب التكرار (نفس المنتج + المتجر + السعر + اليوم)
   const today = new Date().toISOString().split("T")[0];
   const { data:existing } = await supabase
     .from("price_history")
     .select("id")
     .eq("canonical_product_id", match.canonical_product_id)
     .eq("store_name", obs.store_id)
     .eq("price", price)
     .gte("observed_at", `${today}T00:00:00Z`)
     .maybeSingle();

   if (existing) {
     console.log(`  ⏭ Already recorded today — ${obs.store_id} @ ${price}`);
     skipped++; continue;
   }

   // ── الخطوة 4: اكتب في price_history ──────────────────────
   const { error:insertErr } = await supabase
     .from("price_history")
     .insert({
       canonical_product_id: match.canonical_product_id,
       store_name:           obs.store_id,
       price:                price,
       original_price:       price,
       effective_price:      price,
       availability:         raw.availability || null,
       tps_observation_id:   obs.id,          // ← TPS traceability
       observed_at:          new Date().toISOString(),
     });

   if (insertErr) {
     console.error(`  ✗ Insert failed:`, {
       code:    insertErr.code,
       message: insertErr.message,
       details: insertErr.details,
       hint:    insertErr.hint,
     });
     errors++;
   } else {
     console.log(`  ✅ ${obs.store_id} → ${price} SAR`);
     inserted++;
   }
 }

 console.log(`\n── Layer 3 Results ──────────────────────`);
 console.log(`  Matches processed : ${matches.length}`);
 console.log(`  Price rows written: ${inserted}`);
 console.log(`  Skipped           : ${skipped}`);
 console.log(`  Errors            : ${errors}`);

 console.log(`\nVerify in Supabase:`);
 console.log(`
-- ١: أسعار لكل canonical
SELECT
 cp.name_ar,
 cp.tps_identity_key,
 COUNT(ph.id) as price_count,
 MIN(ph.price) as cheapest,
 MAX(ph.price) as most_expensive
FROM price_history ph
JOIN canonical_products cp ON cp.id = ph.canonical_product_id
WHERE ph.tps_observation_id IS NOT NULL
GROUP BY cp.id, cp.name_ar, cp.tps_identity_key
ORDER BY cp.tps_identity_key;

-- ٢: أرخص متجر لكل canonical
SELECT DISTINCT ON (ph.canonical_product_id)
 cp.name_ar,
 ph.store_name,
 ph.price
FROM price_history ph
JOIN canonical_products cp ON cp.id = ph.canonical_product_id
WHERE ph.tps_observation_id IS NOT NULL
ORDER BY ph.canonical_product_id, ph.price ASC;`);
}

main().catch(console.error);