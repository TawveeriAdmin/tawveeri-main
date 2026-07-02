// scripts/tps-test/shadow-run-ac.ts
// اختبار مستقل تماماً — قراءة فقط، صفر كتابة في قاعدة البيانات
// يقارن نتائج acPlugin الجديد بالكود القديم (normalizeAC + buildACKey + scoreConf)
// على نفس عينة الـ 538 منتج AC

import { createClient } from "@supabase/supabase-js";
import { acPlugin } from "../tps-plugins/ac";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── الكود القديم — منسوخ حرفياً من write-product-observations.ts ──
// (نفس normalizeAC + buildACKey + جزء AC من scoreConf، بدون أي تعديل)

const BRAND_MAP: Record<string,string> = {
  "ابل":"Apple","apple":"Apple","سامسونج":"Samsung","samsung":"Samsung",
  "ال جي":"LG","lg":"LG","هاير":"Haier","haier":"Haier","ميديا":"Midea","midea":"Midea",
  "هام":"Haam","haam":"Haam","هوني ويل":"Honeywell","honeywell":"Honeywell",
  "اكسبير":"Xper","xper":"Xper","سيمفوني":"Symphony","symphony":"Symphony",
  "كرافت":"Crafft","crafft":"Crafft","فيشر":"Fisher","fisher":"Fisher",
  "هايسينس":"Hisense","hisense":"Hisense","شاومي":"Xiaomi","xiaomi":"Xiaomi",
  "يوجرين":"Ugreen","ugreen":"Ugreen","أنكر":"Anker","anker":"Anker",
  "أسوس":"Asus","asus":"Asus","جري":"Gree","gree":"Gree",
  "كلفيناتور":"Kelvinator","kelvinator":"Kelvinator",
};
const normalizeBrandOld = (raw:string|null) =>
  !raw ? null : (BRAND_MAP[raw.trim().toLowerCase()] || BRAND_MAP[raw.trim()] || raw.trim());

function normalizeACOld(nameAr:string, nameEn:string) {
  const combined = (nameAr + " " + nameEn).toLowerCase();
  const fullText  = nameAr + " " + nameEn;
  let capacity_btu:number|null=null, technology:string|null=null,
      technology_inferred=false, compressor_type:string|null=null,
      series_or_platform:string|null=null, cooling_mode:string|null=null,
      model_number:string|null=null;

  let ac_type: string|null = null;
  if (combined.includes("شباك")||combined.includes("window"))              ac_type="window";
  else if (combined.includes("نقال")||combined.includes("portable"))       ac_type="portable";
  else if (combined.includes("صحراوي")||combined.includes("evaporative")||combined.includes("air cooler")) ac_type="evaporative";
  else if (combined.includes("دولابي")||combined.includes("cabinet")||combined.includes("floor standing")) ac_type="cabinet";
  else if (combined.includes("كاسيت")||combined.includes("cassette"))      ac_type="cassette";
  else if (combined.includes("مخفي")||combined.includes("ducted")||combined.includes("ceiling")) ac_type="ducted";
  else if (combined.includes("سبليت")||combined.includes("جداري")||combined.includes("split")) ac_type="split";

  const btu = fullText.match(/(\d[\d\s,]*)\s*(?:BTU|وحدة\s*حرارية|وحدة\s*تبريد|وحدة)/i);
  if (btu) capacity_btu=parseInt(btu[1].replace(/[\s,]/g,""));
  if (!capacity_btu) {
    const short = fullText.match(/\b(\d{2})\s*(?:وحدة\s*حرارية|وحدة\s*تبريد)/);
    if (short) { const v=parseInt(short[1]); if(v>=9&&v<=36) capacity_btu=v*1000; }
  }
  if (!capacity_btu) {
    const direct = fullText.match(/\b(\d{4,5})\b/g);
    if (direct) { for (const n of direct) { const v=parseInt(n); if(v>=9000&&v<=60000){capacity_btu=v;break;} } }
  }

  if (combined.includes("rotary")||combined.includes("روتاري")||combined.includes("راوتري"))
    compressor_type="Rotary";
  if (combined.includes("windfree")||combined.includes("ويند فري"))
    { series_or_platform="WindFree"; technology="Inverter"; }
  if (combined.includes("bespoke") && !series_or_platform)
    series_or_platform="Bespoke";
  if (!technology) {
    if (combined.includes("triple inverter")) technology="Triple Inverter";
    else if (
      combined.includes("inverter")||combined.includes("إنفرتر")||
      combined.includes("انفرتر")||combined.includes("كومبرسر انفرتر")||
      combined.includes("ضاغط انفرتر")
    ) technology="Inverter";
  }
  if (!technology && compressor_type==="Rotary") { technology="Standard"; technology_inferred=true; }

  if (
    combined.includes("بارد وحار")||combined.includes("حار بارد")||
    combined.includes("بارد / حار")||combined.includes("بارد/حار")||
    combined.includes("حار وبارد")||
    combined.includes("hot and cool")||combined.includes("hot and cold")||
    combined.includes("hot & cold")||combined.includes("heat & cool")||
    combined.includes("heat&cool")||combined.includes("hot/cold")||
    combined.includes("heating and cooling")||combined.includes("heat cool")
  ) cooling_mode="hot_cold";
  else if (
    combined.includes("بارد فقط")||combined.includes("تبريد فقط")||
    combined.includes("cool only")||combined.includes("cold only")||
    combined.includes("cooling only")
  ) cooling_mode="cool_only";
  else if (combined.includes("بارد")&&!combined.includes("حار")) cooling_mode="cool_only";
  else if (combined.includes("cold")&&!combined.includes("hot")&&!combined.includes("heat")) cooling_mode="cool_only";

  const model = fullText.match(/\b([A-Z]{2}\d+[A-Z0-9\/\-]+(?:\/[A-Z]{2})?)\b/);
  if (model) model_number=model[1];

  return { model_number, technology_inferred,
           payload:{ capacity_btu, technology, compressor_type, ac_type, series_or_platform, cooling_mode } };
}

