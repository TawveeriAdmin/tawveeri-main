// scripts/tps-test/diagnose-mobile-gap.ts
// يقارن أي منتجات كانت mobile بالمنطق القديم لكن لم تعد كذلك بـ mobilePlugin.detect()

import { createClient } from "@supabase/supabase-js";
import { mobilePlugin } from "../tps-plugins/mobile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── نفس detectCategory القديم بالكامل (منسوخ حرفياً) ─────────
type Category = "mobile" | "ac" | "refrigerator" | "tablet" | "laptop" | "accessory" | "unknown";

const CAT_SIGNALS_OLD: Record<Category, string[]> = {
  mobile:       ["ايفون","آيفون","iphone","جالاكسي","galaxy","جوال","هاتف","زد فليب","z flip","z fold","s25","s24","s23","a57","a55","fe","إف إي"],
  ac:           ["مكيف","تكييف","split ac","air conditioner","btu","وحدة","ويند فري","windfree","سبليت","air cooler","صحراوي","cooler"],
  refrigerator: ["ثلاجة","refrigerator","fridge","freezer","cu.ft","cu ft","side by side","french door","bespoke","twin cooling"],
  tablet:       ["تاب","tab","آيباد","ipad"],
  laptop:       ["لابتوب","laptop","نوت بوك","notebook","macbook","ماك بوك"],
  accessory:    ["holder","حامل","كابل","cable","شاحن","charger","case","كفر","سماعة","earphone","headphone","سماعات"],
  unknown:      [],
};

function detectCategoryOld(nameAr: string, nameEn: string): Category {
  const text = (nameAr + " " + nameEn).toLowerCase();
  const scores: Partial<Record<Category,number>> = {};
  for (const [cat,sigs] of Object.entries(CAT_SIGNALS_OLD) as [Category,string[]][]) {
    if (cat==="unknown") continue;
    for (const s of sigs) if (text.includes(s.toLowerCase())) scores[cat]=(scores[cat]||0)+1;
  }
  if ((scores.refrigerator||0) >= 1) return "refrigerator";
  const sorted = Object.entries(scores).sort((a,b) => b[1]-a[1]);
  return sorted.length && sorted[0][1] > 0 ? sorted[0][0] as Category : "unknown";
}

async function main() {
  const { data: storeRows } = await supabase
    .from("product_stores")
    .select("product_id, store_name")
    .in("store_name", ["المنيع", "اكسترا"]);

  const storeMap = new Set((storeRows ?? []).map(s => s.product_id));

  const { data: allProducts } = await supabase
    .from("products")
    .select("id, name_ar, name_en, brand");

  const products = (allProducts ?? []).filter(p => storeMap.has(p.id));

  console.log(`Checking ${products.length} linked products...\n`);

  let goneFromMobile = 0;

  for (const p of products) {
    const nameAr = p.name_ar || "";
    const nameEn = p.name_en || "";
    if (!nameAr && !nameEn) continue;

    const oldCategory = detectCategoryOld(nameAr, nameEn);
    const isMobileNew = mobilePlugin.detect(nameAr, nameEn);

    // كان mobile سابقاً، لكن الآن لا
    if (oldCategory === "mobile" && !isMobileNew) {
      goneFromMobile++;
      console.log(`[${p.id}] ${nameAr || nameEn}`);
      console.log(`  brand: ${p.brand}`);
      console.log(`  OLD category: mobile`);
      console.log(`  NEW mobilePlugin.detect(): false`);
      console.log("");
    }
  }

  console.log(`\nTotal products lost from mobile: ${goneFromMobile}`);
}

main().catch(console.error);