// scripts/write-observations.ts
// Normalizer v9.0.1 — Bug Fix: ac_type=null → invalid (no "unknown" in identity key)
// لا دمج. لا تعديل. لا identity_resolution.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NORMALIZER_VERSION = "v9.0.1";
const TPS_VERSION = "1.0";
const BATCH_SIZE = 100;

type Category = "mobile" | "ac" | "refrigerator" | "tablet" | "accessory" | "unknown";
type Language  = "ar" | "en" | "mixed";
type KeyStatus = "valid" | "low_confidence_candidate" | "invalid";

const CAT_SIGNALS: Record<Category, string[]> = {
 mobile:       ["ايفون","iphone","جالاكسي","galaxy","جوال","هاتف","زد فليب","z flip","z fold","ايدج","edge","s25","s24","s23","a57","a55","fe","إف إي"],
 ac:           ["مكيف","تكييف","split ac","air conditioner","btu","وحدة","ويند فري","windfree","سبليت"],
 refrigerator: ["ثلاجة","refrigerator","fridge","freezer","cu.ft","cu ft","cuft","side by side","french door","bespoke","twin cooling"],
 tablet:       ["تاب","tab","آيباد","ipad","بوصة"],
 accessory:    ["holder","حامل","كابل","cable","شاحن","charger","case","كفر"],
 unknown:      [],
};

function detectCategory(name: string): Category {
 const lower = name.toLowerCase();
 const scores: Partial<Record<Category,number>> = {};
 for (const [cat,sigs] of Object.entries(CAT_SIGNALS) as [Category,string[]][]) {
   if (cat==="unknown") continue;
   for (const s of sigs) if (lower.includes(s)) scores[cat]=(scores[cat]||0)+1;
 }
 if ((scores.refrigerator||0)>=1) return "refrigerator";
 const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
 return sorted.length&&sorted[0][1]>0 ? sorted[0][0] as Category : "unknown";
}

function detectLanguage(name: string): Language {
 const ar=(name.match(/[\u0600-\u06FF]/g)||[]).length;
 const en=(name.match(/[a-zA-Z]/g)||[]).length;
 if (ar>0&&en>0) return "mixed";
 return ar>en?"ar":"en";
}

const BRAND_MAP: Record<string,string> = {
 "ابل":"Apple","apple":"Apple",
 "سامسونج":"Samsung","samsung":"Samsung",
 "يوجرين":"Ugreen","ugreen":"Ugreen",
 "lg":"LG","ال جي":"LG",
 "شاومي":"Xiaomi","xiaomi":"Xiaomi",
};
const normalizeBrand = (raw:string|null) =>
 !raw ? null : (BRAND_MAP[raw.trim().toLowerCase()] || BRAND_MAP[raw.trim()] || raw.trim());

function extractStorageAndRam(name:string): {storage_gb:number|null; ram_gb:number|null} {
 let storage:number|null=null, ram:number|null=null;
 const dual=name.match(/(\d+)\s*جيجا[\u060C,]\s*(\d+)\s*جيجا/);
 if (dual) {
   const a=parseInt(dual[1]), b=parseInt(dual[2]);
   return { storage_gb:Math.max(a,b), ram_gb:Math.min(a,b) };
 }
 const ramEx=name.match(/ذاكرة\s+(\d+)\s*جيجابايت\s*رام/i)
           ||name.match(/(\d+)\s*(?:جيجابايت|جيجا)\s*رام/i);
 if (ramEx) ram=parseInt(ramEx[1]);
 const stoEx=name.match(/(?:سعة\s*تخزين|تخزين)\s+(\d+)\s*(?:جيجابايت|جيجا)/i);
 if (stoEx) return { storage_gb:parseInt(stoEx[1]), ram_gb:ram };
 const gbAr=name.match(/(\d+)\s*جيجابايت(?!\s*رام)/i);
 if (gbAr) return { storage_gb:parseInt(gbAr[1]), ram_gb:ram };
 const giga=name.match(/(\d+)\s*جيجا(?!\s*(?:بايت|ي))/);
 if (giga) { const v=parseInt(giga[1]); if(v>=32&&v<=2048) storage=v; }
 if (!storage) {
   const gbEn=name.match(/(\d+)\s*[Gg][Bb]/);
   if (gbEn) { const v=parseInt(gbEn[1]); if(v>=32&&v<=2048) storage=v; }
 }
 return { storage_gb:storage, ram_gb:ram };
}

