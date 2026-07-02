// scripts/write-product-observations.ts
// TPS Layer 1 — Normalization v9.0.2
// Milestone 7.4: mobile الآن يمر عبر mobilePlugin (Plugin Architecture)
// AC و Mobile كلاهما الآن عبر Plugin Registry
// الكود القديم لـ mobile لا يزال موجوداً بالأسفل كمرجع — سيُحذف في Milestone 7.5
// مصدر: products + product_stores

import { createClient } from "@supabase/supabase-js";
import { detectPlugin } from "./tps-core/plugin-registry";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NORMALIZER_VERSION = "v9.0.2";
const TPS_VERSION = "1.0";
const BATCH_SIZE = 100;

type Category = "mobile" | "ac" | "refrigerator" | "tablet" | "laptop" | "accessory" | "unknown";
type Language  = "ar" | "en" | "mixed";
type KeyStatus = "valid" | "low_confidence_candidate" | "invalid";

// ── CLI Args (Pilot mode) ────────────────────────────────────
function getArg(name: string): string | null {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
}
const FILTER_CATEGORY = getArg('category');
const FILTER_STORES   = getArg('store')?.split(',') ?? null;

// ── CATEGORY DETECTION (للفئات غير المنقولة بعد: refrigerator, tablet, laptop, accessory) ──
// "ac" و "mobile" أُزيلتا من هنا — Plugins تتكفّل بهما عبر detectPlugin()
const CAT_SIGNALS: Record<Category, string[]> = {
  mobile:       [], // محجوزة فقط — منطقها الفعلي في mobilePlugin
  ac:           [], // محجوزة فقط — منطقها الفعلي في acPlugin
  refrigerator: ["ثلاجة","refrigerator","fridge","freezer","cu.ft","cu ft","side by side","french door","bespoke","twin cooling"],
  tablet:       ["تاب","tab","آيباد","ipad"],
  laptop:       ["لابتوب","laptop","نوت بوك","notebook","macbook","ماك بوك"],
  accessory:    ["holder","حامل","كابل","cable","شاحن","charger","case","كفر","سماعة","earphone","headphone","سماعات"],
  unknown:      [],
};

function detectCategory(nameAr: string, nameEn: string): Category {
  const text = (nameAr + " " + nameEn).toLowerCase();
  const scores: Partial<Record<Category,number>> = {};
  for (const [cat,sigs] of Object.entries(CAT_SIGNALS) as [Category,string[]][]) {
    if (cat==="unknown") continue;
    for (const s of sigs) if (text.includes(s.toLowerCase())) scores[cat]=(scores[cat]||0)+1;
  }
  if ((scores.refrigerator||0) >= 1) return "refrigerator";
  const sorted = Object.entries(scores).sort((a,b) => b[1]-a[1]);
  return sorted.length && sorted[0][1] > 0 ? sorted[0][0] as Category : "unknown";
}

function detectLanguage(name: string): Language {
  const ar = (name.match(/[\u0600-\u06FF]/g)||[]).length;
  const en = (name.match(/[a-zA-Z]/g)||[]).length;
  if (ar > 0 && en > 0) return "mixed";
  return ar > en ? "ar" : "en";
}

