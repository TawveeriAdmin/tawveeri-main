// scripts/tps-analysis/search-quality.ts
// ─────────────────────────────────────────────────────────────────────────────
// SAUDI SEARCH-QUALITY BENCHMARK (ADR-064)
//
// Search is the front door. If a Saudi shopper types "ايفون ١٧" or "مكيف اسبليت"
// and gets nothing useful, no amount of identity, trust or price intelligence
// behind it matters. Coverage of the CATALOGUE is not the same as coverage of
// DEMAND, and only the second one is customer value.
//
// This runs representative Saudi queries — Arabic and English, colloquial and
// formal, with and without diacritics/Arabic-Indic digits — against the live
// serving index and grades each one:
//   HIT   a relevant product in the top 3
//   WEAK  relevant only deeper in the top 10
//   MISS  nothing relevant, or zero results
// It also reports how many results carry an image and a comparison, because a
// result the shopper cannot act on is not really a hit.
//
// Read-only. Deterministic. Usage: npm run tps:search-quality
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { algoliasearch } from "algoliasearch";

const APP = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || process.env.ALGOLIA_APP_ID || "";
const KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY || process.env.ALGOLIA_ADMIN_KEY || "";
const INDEX = process.env.ALGOLIA_TPS_INDEX || "tawveeri_tps_products";

/**
 * `expect`   — matched against the result's searchable text (RETRIEVAL: did we
 *              find anything relevant at all?)
 * `topMustBe`— the category the FIRST result must belong to (RANKING: is the
 *              best answer actually on top?). Retrieval and ranking are graded
 *              separately because they fail for different reasons and are fixed
 *              in different places.
 */
interface Query { q: string; note: string; expect: RegExp; topMustBe?: RegExp }

const QUERIES: Query[] = [
  // ── Arabic, the primary shopping language ──
  { q: "ايفون 17", note: "AR iPhone by generation", expect: /iphone|ايفون/i },
  { q: "آيفون ١٧ برو ماكس", note: "AR hamza + Arabic-Indic digits + variant", expect: /iphone|ايفون/i },
  { q: "جوال سامسونج", note: "AR colloquial jawwal + brand", expect: /samsung|سامسونج|galaxy/i, topMustBe: /mobile/ },
  { q: "جالاكسي اس 25", note: "AR transliterated Galaxy S line", expect: /galaxy|جالاكسي/i },
  { q: "ايفون رخيص", note: "AR intent word attached to a product", expect: /iphone|ايفون/i },
  // ── Appliances, where Saudi terminology differs most ──
  { q: "مكيف سبليت", note: "AR split air conditioner", expect: /مكيف|air.?condition|split/i, topMustBe: /air_conditioner/ },
  { q: "غسالة اتوماتيك", note: "AR washing machine", expect: /غسال|wash/i, topMustBe: /washing_machine/ },
  { q: "ثلاجة", note: "AR refrigerator, single word", expect: /ثلاج|refriger|fridge/i, topMustBe: /refrigerator/ },
  { q: "شاشة 65 بوصة", note: "AR TV by size ('shasha')", expect: /تلفزيون|شاشة|\btv\b|65/i },
  // ── English, used by many Saudi shoppers ──
  { q: "iphone 17 pro max", note: "EN flagship phone", expect: /iphone/i, topMustBe: /mobile/ },
  { q: "samsung galaxy s25 ultra", note: "EN flagship phone", expect: /galaxy|samsung/i },
  { q: "laptop", note: "EN broad category", expect: /laptop|لابتوب|macbook|vivobook|ideapad/i, topMustBe: /laptop/ },
  { q: "4k tv", note: "EN spec-led query", expect: /tv|تلفزيون|4k/i, topMustBe: /^tv$/ },
  // ── Robustness ──
  { q: "ايفون17", note: "AR no space between word and number", expect: /iphone|ايفون/i },
  { q: "ipone 17", note: "EN misspelling — typo tolerance", expect: /iphone/i },
];

interface Hit { display_name_ar?: string; display_name_en?: string; text_for_search?: string; brand?: string; category?: string; image_url?: string | null; store_count?: number }

(async () => {
  if (!APP || !KEY) throw new Error("Algolia credentials missing");
  const client = algoliasearch(APP, KEY);

  let hit = 0, weak = 0, miss = 0;
  const rows: string[] = [];
  let actionable = 0, graded = 0, rankOk = 0, rankChecked = 0;

  for (const query of QUERIES) {
    const res = await client.searchSingleIndex<Hit>({ indexName: INDEX, searchParams: { query: query.q, hitsPerPage: 10 } });
    const hits = res.hits ?? [];
    const text = (h: Hit) => `${h.display_name_ar ?? ""} ${h.display_name_en ?? ""} ${h.brand ?? ""} ${h.category ?? ""} ${h.text_for_search ?? ""}`;
    const rank = hits.findIndex((h) => query.expect.test(text(h)));

    let grade: "HIT" | "WEAK" | "MISS";
    if (rank >= 0 && rank < 3) { grade = "HIT"; hit++; }
    else if (rank >= 0) { grade = "WEAK"; weak++; }
    else { grade = "MISS"; miss++; }

    // Is the top result something a shopper can actually act on?
    const top = hits[0];
    if (top) { graded++; if (top.image_url) actionable++; }

    // RANKING, graded separately: is the best answer actually first? A query can
    // retrieve perfectly and still fail the shopper — "غسالة اتوماتيك" returned a
    // DISHWASHER at rank 1 because price-first custom ranking outvoted relevance.
    let rankMark = "";
    if (query.topMustBe) {
      rankChecked++;
      const ok = !!top && query.topMustBe.test(top.category ?? "");
      if (ok) rankOk++; else rankMark = `  ✗ top is '${top?.category ?? "none"}', expected ${query.topMustBe}`;
    }

    const topName = top ? (top.display_name_ar || top.display_name_en || "").slice(0, 42) : "(no results)";
    rows.push(`  [${grade.padEnd(4)}] ${query.q.padEnd(22)} n=${String(hits.length).padStart(2)}  rank=${rank < 0 ? "-" : rank + 1}  ${topName}`);
    rows.push(`           ${query.note}${rankMark}`);
  }

  console.log(`\n╔══ SAUDI SEARCH QUALITY — ${QUERIES.length} representative queries ══════════\n`);
  console.log(rows.join("\n"));
  const score = ((hit + 0.5 * weak) / QUERIES.length) * 100;
  console.log(`\n  RETRIEVAL  HIT ${hit}   WEAK ${weak}   MISS ${miss}    score ${score.toFixed(0)}%`);
  console.log(`  RANKING    top result in the right category: ${rankOk}/${rankChecked}  (${((100 * rankOk) / Math.max(1, rankChecked)).toFixed(0)}%)`);
  console.log(`  ACTIONABLE top result carries an image in ${actionable}/${graded} queries\n`);
  process.exit(miss > QUERIES.length * 0.25 ? 1 : 0);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(2); });