const COLORS_AR=["وردي","اخضر","أخضر","أسود","ابيض","أبيض","فضي","ذهبي","ازرق","أزرق","أزرق فاتح","أزرق داكن","رمادي","بنفسجي","اصفر","أصفر","تيتانيوم"];
const COLORS_EN=["pink","green","black","white","silver","gold","blue","gray","purple","yellow","titanium"];
const IGNORED_T=["5 جي","5g","شريحتين","dual sim","جديد","new","أصلي","ضمان","warranty"];

function normalizeMobile(name:string, brand:string|null) {
 const lower=name.toLowerCase();
 let color:string|null=null;
 const ignored:string[]=[];
 for (const c of [...COLORS_AR,...COLORS_EN])
   if (name.includes(c)) { color=c; ignored.push(c); break; }
 let network:string|null=null;
 if (lower.includes("5g")||name.includes("5 جي")||name.includes("الجيل الخامس"))
   { network="5G"; ignored.push("5G"); }
 const { storage_gb, ram_gb }=extractStorageAndRam(name);
 let family:string|null=null, generation:string|null=null, variant:string|null=null;
 const nb=normalizeBrand(brand);
 if (nb==="Apple") {
   family="iPhone";
   const m=name.match(/(?:ايفون|iphone)\s*(\d+)\s*(pro\s*max|pro|plus|mini)?/i);
   if (m) { generation=m[1]; variant=m[2]?m[2].trim().replace(/\b\w/g,c=>c.toUpperCase()):"Standard"; }
 }
 if (nb==="Samsung") {
   const s=name.match(/(?:جالاكسي|galaxy)\s+(?:إس|اس|s)\s*(\d+)\s*(إف إي|fe|ultra|ايدج|edge|plus|\+)?/i);
   if (s) {
     family="Galaxy S"; generation=`S${s[1]}`;
     const v=s[2]?.trim().toLowerCase();
     variant=!v?"Standard":(v.includes("إف إي")||v==="fe")?"FE":v.includes("ultra")?"Ultra":(v.includes("ايدج")||v==="edge")?"Edge":(v.includes("plus")||v==="+")?"Plus":"Standard";
   }
   const zf=name.match(/(?:زد فليب|z flip)\s*(\d+)/i);
   if (zf) { family="Galaxy Z"; generation=`Z Flip ${zf[1]}`; variant="Flip"; }
   const za=name.match(/(?:جالاكسي|galaxy)\s+[Aa](\d+)/i);
   if (za) { family="Galaxy A"; generation=`A${za[1]}`; variant="Standard"; }
 }
 for (const t of IGNORED_T)
   if (name.toLowerCase().includes(t.toLowerCase())&&!ignored.includes(t)) ignored.push(t);
 return { color, ignored, payload:{ family, generation, variant, storage_gb, ram_gb, network } };
}

