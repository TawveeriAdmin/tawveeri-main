// scripts/configure-tps-algolia-index.ts
// يضبط searchableAttributes + customRanking + attributesForFaceting
// يُشغَّل مرة واحدة بعد أول sync
// algoliasearch v5

import { algoliasearch } from "algoliasearch";

const algolia = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_KEY!
);
const INDEX = "tawveeri_tps_products";

async function main() {
  console.log(`Configuring Algolia index [${INDEX}]...`);

  const res = await algolia.setSettings({
    indexName: INDEX,
    indexSettings: {
      // ترتيب البحث: الأهم أولاً
      searchableAttributes: [
        "display_name_ar",
        "display_name_en",
        "brand",
        "unordered(text_for_search)",
        "category",
        "cheapest_store",
      ],
      // Ranking: الأرخص + الأكثر توفيراً يظهر أولاً
      customRanking: [
        "asc(lowest_price)",
        "desc(store_count)",
        "desc(price_spread_pct)",
      ],
      // Filters
      attributesForFaceting: [
        "filterOnly(has_comparison)",
        "filterOnly(source)",
        "brand",
        "category",
      ],
      // عربي + إنجليزي
      ignorePlurals:   true,
      removeStopWords: true,
      queryLanguages:  ["ar", "en"],
      indexLanguages:  ["ar", "en"],
    },
  });

  // انتظر حتى تُطبَّق الإعدادات فعلياً
  if ("taskID" in res) {
    console.log(`  Waiting for task ${res.taskID}...`);
    await algolia.waitForTask({ indexName: INDEX, taskID: res.taskID });
    console.log(`  ✓ Settings applied`);
  }

  console.log(`\n✅ Index [${INDEX}] configured successfully`);
  console.log(`\nTest in Algolia Dashboard → ${INDEX}:`);
  console.log(`  "WindFree"      → 3 results`);
  console.log(`  "مكيف سامسونج"  → 3 results`);
  console.log(`  "حار وبارد"     → 2 results`);
  console.log(`  "20000"         → 1 result`);
  console.log(`  "2999"          → 1 result (cheapest)`);
}

main().catch(console.error);