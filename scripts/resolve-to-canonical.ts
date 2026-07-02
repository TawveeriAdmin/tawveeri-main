// scripts/resolve-to-canonical.ts
// TPS Layer 2 — Canonical Resolution
// يقرأ: identity_resolution_events (merge + rules + confidence=100)
// يتحقق: أكثر من متجر واحد في المجموعة
// يكتب: canonical_products + product_matches
// لا يلمس: products, product_stores, normalized_product_observations

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TPS_VERSION = "1.0";

async function main() {
 console.log("Layer 2 — Canonical Resolution");
 console.log("Reading merge events...\n");

 // ── الخطوة 1: كل MERGE بثقة 100% من القواعد ──────────────
 const { data:events, error:evErr } = await supabase
   .from("identity_resolution_events")
   .select("id, identity_key, observation_ids, confidence, evidence, resolution_rule")
   .eq("resolution", "merge")
   .eq("resolved_by", "rules")
   .eq("confidence", 100);

 if (evErr||!events) { console.error("Failed to read events:", evErr); process.exit(1); }
 console.log(`Found ${events.length} merge events with confidence=100`);

 let created=0, skipped=0, matched=0, errors=0;

 for (const event of events) {
   // ── الخطوة 2: observations لهذا event ────────────────────
   const { data:obs, error:obsErr } = await supabase
     .from("normalized_product_observations")
     .select("id, source_record_id, store_id, raw_name, brand, detected_category, identity_key, normalized_payload, confidence, raw_payload, model_number")
     .in("id", event.observation_ids);

   if (obsErr||!obs||obs.length===0) {
     console.error(`  ✗ [${event.identity_key}] Failed to load observations`);
     errors++; continue;
   }

   // ── الخطوة 3: تحقق من أكثر من متجر واحد ─────────────────
   const stores = [...new Set(obs.map((o:any) => o.store_id).filter(Boolean))];
   if (stores.length < 2) {
     console.log(`  ⏭ [${event.identity_key}] Skipped — same store only (${stores[0]})`);
     skipped++; continue;
   }

   console.log(`\n  ✅ [${event.identity_key}]`);
   console.log(`     Stores: ${stores.join(" + ")}`);
   console.log(`     Observations: ${obs.length}`);

   // ── الخطوة 4: هل يوجد canonical لهذا identity_key؟ ───────
   const { data:existing } = await supabase
     .from("canonical_products")
     .select("id")
     .eq("tps_identity_key", event.identity_key)
     .maybeSingle();

   let canonicalId: string;

   if (existing) {
     canonicalId = existing.id;
     console.log(`     Canonical: existing [${canonicalId}]`);
   } else {
     // ── الخطوة 5: أنشئ canonical جديد ───────────────────────
     const best = [...obs].sort((a:any,b:any) => b.confidence - a.confidence)[0] as any;
     const payload = best.normalized_payload || {};
     const raw     = best.raw_payload || {};

     const attributes: Record<string,any> = { ...payload };

     // ── طباعة ما سنحاول إدخاله للتشخيص ──────────────────────
     const insertData = {
       name_ar:             raw.name_ar || best.raw_name,
       name_en:             raw.name_en || best.raw_name,
       brand:               best.brand,
       category:            best.detected_category,
       model_number:        best.model_number || null,
       attributes:          attributes,
       tps_identity_key:    event.identity_key,
       tps_version:         TPS_VERSION,
       is_active:           true,
       identity_confidence: event.confidence,
     };
     console.log(`     Inserting:`, JSON.stringify(insertData, null, 2));

     const { data:newCanonical, error:createErr } = await supabase
       .from("canonical_products")
       .insert(insertData)
       .select("id")
       .single();

     if (createErr||!newCanonical) {
       // ── الخطأ الكامل ──────────────────────────────────────
       console.error(`     ✗ Failed to create canonical:`, {
         code:    createErr?.code,
         message: createErr?.message,
         details: createErr?.details,
         hint:    createErr?.hint,
       });
       errors++; continue;
     }

     canonicalId = (newCanonical as any).id;
     console.log(`     Canonical: created [${canonicalId}]`);
     created++;
   }

   // ── الخطوة 6: product_matches لكل observation ─────────────
   for (const o of obs as any[]) {
     const { data:existingMatch } = await supabase
       .from("product_matches")
       .select("id")
       .eq("raw_observation_id", o.id)
       .eq("canonical_product_id", canonicalId)
       .maybeSingle();

     if (existingMatch) continue;

     const { error:matchErr } = await supabase
       .from("product_matches")
       .insert({
         raw_observation_id:   o.id,
         canonical_product_id: canonicalId,
         match_method:         "rules",
         confidence:           event.confidence,
         is_verified:          false,
         matched_at:           new Date().toISOString(),
       });

     if (matchErr) {
       console.error(`     ✗ product_matches failed:`, {
         code:    matchErr?.code,
         message: matchErr?.message,
         details: matchErr?.details,
         hint:    matchErr?.hint,
       });
       errors++;
     } else {
       matched++;
     }
   }
 }

 // ── Summary ────────────────────────────────────────────────
 console.log(`\n── Layer 2 Results ──────────────────────`);
 console.log(`  Merge events processed : ${events.length}`);
 console.log(`  Canonical created      : ${created}`);
 console.log(`  Skipped (same store)   : ${skipped}`);
 console.log(`  product_matches written: ${matched}`);
 console.log(`  Errors                 : ${errors}`);

 console.log(`\nVerify in Supabase:`);
 console.log(`
SELECT id, name_ar, brand, category, tps_identity_key, identity_confidence
FROM canonical_products
WHERE tps_identity_key IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;`);
}

main().catch(console.error);