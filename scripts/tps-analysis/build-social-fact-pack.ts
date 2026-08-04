// scripts/tps-analysis/build-social-fact-pack.ts
// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL FACT PACK BUILDER — Controlled Demand Validation.
// Pulls a diverse, genuinely-comparable, freshly-observed sample straight from
// production for social content evidence (docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §11).
// NEVER reads a price from a document/screenshot/prior pack — this is the read.
// Read-only. Writes marketing/SOCIAL_FACT_PACK_<date>.md.
// Run: npx tsx scripts/tps-analysis/build-social-fact-pack.ts
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { writeFileSync, mkdirSync } from "fs";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

// Retailers LAUNCH_VOCABULARY §3 (L81/89) forbids naming as a comparison source.
// We still show their price row if present (it is real evidence) but never NAME them
// in generated copy — citation lines below fall back to "another retailer" for these.
const UNNAMEABLE = new Set(["lulu", "sharafdg"]);

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const now = String((await c.query("select now()::text ts")).rows[0].ts);

  // One diverse candidate per category, deepest comparison first, freshest last_observed_at.
  const candidates = await c.query(`
    with ranked as (
      select p.*, row_number() over (partition by p.category order by p.store_count desc, p.last_observed_at desc) rn
      from tps_product_projection p
      where p.has_comparison and p.store_count >= 2
    )
    select id, canonical_id, tps_identity_key, display_name_ar, display_name_en, brand, category,
      lowest_price, highest_price, saving, cheapest_store, store_count, compare_url,
      image_url, identity_confidence, built_at::text built_at, updated_at::text updated_at,
      model_number, last_observed_at::text last_observed_at
    from ranked where rn = 1
    order by store_count desc, last_observed_at desc
    limit 12
  `);

  const packRows: string[] = [];
  let n = 0;
  for (const p of candidates.rows) {
    n++;
    // DISTINCT ON, not ORDER BY + LIMIT: a store re-observed far more often than others
    // (e.g. the reobserve loop) can fill an entire top-N window with its own rows and
    // push a slower store's still-current latest row out of range — LIMIT truncates
    // before every store's own latest row is reached. DISTINCT ON per store never does.
    const offers = await c.query(`
      select distinct on (lower(trim(ph.store_name)))
        ph.store_name, ph.price, ph.effective_price, ph.observed_at::text observed_at
      from price_history ph
      where ph.canonical_product_id = $1
      order by lower(trim(ph.store_name)), ph.observed_at desc
    `, [p.canonical_id]);
    const perStore = new Map<string, { price: number; observed_at: string }>();
    for (const o of offers.rows) {
      const key = String(o.store_name).toLowerCase().trim();
      perStore.set(key, { price: +(o.effective_price ?? o.price), observed_at: String(o.observed_at) });
    }
    const storeLines = [...perStore.entries()]
      .sort((a, b) => a[1].price - b[1].price)
      .map(([store, v]) => {
        const nameable = !UNNAMEABLE.has(store);
        const ageH = Math.round((Date.now() - new Date(v.observed_at).getTime()) / 3_600_000);
        return `  - ${nameable ? store : "(unnamed retailer — vocab §3 L81/89)"}: **${v.price} SAR**, observed ${v.observed_at} (${ageH}h ago)`;
      });
    const ages = [...perStore.values()].map(v => Math.round((Date.now() - new Date(v.observed_at).getTime()) / 3_600_000));
    const maxAgeH = Math.max(...ages);
    // Computed from THIS run's per-store breakdown, not the projection's cached
    // lowest_price/highest_price/saving fields — those are only as fresh as the last
    // chain tick and can drift from live price_history (measured: candidate 11 below
    // showed a cached highest of 489 while a live 579 SAR row already existed).
    const prices = [...perStore.values()].map(v => v.price);
    const liveLowest = Math.min(...prices);
    const liveHighest = Math.max(...prices);
    const liveSaving = +(liveHighest - liveLowest).toFixed(2);
    // Risk is about the claim we'd actually MAKE — "from <lowest> SAR" — not about the
    // staleness of some other, non-headline retailer's row. A stale HIGH offer just means
    // don't cite that specific retailer by name; it doesn't make the cheapest-price claim unsafe.
    const cheapestEntry = [...perStore.entries()].sort((a, b) => a[1].price - b[1].price)[0];
    const cheapestAgeH = Math.round((Date.now() - new Date(cheapestEntry[1].observed_at).getTime()) / 3_600_000);
    const staleOthers = ages.filter(a => a > 168).length;
    const risk = cheapestAgeH > 168
      ? "MEDIUM — the CHEAPEST (headline) offer is itself >7d old, re-observe before citing this price"
      : staleOthers > 0
        ? `LOW for the headline "from ${liveLowest} SAR" claim (${cheapestAgeH}h old) — but ${staleOthers} other retailer row(s) here are >7d old, do not cite those specific retailers/prices`
        : "LOW";

    packRows.push(`
## Candidate ${n} — ${p.category}
- **Canonical ID:** \`${p.canonical_id}\`
- **Name (AR):** ${p.display_name_ar}
- **Name (EN):** ${p.display_name_en}
- **Brand:** ${p.brand ?? "—"} · **Model:** ${p.model_number ?? "—"}
- **Displayable retailers:** ${p.store_count} (comparable = ${p.store_count >= 2 ? "yes" : "no"}, deep = ${p.store_count >= 3 ? "yes" : "no"})
- **Observed prices (latest per retailer, this run):**
${storeLines.join("\n")}
- **Lowest observed:** ${liveLowest} SAR · **Highest observed:** ${liveHighest} SAR · **Saving:** ${liveSaving} SAR (computed from the per-retailer rows above, this run — not the cached projection field)
- **Comparison URL:** ${p.compare_url ?? "(none — regenerate before use)"}
- **Affiliate/outbound validation state:** exit resolves through \`/go\` per canonical product; Amazon/Noon carry verified affiliate tags (see docs/SOCIAL-READINESS.md), other retailers exit direct (untagged, expected).
- **Freshness state:** projection built ${p.built_at}, last observed ${p.last_observed_at} (max offer age ${maxAgeH}h)
- **Allowed wording:** "Last Observed Price" / «آخر سعر رصدناه» only — never "current/live/real-time" (LAUNCH_VOCABULARY §10 L256-291). Retailer names may be cited individually EXCEPT LuLu/Sharaf DG (§3 L81/89) — those may back a comparison but must not be named.
- **Claim expiry:** 48h from ${now} for any specific price cited (re-verify via this script before that window closes; do not carry forward).
- **Risk:** ${risk}
`);
  }

  mkdirSync(resolve(process.cwd(), "marketing"), { recursive: true });
  const dateStr = now.slice(0, 10);
  const out = resolve(process.cwd(), `marketing/SOCIAL_FACT_PACK_${dateStr}.md`);
  const header = `# SOCIAL FACT PACK — ${dateStr}
**Measured:** ${now} (production \`vyceqrzttspyycdpojtn\`, live query, this run — never carried forward from a document/screenshot/prior pack)
**Instrument:** \`npx tsx scripts/tps-analysis/build-social-fact-pack.ts\`
**Candidates:** ${n} (one per category, deepest comparison first)
**Rule:** every price below expires 48h from measurement time. Re-run this script before publishing anything that cites a specific price older than that.
**Not a permanent price record** — a dated snapshot (docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §11).
`;
  writeFileSync(out, header + packRows.join("\n"));
  console.log(`Wrote ${out} with ${n} candidates.`);
  await c.end();
})();
