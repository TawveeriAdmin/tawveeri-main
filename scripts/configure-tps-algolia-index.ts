// scripts/configure-tps-algolia-index.ts
// يضبط searchableAttributes + customRanking + attributesForFaceting
// يُشغَّل مرة واحدة بعد أول sync
// algoliasearch v5

// Credentials come from the environment only (docs/ENVIRONMENT-AUTHORITY.md).
// This was missing, so the script crashed on an undefined app id and the index
// settings below had never actually been applied.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { algoliasearch } from "algoliasearch";

const APP_ID = process.env.ALGOLIA_APP_ID || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "";
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY || "";
if (!APP_ID || !ADMIN_KEY) throw new Error("ALGOLIA_APP_ID / ALGOLIA_ADMIN_KEY missing");
const algolia = algoliasearch(APP_ID, ADMIN_KEY);
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
      // ADR-064 — RANKING ORDER MATTERS. `asc(lowest_price)` was FIRST, so the
      // absolute cheapest item won every relevance tie: "غسالة اتوماتيك" (washing
      // machine) returned a DISHWASHER at rank 1, and "ثلاجة" returned a 50-litre
      // mini fridge. Cheapness alone is not the product.
      //
      // Tawveeri's differentiated value is a CORROBORATED comparison backed by
      // evidence, so verified breadth and identity confidence rank first, and
      // price decides among equally-trustworthy answers. All three signals are
      // neutral quality measures — no commercial input ever enters ranking
      // (Constitution Art. VII).
      customRanking: [
        "desc(store_count)",
        "desc(identity_confidence)",
        "asc(lowest_price)",
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

      // ADR-064 — GRACEFUL DEGRADATION. This defaults to 'none', meaning EVERY
      // term had to match. Measured consequence on the live index: four-word
      // queries returned zero results — "samsung galaxy s25 ultra" → 0 hits,
      // "ايفون رخيص" → 0 hits, because one unmatched word killed the whole
      // query. A shopper who adds a word must get fewer/less-exact results,
      // never an empty page.
      removeWordsIfNoResults: "allOptional",
      // Saudi shoppers routinely misspell Latin brand names ("ipone").
      typoTolerance: true,
      advancedSyntax: true,
    },
  });

  // ── Saudi shopping vocabulary ─────────────────────────────────────────────
  // Shoppers ask with words the catalogue never contains — "جوال" (phone),
  // "شاشة" (TV) — which returned zero results. Published as SYNONYMS rather
  // than stuffed into product text: stuffing corrupts both relevance ranking
  // and the displayed product name.
  const { SAUDI_SEARCH_SYNONYMS } = await import("../src/lib/search/query-normalize");
  const synonyms = SAUDI_SEARCH_SYNONYMS.map((group, i) => ({
    objectID: `saudi-vocab-${i}`,
    type: "synonym" as const,
    synonyms: group,
  }));
  const synRes = await algolia.saveSynonyms({
    indexName: INDEX,
    synonymHit: synonyms,
    replaceExistingSynonyms: true,
  });
  if ("taskID" in synRes) await algolia.waitForTask({ indexName: INDEX, taskID: synRes.taskID });
  console.log(`  ✓ ${synonyms.length} Saudi vocabulary synonym groups published`);

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