// ── BRAND (مشترك — لم يُنقل بعد، ما زال يُستخدم خارج الـ plugins) ──
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
const normalizeBrand = (raw:string|null) =>
  !raw ? null : (BRAND_MAP[raw.trim().toLowerCase()] || BRAND_MAP[raw.trim()] || raw.trim());

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  if (FILTER_CATEGORY) console.log(`Pilot mode — category filter: ${FILTER_CATEGORY}`);
  if (FILTER_STORES)   console.log(`Pilot mode — store filter: ${FILTER_STORES.join(", ")}`);

  console.log("Reading product_stores in pages...");
  const storeRows: any[] = [];
  let storePage = 0;
  const STORE_PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("product_stores")
      .select("product_id, store_name, current_price, product_url, availability")
      .in("store_name", FILTER_STORES ?? ["المنيع", "اكسترا"])
      .range(storePage * STORE_PAGE, (storePage + 1) * STORE_PAGE - 1);
    if (error) { console.error(`Stores page ${storePage} failed:`, error); break; }
    if (!data || data.length === 0) break;
    storeRows.push(...data);
    console.log(`  Stores page ${storePage+1}: ${data.length} rows`);
    storePage++;
    if (data.length < STORE_PAGE) break;
  }

  const storeMap = new Map<string, any>();
  for (const s of storeRows) storeMap.set(s.product_id, s);
  console.log(`Store offers: ${storeRows.length} | Unique products: ${storeMap.size}`);

  console.log("Reading all products in pages...");
  const allProducts: any[] = [];
  const PROD_PAGE = 1000;
  let prodPage = 0;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name_ar, name_en, brand")
      .range(prodPage * PROD_PAGE, (prodPage + 1) * PROD_PAGE - 1);
    if (error) { console.error(`Products page ${prodPage} failed:`, error); break; }
    if (!data || data.length === 0) break;
    allProducts.push(...data);
    console.log(`  Products page ${prodPage+1}: ${data.length} rows`);
    prodPage++;
    if (data.length < PROD_PAGE) break;
  }

  const products = allProducts.filter(p => storeMap.has(p.id));
  console.log(`Total: ${allProducts.length} → linked: ${products.length}. Normalizing...`);

  const rows: object[] = [];
  let skipped = 0;

  for (const p of products) {
    const nameAr = p.name_ar || "";
    const nameEn = p.name_en || "";
    const name   = nameAr || nameEn;
    const store  = storeMap.get(p.id);
    if (!name || !store) { skipped++; continue; }

    // ── Plugin Registry أولاً (AC + Mobile الآن) ───────────────
    const matchedPlugin = detectPlugin(nameAr, nameEn);
    const category: Category = matchedPlugin
      ? (matchedPlugin.category as Category)
      : detectCategory(nameAr, nameEn);

    if (FILTER_CATEGORY && category !== FILTER_CATEGORY) { skipped++; continue; }

    const language = detectLanguage(nameAr || nameEn);
    const brand    = normalizeBrand(p.brand);

    let color:string|null=null, model_number:string|null=null;
    let payload:Record<string,unknown>={};
    let ignored:string[]=[], ambiguity_flags:string[]=[];
    let keyResult:{key:string|null;status:KeyStatus;reason?:string}={key:null,status:"invalid",reason:"category not supported yet"};
    let confResult = { confidence: 0, missing_critical: [] as string[], needs_llm: true };

    if (matchedPlugin && matchedPlugin.category === "ac") {
      // ── المسار عبر acPlugin ──────────────────────────────────
      const r = matchedPlugin.normalize(nameAr, nameEn, p.brand);
      model_number    = r.model_number;
      payload         = r.payload;
      ambiguity_flags = r.ambiguity_flags;
      keyResult       = matchedPlugin.buildIdentityKey(brand, payload, { technology_inferred: r.technology_inferred });
      confResult      = matchedPlugin.scoreConfidence(brand, payload, model_number, ambiguity_flags);
    } else if (matchedPlugin && matchedPlugin.category === "mobile") {
      // ── المسار عبر mobilePlugin ──────────────────────────────
      const r = matchedPlugin.normalize(nameAr, nameEn, p.brand);
      model_number    = r.model_number;
      color           = r.color ?? null;
      ignored         = r.ignored_terms ?? [];
      payload         = r.payload;
      ambiguity_flags = r.ambiguity_flags;
      keyResult       = matchedPlugin.buildIdentityKey(brand, payload);
      confResult      = matchedPlugin.scoreConfidence(brand, payload, model_number, ambiguity_flags);
    }

    rows.push({
      source_table:         "products",
      source_record_id:     p.id,
      canonical_product_id: null,
      store_id:             store.store_name,
      raw_name:             name,
      raw_payload: {
        name_ar:       nameAr,
        name_en:       nameEn,
        brand:         p.brand,
        store_name:    store.store_name,
        current_price: store.current_price,
        product_url:   store.product_url,
        availability:  store.availability,
      },
      detected_category:    category,
      language,
      brand,
      model_number,
      color,
      identity_key:         keyResult.key,
      identity_key_status:  keyResult.status,
      normalized_payload:   payload,
      confidence:           confResult.confidence,
      missing_critical:     confResult.missing_critical,
      ambiguity_flags,
      needs_llm:            confResult.needs_llm,
      ignored_terms:        ignored,
      normalizer_version:   NORMALIZER_VERSION,
      tps_version:          TPS_VERSION,
      plugin_version:       matchedPlugin?.version ?? null,
    });
  }

  const batches: object[][] = [];
  for (let i=0; i<rows.length; i+=BATCH_SIZE)
    batches.push(rows.slice(i, i+BATCH_SIZE));

  console.log(`\nInserting ${rows.length} rows in ${batches.length} batches...`);

  let ok=0, fail=0, failRows=0;
  for (let i=0; i<batches.length; i++) {
    const { error:e }=await supabase.from("normalized_product_observations").insert(batches[i]);
    if (e) { fail++; failRows+=batches[i].length; console.error(`  ✗ Batch ${i+1} FAILED: ${e.message}`); }
    else   { ok++;   console.log(`  ✓ Batch ${i+1}/${batches.length} OK (${batches[i].length} rows)`); }
  }

  console.log(`\n── Results ──────────────────────────`);
  console.log(`  Total rows      : ${rows.length}`);
  console.log(`  Skipped         : ${skipped}`);
  console.log(`  Success batches : ${ok}/${batches.length}`);
  console.log(`  Failed batches  : ${fail}`);
  console.log(`  Failed rows     : ${failRows}`);
  console.log(`\nVerify:
SELECT detected_category, identity_key_status, COUNT(*)
FROM normalized_product_observations
GROUP BY detected_category, identity_key_status
ORDER BY detected_category, identity_key_status;`);
}

main().catch(console.error);