// scripts/algolia-cleanup.ts
// تنظيف فهرس Algolia (products) من الإكسسوارات — DRY_RUN=true افتراضيا
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { algoliasearch } from "algoliasearch";

const DRY_RUN = process.env.DRY_RUN !== "false";
const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "";
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY || process.env.ALGOLIA_ADMIN_API_KEY || "";
const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "products";

if (!APP_ID || !ADMIN_KEY) {
  console.error("❌ مفتاح Algolia Admin غير موجود في .env.local");
  process.exit(1);
}

const client = algoliasearch(APP_ID, ADMIN_KEY);

const ACCESSORY_RE =
  /كفر|واقي|حماية|شاحن|كابل|كيبل|سماعة|زوندا|غلاف|أرموربرو|درع|لاصقة|غطاء|جراب|حافظة|ماج ?سيف|لاصق|ستاند|حامل|محول|قلم|سلك|case|cover|protector|charger|cable|earphone|screen protect|magsafe|adapter|holder|stand|strap|skin|film|stylus/i;

async function main() {
  console.log(`═══ Algolia Cleanup [DRY_RUN=${DRY_RUN}] — فهرس: ${INDEX_NAME} ═══\n`);

  const toDelete: string[] = [];
  const samples: string[] = [];

  await client.browseObjects({
    indexName: INDEX_NAME,
    aggregator: (res: any) => {
      for (const hit of res.hits) {
        const cat = String(hit.category ?? "");
        const name = `${hit.name_ar ?? ""} ${hit.name_en ?? ""}`.toLowerCase();
        const isAcc = cat === "accessories" || ACCESSORY_RE.test(name);
        if (isAcc) {
          toDelete.push(hit.objectID);
          if (samples.length < 10) samples.push(hit.name_ar || hit.name_en || hit.objectID);
        }
      }
    },
  });

  console.log(`📊 إكسسوارات في الفهرس: ${toDelete.length}\n`);
  console.log("عينة (10):");
  samples.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

  if (DRY_RUN) {
    console.log("\n⚠️ DRY_RUN — لم يُحذف شيء. للحذف الفعلي: DRY_RUN=false");
    return;
  }

  console.log(`\n🔴 حذف ${toDelete.length} سجلاً...`);
  await client.deleteObjects({ indexName: INDEX_NAME, objectIDs: toDelete });
  console.log("✅ اكتمل الحذف.");
}

main().catch((e) => {
  console.error("❌ فشل:", e?.message || e);
  process.exit(1);
});