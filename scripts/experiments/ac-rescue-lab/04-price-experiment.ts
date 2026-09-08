// AC Rescue Lab — Step 4: empirical price-signal experiment (mission §14).
// READ-ONLY: SELECT only, against tps_listing_price_facts (a derived price-intelligence
// table, not a Products 2 identity table). Tests whether price adds real discriminating
// signal for the rescue lane. Starting assumption: price must NEVER be a primary identity
// key — this experiment can only demote that assumption to "weak corroborator" or confirm
// "drop entirely," never promote price to a primary key.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import * as fs from "fs";
import { toPoolerDbUrl } from "../../tps-core/pooler-url";

const OUT_DIR = resolve(__dirname, "out");
const classified = JSON.parse(fs.readFileSync(resolve(OUT_DIR, "run-A-classified.json"), "utf-8"));
const trusted = JSON.parse(fs.readFileSync(resolve(OUT_DIR, "trusted-fingerprints.json"), "utf-8"));
const trustedIdByName = new Map<string, string>(trusted.map((t: any) => [t.name_en, t.id]));

// Known-TRUE-match pairs: the RESCUE_HIGH_CONFIDENCE cases from Step 3 — full or near-full
// attribute agreement, the strongest real evidence this lab produced.
const truePairs = classified.filter((c: any) => c.class === "RESCUE_HIGH_CONFIDENCE").map((c: any) => ({ amazon_name: c.amazon_name, trusted_name: c.leading.trusted_name, kind: "TRUE_MATCH_CANDIDATE" }));

// Known-NON-match / weak pairs: AMBIGUOUS and the leading candidate of REVIEW cases — same
// brand/type/capacity block but NOT proven to be the same product (this is the discriminating
// test: does price separate these from the true pairs above, or overlap just as much?).
const nonMatchPairs = classified
  .filter((c: any) => c.class === "AMBIGUOUS" || c.class === "RESCUE_REVIEW")
  .flatMap((c: any) => c.candidates.map((cand: any) => ({ amazon_name: c.amazon_name, trusted_name: cand.trusted_name, kind: "WEAK_OR_AMBIGUOUS_CANDIDATE" })));

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  async function amazonPriceFor(name: string): Promise<number | null> {
    const q = await c.query(`select current_price from tps_listing_price_facts where store_id = 2 and name = $1 and current_price is not null order by updated_at desc limit 1`, [name]);
    return q.rows[0]?.current_price != null ? Number(q.rows[0].current_price) : null;
  }

  async function trustedPriceFor(canonicalName: string): Promise<number | null> {
    const canonicalId = trustedIdByName.get(canonicalName);
    if (!canonicalId) return null;
    // price_history is append-only (canonical_product_id, store_id, price, observed_at) —
    // most-recent observed price for this canonical, across any non-Amazon store.
    const q = await c.query(`select price from price_history where canonical_product_id = $1 and price is not null order by observed_at desc limit 1`, [canonicalId]);
    return q.rows[0]?.price != null ? Number(q.rows[0].price) : null;
  }

  async function ratioFor(pair: { amazon_name: string; trusted_name: string; kind: string }) {
    const amazonPrice = await amazonPriceFor(pair.amazon_name);
    const trustedPrice = await trustedPriceFor(pair.trusted_name);
    if (amazonPrice === null || trustedPrice === null) {
      return { ...pair, amazon_price: amazonPrice, trusted_price: trustedPrice, ratio: null, note: "price missing on one or both sides" };
    }
    const ratio = amazonPrice / trustedPrice;
    return { ...pair, amazon_price: amazonPrice, trusted_price: trustedPrice, ratio: Number(ratio.toFixed(3)) };
  }

  console.log("=== TRUE-MATCH-CANDIDATE price ratios (Amazon / trusted) ===");
  const trueResults = [];
  for (const p of truePairs) { const r = await ratioFor(p); trueResults.push(r); console.log(r); }

  console.log("\n=== WEAK/AMBIGUOUS-CANDIDATE price ratios (Amazon / trusted) ===");
  const nonMatchResults = [];
  for (const p of nonMatchPairs) { const r = await ratioFor(p); nonMatchResults.push(r); console.log(r); }

  const withRatio = (rs: any[]) => rs.filter(r => r.ratio !== null);
  const trueRatios = withRatio(trueResults).map(r => r.ratio);
  const nonMatchRatios = withRatio(nonMatchResults).map(r => r.ratio);

  console.log("\n=== SUMMARY ===");
  console.log("TRUE_MATCH_CANDIDATE pairs with usable price on both sides:", trueRatios.length, "/", trueResults.length);
  console.log("WEAK/AMBIGUOUS pairs with usable price on both sides:", nonMatchRatios.length, "/", nonMatchResults.length);
  console.log("TRUE_MATCH ratios:", trueRatios);
  console.log("WEAK/AMBIGUOUS ratios:", nonMatchRatios);

  fs.writeFileSync(resolve(OUT_DIR, "price-experiment.json"), JSON.stringify({ trueResults, nonMatchResults, trueRatios, nonMatchRatios }, null, 2));
  await c.end();
  console.log("\nWrote out/price-experiment.json");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