function normalizeAC(name:string) {
 const lower=name.toLowerCase();
 let capacity_btu:number|null=null, technology:string|null=null,
     technology_inferred=false,
     compressor_type:string|null=null, series_or_platform:string|null=null,
     cooling_mode:string|null=null, model_number:string|null=null;

 // AC Type Detection — null إذا لم يُكتشف، لا نفترض split
 let ac_type: string|null = null;
 if (name.includes("شباك")||lower.includes("window"))
   ac_type="window";
 else if (name.includes("نقال")||lower.includes("portable")||lower.includes("mobile ac"))
   ac_type="portable";
 else if (name.includes("صحراوي")||lower.includes("evaporative")||lower.includes("desert cooler"))
   ac_type="evaporative";
 else if (name.includes("دولابي")||name.includes("دولاب")||lower.includes("cabinet")||lower.includes("floor standing"))
   ac_type="cabinet";
 else if (name.includes("كاسيت")||lower.includes("cassette"))
   ac_type="cassette";
 else if (name.includes("مخفي")||name.includes("مداخل")||lower.includes("ducted")||lower.includes("ceiling"))
   ac_type="ducted";
 else if (name.includes("سبليت")||name.includes("جداري")||lower.includes("split"))
   ac_type="split";

 // BTU
 const btu=name.match(/(\d[\d\s,]*)\s*(?:BTU|وحدة\s*حرارية|وحدة\s*تبريد|وحدة)/i);
 if (btu) capacity_btu=parseInt(btu[1].replace(/[\s,]/g,""));
 if (!capacity_btu) {
   const short=name.match(/\b(\d{2})\s*(?:وحدة\s*حرارية|وحدة\s*تبريد)/);
   if (short) { const v=parseInt(short[1]); if(v>=9&&v<=36) capacity_btu=v*1000; }
 }
 if (!capacity_btu) {
   const direct=name.match(/\b(\d{4,5})\b/g);
   if (direct) { for (const n of direct) { const v=parseInt(n); if(v>=9000&&v<=60000){capacity_btu=v;break;} } }
 }

 // Compressor
 if (lower.includes("rotary")||name.includes("روتاري")) compressor_type="Rotary";

 // Technology
 if (lower.includes("windfree")||name.includes("ويند فري")||name.includes("WindFree"))
   { series_or_platform="WindFree"; technology="Inverter"; }
 if (!technology) {
   if (lower.includes("triple inverter")) technology="Triple Inverter";
   else if (
     lower.includes("inverter")||name.includes("إنفرتر")||name.includes("انفرتر")||
     name.includes("كومبرسر انفرتر")||name.includes("ضاغط انفرتر")||
     name.includes("كومبرسر إنفرتر")||name.includes("ضاغط إنفرتر")
   ) technology="Inverter";
 }
 if (!technology && compressor_type==="Rotary") { technology="Standard"; technology_inferred=true; }

 // Cooling Mode
 if (
   name.includes("بارد وحار")||name.includes("حار بارد")||
   name.includes("بارد / حار")||name.includes("بارد/حار")||
   name.includes("ح ب")||
   lower.includes("hot and cold")||lower.includes("hot & cold")||
   lower.includes("heat & cool")||lower.includes("heat&cool")||
   lower.includes("hot/cold")||lower.includes("heat and cold")||
   lower.includes("heating and cooling")||lower.includes("cool & heat")
 ) cooling_mode="hot_cold";
 else if (
   name.includes("بارد فقط")||name.includes("تبريد فقط")||name.includes("تبريد")||
   lower.includes("cool only")||lower.includes("cold only")||
   lower.includes("cooling only")||lower.includes(", cold,")||
   lower.includes("cold wifi")
 ) cooling_mode="cool_only";
 else if (name.includes("بارد")&&!name.includes("حار"))
   cooling_mode="cool_only";

 // Model Number
 const model=name.match(/\b([A-Z]{2}\d+[A-Z0-9\/]+(?:\/[A-Z]{2})?)\b/);
 if (model) model_number=model[1];

 return {
   model_number, technology_inferred,
   payload:{ capacity_btu, technology, compressor_type, ac_type, series_or_platform, cooling_mode }
 };
}

function scoreConf(category:Category, brand:string|null, payload:Record<string,unknown>, model_number:string|null, flags:string[]) {
 const missing:string[]=[];
 if (category==="mobile") {
   if(!brand) missing.push("brand"); if(!payload.family) missing.push("family");
   if(!payload.generation) missing.push("generation"); if(!payload.variant) missing.push("variant");
   if(!payload.storage_gb) missing.push("storage_gb");
 } else if (category==="ac") {
   if(!brand) missing.push("brand"); if(!payload.capacity_btu) missing.push("capacity_btu");
   if(!payload.technology) missing.push("technology"); if(!payload.cooling_mode) missing.push("cooling_mode");
   if(!payload.ac_type) missing.push("ac_type");
 }
 const total=category==="mobile"?5:category==="ac"?5:0;
 let conf=total>0?Math.round(((total-missing.length)/total)*100):100;
 if (model_number) conf=Math.min(100,conf+5);
 if (flags.length) conf=Math.max(0,conf-5);
 return { confidence:conf, missing_critical:missing, needs_llm:missing.length>0||conf<85 };
}

function buildMobileKey(brand:string|null, p:Record<string,unknown>): {key:string|null;status:KeyStatus;reason?:string} {
 const nulls=["brand","family","generation","variant","storage_gb"]
   .filter(f=>(f==="brand"?brand:p[f])===null||(f==="brand"?brand:p[f])===undefined);
 if (nulls.length>0) return { key:null, status:"invalid", reason:`null in critical: ${nulls.join(", ")}` };
 return { key:`${brand}|${p.family}|${p.generation}|${p.variant}|${p.storage_gb}`, status:"valid" };
}

function buildACKey(brand:string|null, p:Record<string,unknown>, technology_inferred:boolean): {key:string|null;status:KeyStatus;reason?:string} {
 // ── Bug Fix v9.0.1: ac_type=null → invalid, no "unknown" in key ──
 if (!p.ac_type)
   return { key:null, status:"invalid", reason:"ac_type unknown — cannot build identity key" };

 const nulls=["capacity_btu","technology","cooling_mode"].filter(f=>p[f]===null||p[f]===undefined);
 if (!brand) nulls.unshift("brand");
 if (nulls.length>0) return { key:null, status:"invalid", reason:`null in critical: ${nulls.join(", ")}` };

 if (technology_inferred)
   return { key:`${brand}|${p.ac_type}|NO_SERIES|${p.capacity_btu}|${p.technology}|${p.cooling_mode}`,
            status:"low_confidence_candidate", reason:"technology inferred from compressor_type" };
 if (!p.series_or_platform)
   return { key:`${brand}|${p.ac_type}|NO_SERIES|${p.capacity_btu}|${p.technology}|${p.cooling_mode}`,
            status:"low_confidence_candidate", reason:"series_or_platform missing" };

 return { key:`${brand}|${p.ac_type}|${p.series_or_platform}|${p.capacity_btu}|${p.technology}|${p.cooling_mode}`,
          status:"valid" };
}

