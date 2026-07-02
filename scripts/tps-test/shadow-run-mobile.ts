// scripts/tps-test/shadow-run-mobile.ts
// اختبار مستقل — قراءة فقط، صفر كتابة في قاعدة البيانات
// يقارن نتائج mobilePlugin الجديد بالكود القديم (normalizeMobile + buildMobileKey + scoreConf)

import { createClient } from "@supabase/supabase-js";
import { mobilePlugin } from "../tps-plugins/mobile";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── الكود القديم — منسوخ حرفياً من write-product-observations.ts ──

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

function extractStorageAndRamOld(name:string): {storage_gb:number|null; ram_gb:number|null} {
  let storage:number|null=null, ram:number|null=null;
  const dual = name.match(/(\d+)\s*جيجا[\u060C,]\s*(\d+)\s*جيجا/);
  if (dual) {
    const a=parseInt(dual[1]), b=parseInt(dual[2]);
    return { storage_gb:Math.max(a,b), ram_gb:Math.min(a,b) };
  }
  const ramEx = name.match(/ذاكرة\s+(\d+)\s*جيجابايت\s*رام/i)
             || name.match(/(\d+)\s*(?:جيجابايت|جيجا)\s*رام/i)
             || name.match(/(\d+)\s*GB\s*RAM/i);
  if (ramEx) ram = parseInt(ramEx[1]);
  const stoEx = name.match(/(?:سعة\s*تخزين|تخزين)\s+(\d+)\s*(?:جيجابايت|جيجا)/i);
  if (stoEx) return { storage_gb:parseInt(stoEx[1]), ram_gb:ram };
  const tbEn = name.match(/(\d+)\s*TB/i);
  if (tbEn) { const v=parseInt(tbEn[1])*1024; if(v>=256&&v<=16384) return { storage_gb:v, ram_gb:ram }; }
  const gbAr = name.match(/(\d+)\s*جيجابايت(?!\s*رام)/i);
  if (gbAr) return { storage_gb:parseInt(gbAr[1]), ram_gb:ram };
  const giga = name.match(/(\d+)\s*جيجا(?!\s*(?:بايت|ي))/);
  if (giga) { const v=parseInt(giga[1]); if(v>=32&&v<=4096) storage=v; }
  if (!storage) {
    const gbEn = name.match(/(\d+)\s*[Gg][Bb]/);
    if (gbEn) { const v=parseInt(gbEn[1]); if(v>=32&&v<=4096) storage=v; }
  }
  return { storage_gb:storage, ram_gb:ram };
}

const COLORS_AR=["وردي","اخضر","أخضر","أسود","ابيض","أبيض","فضي","ذهبي","ازرق","أزرق","رمادي","بنفسجي","اصفر","أصفر","تيتانيوم"];
const COLORS_EN=["pink","green","black","white","silver","gold","blue","gray","grey","purple","yellow","titanium"];
const IGNORED_T=["5 جي","5g","شريحتين","dual sim","جديد","new","أصلي","ضمان","warranty"];

function normalizeMobileOld(nameAr:string, nameEn:string, brand:string|null) {
  const name = nameAr || nameEn;
  const lower = name.toLowerCase();
  let color:string|null=null;
  const ignored:string[]=[];
  for (const c of [...COLORS_AR,...COLORS_EN])
    if (name.includes(c)) { color=c; ignored.push(c); break; }
  let network:string|null=null;
  if (lower.includes("5g")||name.includes("5 جي")||name.includes("الجيل الخامس"))
    { network="5G"; ignored.push("5G"); }
  const { storage_gb, ram_gb } = extractStorageAndRamOld(name);
  let family:string|null=null, generation:string|null=null, variant:string|null=null;
  const nb = normalizeBrandOld(brand);

  if (nb==="Apple") {
    family="iPhone";
    const m = name.match(
      /(?:ايفون|آيفون|iphone)\s*(\d+)\s*(برو\s*ماكس|برو|بلس|ميني|pro\s*max|pro|plus|mini|\be\b)?/i
    );
    if (m) {
      generation = m[1];
      const v = (m[2] || "").trim().toLowerCase();
      variant = !v ? "Standard"
        : (v==="برو ماكس" || v==="pro max") ? "Pro Max"
        : (v==="برو"      || v==="pro")      ? "Pro"
        : (v==="بلس"      || v==="plus")     ? "Plus"
        : (v==="ميني"     || v==="mini")     ? "Mini"
        : v==="e"                             ? "E"
        : "Standard";
    }
  }

  if (nb==="Samsung") {
    const s = name.match(/(?:جالاكسي|galaxy)\s+(?:إس|اس|s)\s*(\d+)\s*(إف إي|fe|ultra|ايدج|edge|plus|\+)?/i);
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

function buildMobileKeyOld(brand:string|null, p:Record<string,unknown>) {
  const nulls=["brand","family","generation","variant","storage_gb"]
    .filter(f=>(f==="brand"?brand:p[f])===null||(f==="brand"?brand:p[f])===undefined);
  if (nulls.length>0) return { key:null, status:"invalid", reason:`null in critical: ${nulls.join(", ")}` };
  return { key:`${brand}|${p.family}|${p.generation}|${p.variant}|${p.storage_gb}`, status:"valid" };
}

function scoreConfOld(brand:string|null, payload:Record<string,unknown>, model_number:string|null, flags:string[]) {
  const missing:string[]=[];
  if(!brand) missing.push("brand"); if(!payload.family) missing.push("family");
  if(!payload.generation) missing.push("generation"); if(!payload.variant) missing.push("variant");
  if(!payload.storage_gb) missing.push("storage_gb");
  const total = 5;
  let conf = Math.round(((total-missing.length)/total)*100);
  if (model_number) conf=Math.min(100,conf+5);
  if (flags.length) conf=Math.max(0,conf-5);
  return { confidence:conf, missing_critical:missing, needs_llm:missing.length>0||conf<85 };
}

// ── MAIN: Shadow Run ────────────────────────────────────────────
async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Shadow Run — Mobile Plugin vs Old Code");
  console.log("Read-only. No database writes.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

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

    const isMobile = mobilePlugin.detect(nameAr, nameEn);
    if (!isMobile) continue;

    compared++;

    // ── القديم ──
    const brandOld = normalizeBrandOld(p.brand);
    const rOld = normalizeMobileOld(nameAr, nameEn, p.brand);
    const keyOld = buildMobileKeyOld(brandOld, rOld.payload);
    const confOld = scoreConfOld(brandOld, rOld.payload, null, []);

    // ── الجديد (Plugin) ──
    const brandNew = normalizeBrandOld(p.brand); // normalizeBrand مشترك، لم يُنقل بعد
    const rNew = mobilePlugin.normalize(nameAr, nameEn, p.brand);
    const keyNew = mobilePlugin.buildIdentityKey(brandNew, rNew.payload);
    const confNew = mobilePlugin.scoreConfidence(brandNew, rNew.payload, rNew.model_number, rNew.ambiguity_flags);

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
    console.log(`\n❌ Shadow Run FAILED — ${mismatched} mismatches found. DO NOT proceed to Milestone 7.4.`);
    process.exit(1);
  } else {
    console.log("✅ Shadow Run PASSED — 100% match. Safe to proceed to Milestone 7.4.");
  }
}

main().catch(console.error);