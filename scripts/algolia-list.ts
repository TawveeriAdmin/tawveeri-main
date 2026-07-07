// scripts/algolia-list.ts — يعرض ما تبقى في الفهرس لبحث معين
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { algoliasearch } from "algoliasearch";

const client = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "",
  process.env.ALGOLIA_ADMIN_KEY || ""
);

async function main() {
  const res: any = await client.searchSingleIndex({
    indexName: process.env.ALGOLIA_INDEX_NAME || "products",
    searchParams: { query: "ايفون 17", hitsPerPage: 30 },
  });
  console.log(`نتائج "ايفون 17": ${res.hits.length}\n`);
  res.hits.forEach((h: any, i: number) =>
    console.log(`${i + 1}. [${h.category ?? "?"}] ${h.name_ar || h.name_en}`)
  );
}

main().catch((e) => { console.error("❌", e?.message || e); process.exit(1); });