async function main() {
 console.log("Reading from canonical_products...");

 const { data:products, error } = await supabase
   .from("canonical_products")
   .select("id, name_ar, name_en, brand")
   .or("name_ar.ilike.%ايفون%,name_ar.ilike.%جالاكسي%,name_ar.ilike.%مكيف%,name_en.ilike.%iphone%,name_en.ilike.%galaxy%,name_en.ilike.%ac%")
   .limit(500);

 if (error||!products) { console.error("Read failed:", error); process.exit(1); }
 console.log(`Found ${products.length} products. Normalizing...`);

 const rows: object[] = [];
 let skipped = 0;

 for (const p of products) {
   const name = p.name_ar || p.name_en || "";
   if (!name) { skipped++; continue; }

   const category  = detectCategory(name);
   const language  = detectLanguage(name);
   const brand     = normalizeBrand(p.brand);

   let color:string|null=null, model_number:string|null=null;
   let payload:Record<string,unknown>={};
   let ignored:string[]=[];
   const ambiguity_flags:string[]=[];
   let keyResult:{key:string|null;status:KeyStatus;reason?:string}={key:null,status:"invalid",reason:"category not supported yet"};

   if (category==="mobile") {
     const r=normalizeMobile(name, p.brand);
     color=r.color; ignored=r.ignored; payload=r.payload;
     keyResult=buildMobileKey(brand, payload);
   } else if (category==="ac") {
     const r=normalizeAC(name);
     model_number=r.model_number; payload=r.payload;
     if (!payload.series_or_platform) ambiguity_flags.push("no_series_detected");
     if (r.technology_inferred) ambiguity_flags.push("inferred_standard_from_rotary");
     keyResult=buildACKey(brand, payload, r.technology_inferred);
   }

   const { confidence, missing_critical, needs_llm }=scoreConf(category, brand, payload, model_number, ambiguity_flags);

   rows.push({
     source_table:         "canonical_products",
     source_record_id:     p.id,
     canonical_product_id: p.id,
     raw_name:             name,
     raw_payload:          { name_ar:p.name_ar, name_en:p.name_en, brand:p.brand },
     detected_category:    category,
     language,
     brand,
     model_number,
     color,
     identity_key:         keyResult.key,
     identity_key_status:  keyResult.status,
     normalized_payload:   payload,
     confidence,
     missing_critical,
     ambiguity_flags,
     needs_llm,
     ignored_terms:        ignored,
     normalizer_version:   NORMALIZER_VERSION,
     tps_version:          TPS_VERSION,
   });
 }

 const batches: object[][] = [];
 for (let i=0; i<rows.length; i+=BATCH_SIZE)
   batches.push(rows.slice(i, i+BATCH_SIZE));

 console.log(`\nInserting ${rows.length} rows in ${batches.length} batches of ${BATCH_SIZE}...`);

 let successBatches=0, failedBatches=0, failedRows=0;

 for (let i=0; i<batches.length; i++) {
   const batch=batches[i];
   const { error:insertError }=await supabase
     .from("normalized_product_observations")
     .insert(batch);
   if (insertError) {
     failedBatches++; failedRows+=batch.length;
     console.error(`  ✗ Batch ${i+1}/${batches.length} FAILED: ${insertError.message}`);
   } else {
     successBatches++;
     console.log(`  ✓ Batch ${i+1}/${batches.length} OK (${batch.length} rows)`);
   }
 }

 console.log(`\n── Results ─────────────────────────────`);
 console.log(`  Total rows      : ${rows.length}`);
 console.log(`  Skipped         : ${skipped}`);
 console.log(`  Success batches : ${successBatches}/${batches.length}`);
 console.log(`  Failed batches  : ${failedBatches}`);
 console.log(`  Failed rows     : ${failedRows}`);
 console.log(`\nRun in Supabase SQL Editor:`);
 console.log(`
SELECT detected_category, identity_key_status, COUNT(*)
FROM normalized_product_observations
GROUP BY detected_category, identity_key_status
ORDER BY detected_category, identity_key_status;`);
}

main().catch(console.error);