function buildACKeyOld(brand:string|null, p:Record<string,unknown>, technology_inferred:boolean) {
  if (!p.ac_type) return { key:null, status:"invalid", reason:"ac_type unknown" };
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

function scoreConfOld(brand:string|null, payload:Record<string,unknown>, model_number:string|null, flags:string[]) {
  const missing:string[]=[];
  if(!brand) missing.push("brand"); if(!payload.capacity_btu) missing.push("capacity_btu");
  if(!payload.technology) missing.push("technology"); if(!payload.cooling_mode) missing.push("cooling_mode");
  if(!payload.ac_type) missing.push("ac_type");
  const total = 5;
  let conf = Math.round(((total-missing.length)/total)*100);
  if (model_number) conf=Math.min(100,conf+5);
  if (flags.length) conf=Math.max(0,conf-5);
  return { confidence:conf, missing_critical:missing, needs_llm:missing.length>0||conf<85 };
}

// ── MAIN: Shadow Run ────────────────────────────────────────────
async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Shadow Run — AC Plugin vs Old Code");
  console.log("Read-only. No database writes.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // نفس مصدر بيانات الـ Pilot الأصلي
  const { data: storeRows, error: storeErr } = await supabase
    .from("product_stores")
    .select("product_id, store_name, current_price, product_url, availability")
    .in("store_name", ["المنيع", "اكسترا"]);

  if (storeErr || !storeRows) { console.error("Store read failed:", storeErr); process.exit(1); }

  const storeMap = new Map<string, any>();
  for (const s of storeRows) storeMap.set(s.product_id, s);

  const { data: allProducts, error: prodErr } = await supabase
    .from("products")
    .select("id, name_ar, name_en, brand");

  if (prodErr || !allProducts) { console.error("Products read failed:", prodErr); process.exit(1); }

  const products = allProducts.filter(p => storeMap.has(p.id));

  let compared = 0, matched = 0, mismatched = 0;
  const mismatches: any[] = [];

  for (const p of products) {
    const nameAr = p.name_ar || "";
    const nameEn = p.name_en || "";
    if (!nameAr && !nameEn) continue;

    // فلتر AC فقط — بنفس منطق detectCategory الأصلي (AC له أولوية بعد refrigerator)
    const isAC = acPlugin.detect(nameAr, nameEn);
    if (!isAC) continue;

    compared++;

    // ── القديم ──
    const brandOld = normalizeBrandOld(p.brand);
    const rOld = normalizeACOld(nameAr, nameEn);
    const ambiguityOld: string[] = [];
    if (!rOld.payload.series_or_platform) ambiguityOld.push("no_series_detected");
    if (rOld.technology_inferred) ambiguityOld.push("inferred_standard_from_rotary");
    const keyOld = buildACKeyOld(brandOld, rOld.payload, rOld.technology_inferred);
    const confOld = scoreConfOld(brandOld, rOld.payload, rOld.model_number, ambiguityOld);

    // ── الجديد (Plugin) ──
    const brandNew = normalizeBrandOld(p.brand); // normalizeBrand مشترك، لم يُنقل بعد — نفس الدالة
    const rNew = acPlugin.normalize(nameAr, nameEn, p.brand);
    const keyNew = acPlugin.buildIdentityKey(brandNew, rNew.payload, { technology_inferred: rNew.technology_inferred });
    const confNew = acPlugin.scoreConfidence(brandNew, rNew.payload, rNew.model_number, rNew.ambiguity_flags);

    // ── المقارنة ──
    const isMatch =
      keyOld.key === keyNew.key &&
      keyOld.status === keyNew.status &&
      confOld.confidence === confNew.confidence;

    if (isMatch) {
      matched++;
    } else {
      mismatched++;
      mismatches.push({
        id: p.id,
        name: nameAr || nameEn,
        old: { key: keyOld.key, status: keyOld.status, confidence: confOld.confidence },
        new: { key: keyNew.key, status: keyNew.status, confidence: confNew.confidence },
      });
    }
  }

  console.log(`Compared : ${compared}`);
  console.log(`Matched  : ${matched}`);
  console.log(`Mismatch : ${mismatched}\n`);

  if (mismatched > 0) {
    console.log("── MISMATCHES (first 10) ──────────────────");
    mismatches.slice(0, 10).forEach(m => {
      console.log(`\n[${m.id}] ${m.name}`);
      console.log(`  OLD: key=${m.old.key} | status=${m.old.status} | conf=${m.old.confidence}`);
      console.log(`  NEW: key=${m.new.key} | status=${m.new.status} | conf=${m.new.confidence}`);
    });
    console.log(`\n❌ Shadow Run FAILED — ${mismatched} mismatches found. DO NOT proceed to Milestone 5.`);
    process.exit(1);
  } else {
    console.log("✅ Shadow Run PASSED — 100% match. Safe to proceed to Milestone 5.");
  }
}

main().catch(console.error);