// scripts/verify-tps-algolia.ts
// TPS Smoke Test
// يتحقق من أن البحث في Algolia يعمل كما هو متوقع

import { algoliasearch } from "algoliasearch";

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_KEY!
);

const INDEX = "tawveeri_tps_products";

const TESTS = [
  { query: "WindFree", minHits: 3 },
  { query: "مكيف", minHits: 3 },
  { query: "سامسونج", minHits: 3 },
  { query: "2999", minHits: 1 },
  { query: "AR18", minHits: 1 },
];

async function main() {
  console.log("======================================");
  console.log("TPS Algolia Smoke Test");
  console.log("======================================\n");

  let passed = 0;

  for (const test of TESTS) {
    const response = await client.search({
      requests: [
        {
          indexName: INDEX,
          query: test.query,
          hitsPerPage: 10,
        },
      ],
    });

    const result: any = response.results[0];
    const hits = result.hits ?? [];

    const ok = hits.length >= test.minHits;

    console.log(
      `${ok ? "✅" : "❌"} ${test.query} -> ${hits.length} hits (expected >= ${test.minHits})`
    );

    if (hits.length > 0) {
      const first = hits[0];

      console.log(
        `   ${first.display_name_ar ?? first.display_name_en}`
      );

      console.log(
        `   ${first.lowest_price} SAR | ${first.cheapest_store}`
      );
    }

    console.log("");

    if (ok) passed++;
  }

  console.log("======================================");
  console.log(`Passed ${passed}/${TESTS.length}`);

  if (passed === TESTS.length) {
    console.log("\n🎉 TPS Search VERIFIED");
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});