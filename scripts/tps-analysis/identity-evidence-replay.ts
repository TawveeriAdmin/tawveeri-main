// scripts/tps-analysis/identity-evidence-replay.ts — Evidence-First offline replay (2026-10-04). READ-ONLY, shadow only.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Replays every multi-store canonical group of a category through the ONE unified manufacturer-model evidence function
// (src/lib/identity/manufacturer-model-evidence.ts): pairwise relations (Rules A–F) → verified SUBCLUSTERS. No human label is read.
// PRICE is never an input to a relation or a cluster. It is read only to name which listing currently carries a "lowest price" claim,
// so the commercial effect of the evidence layer can be counted (claims kept / claims no longer supported).
//
// Reports (per category): comparable groups before/after; groups fully verified / split / partially verified / unverified; pairs by
// relation; false-merge candidates removed (DIFFERENT_*); reviews introduced; listings left out of every verified cluster; Amazon
// (store 2) inclusions / conflicts / reviews; lowest-price claims retained vs no-longer-supported.
// KNOWN LIMIT (stated, not hidden): an offline replay of EXISTING groups cannot show comparisons RECOVERED across groups — that needs
// the key builder to re-key, which is the (unapproved) cutover.
//
//   npx tsx scripts/tps-analysis/identity-evidence-replay.ts --categories=tv,vacuum [--out=docs/evidence/.../evidence-first/replay.json]
import { config } from "dotenv";
import { resolve } from "path";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { dirname } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { resolveApprovedSlug } from "../../src/lib/retailers/approved-retailers";
import { conditionOf, extractModelEvidence, verifiedSubclusters, type PairRelation } from "../../src/lib/identity/manufacturer-model-evidence";

const argv = process.argv.slice(2);
const CATS = (argv.find((a) => a.startsWith("--categories="))?.split("=")[1] ?? "tv,vacuum").split(",").filter(Boolean);
const OUT = argv.find((a) => a.startsWith("--out="))?.split("=").slice(1).join("=") ?? "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/evidence-first/replay-2026-10-04.json";
// Store id -> slug from the ONE authority (approved-retailers STORE_ID_TO_SLUG). A hand-written map here once swapped 10/18/23 (blackbox/alnakheelk/lulu).
const STORE: Record<number, string> = new Proxy({} as Record<number, string>, { get: (_t, k) => resolveApprovedSlug(Number(k)) ?? String(k) });
const AMAZON = 2;
// --captured=<jsonl>: page-captured evidence (capture-listing-evidence.ts), applied through the SAME unified function the signals job uses.
const CAPTURED = argv.find((a) => a.startsWith("--captured="))?.split("=").slice(1).join("=");
const capturedByUrl = new Map<string, { field: string; value: string; url: string; captured_at: string }[]>();
if (CAPTURED && existsSync(resolve(process.cwd(), CAPTURED))) for (const l of readFileSync(resolve(process.cwd(), CAPTURED), "utf8").split(/\r?\n/).filter(Boolean)) { try { const o = JSON.parse(l); if (o.status === 200 && o.items?.length) capturedByUrl.set(o.url, o.items.map((i: { field: string; value: string }) => ({ ...i, url: o.url, captured_at: o.captured_at }))); } catch { /* skip */ } }
const brandOf = (title: string, key: string | null) => {
  const k = (key ?? "").split("|")[0];
  if (k && !/^\d/.test(k)) return k;
  const m = /samsung|lg|sony|tcl|hisense|toshiba|panasonic|skyworth|xiaomi|philips|nikai|impex|haier|bissell|midea|tefal|hitachi|dyson|bosch|karcher|eufy|roborock/i.exec(title);
  return m ? m[0].toLowerCase() : null;
};

type Row = { cid: string; key: string; store_id: number; name: string | null; price: string | null; url: string | null; payload: Record<string, unknown> | null };

(async () => {
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing");
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only");
  const result: Record<string, unknown> = { date: new Date().toISOString(), categories: CATS, captured_listings: capturedByUrl.size, price_use: "claim-identification only, never identity", limit: "cannot show comparisons recovered across groups (needs re-keying = cutover)" };
  for (const cat of CATS) {
    const rows = (await pg.query(
      `select cp.id::text as cid, cp.tps_identity_key as key, co.store_id, co.name, co.price::text as price, co.url,
              jsonb_build_object('mpn', r.payload->'mpn', 'modelNumber', r.payload->'modelNumber', 'model_number', r.payload->'model_number', 'model', r.payload->'model',
                                 'brand', r.payload->'brand', 'condition', r.payload->'condition', 'name_ar', r.payload->'name_ar', 'name_en', r.payload->'name_en', 'gtin', r.payload->'gtin', 'specifications', r.payload->'specifications') as payload
         from canonical_products cp
         join tps_current_offers co on co.identity_key = cp.tps_identity_key and co.status = 'valid' and co.payload->>'_superseded_by_identity' is null
         left join raw_observations r on r.id = co.raw_obs_id
        where cp.is_active and cp.category = $1 order by cp.id, co.store_id`, [cat])).rows as Row[];
    const byGroup = new Map<string, Row[]>();
    for (const r of rows) { const g = byGroup.get(r.cid); if (g) g.push(r); else byGroup.set(r.cid, [r]); }

    const tally = { groups_multi_store: 0, comparable_before: 0, comparable_after: 0, fully_verified: 0, split: 0, partially_verified: 0, unverified: 0, with_different_pair: 0, with_review_pair: 0 };
    const pairsByRelation: Record<PairRelation, number> = { MATCH_CANDIDATE_STRONG: 0, MATCH_CANDIDATE_MEDIUM: 0, DIFFERENT_VARIANT: 0, DIFFERENT_CONDITION: 0, REVIEW: 0, NO_EVIDENCE: 0 };
    const amazon = { groups_with_amazon: 0, verified_inclusion: 0, removed_due_to_conflict: 0, review_due_to_uncertainty: 0, no_evidence: 0 };
    const claims = { lowest_price_claims_before: 0, retained_verified: 0, no_longer_supported: 0, in_group_with_different_pair: 0 };
    const detail: unknown[] = [];

    for (const [cid, G] of byGroup) {
      const stores = new Set(G.map((x) => x.store_id));
      if (stores.size < 2) continue;
      tally.groups_multi_store++; tally.comparable_before++;
      const items = G.map((l) => {
        const payload = l.payload ?? {};
        const brand = (typeof payload.brand === "string" && payload.brand.trim() ? payload.brand.trim().toLowerCase() : null) ?? brandOf(l.name ?? "", l.key);
        const merchant = STORE[l.store_id] ?? String(l.store_id);
        return { evidence: extractModelEvidence({ merchant, title: l.name ?? "", brand, payload, captured: l.url ? capturedByUrl.get(l.url) : undefined }), brand, condition: conditionOf(l.name ?? "", payload) };
      });
      const sc = verifiedSubclusters(items);
      for (const p of sc.pairs) pairsByRelation[p.verdict.relation]++;
      const verifiedStores = sc.verified.map((c) => new Set(c.members.map((m) => G[m].store_id)));
      const comparableAfter = verifiedStores.some((s) => s.size >= 2);
      if (comparableAfter) tally.comparable_after++;
      const hasDifferent = sc.pairs.some((p) => p.verdict.relation === "DIFFERENT_VARIANT" || p.verdict.relation === "DIFFERENT_CONDITION");
      const hasReview = sc.pairs.some((p) => p.verdict.relation === "REVIEW");
      if (hasDifferent) tally.with_different_pair++;
      if (hasReview) tally.with_review_pair++;
      const all = sc.verified.length === 1 && sc.verified[0].members.length === G.length;
      const state = all ? "fully_verified" : sc.verified.length > 1 || (sc.verified.length >= 1 && hasDifferent) ? "split" : sc.verified.length === 1 ? "partially_verified" : "unverified";
      tally[state === "fully_verified" ? "fully_verified" : state === "split" ? "split" : state === "partially_verified" ? "partially_verified" : "unverified"]++;

      // Amazon
      const am = G.findIndex((l) => l.store_id === AMAZON);
      if (am >= 0) {
        amazon.groups_with_amazon++;
        const inVerified = sc.verified.some((c) => c.members.includes(am) && new Set(c.members.map((m) => G[m].store_id)).size >= 2);
        const conflict = sc.pairs.some((p) => (p.a === am || p.b === am) && (p.verdict.relation === "DIFFERENT_VARIANT" || p.verdict.relation === "DIFFERENT_CONDITION"));
        const review = sc.pairs.some((p) => (p.a === am || p.b === am) && p.verdict.relation === "REVIEW");
        if (inVerified) amazon.verified_inclusion++; else if (conflict) amazon.removed_due_to_conflict++; else if (review) amazon.review_due_to_uncertainty++; else amazon.no_evidence++;
      }
      // lowest-price claim (price only to NAME the listing that carries today's claim)
      const priced = G.map((l, i) => ({ i, p: l.price == null ? NaN : Number(l.price) })).filter((x) => x.p > 0);
      if (priced.length) {
        const low = priced.reduce((a, b) => (b.p < a.p ? b : a));
        claims.lowest_price_claims_before++;
        const supported = sc.verified.some((c) => c.members.includes(low.i) && new Set(c.members.map((m) => G[m].store_id)).size >= 2);
        if (supported) claims.retained_verified++; else claims.no_longer_supported++;
        if (hasDifferent) claims.in_group_with_different_pair++;
      }
      detail.push({
        cid, key: G[0].key, state, comparable_after: comparableAfter,
        listings: G.map((l, i) => ({ i, store: STORE[l.store_id] ?? l.store_id, title: (l.name ?? "").slice(0, 110), url: l.url, codes: items[i].evidence.filter((e) => e.usable_for_identity).map((e) => `${e.normalized_value}@${e.source_field}[${e.trust_level}]`), condition: items[i].condition })),
        verified: sc.verified, unverified: sc.unverified,
        pairs: sc.pairs.filter((p) => p.verdict.relation !== "NO_EVIDENCE").map((p) => ({ a: p.a, b: p.b, relation: p.verdict.relation, reasons: p.verdict.reasons })),
      });
    }
    result[cat] = { tally, pairs_by_relation: pairsByRelation, amazon, claims, groups: detail };
  }
  await pg.query("rollback"); await pg.end();
  const out = resolve(process.cwd(), OUT); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(result, null, 1));
  for (const cat of CATS) { const r = result[cat] as { tally: unknown; pairs_by_relation: unknown; amazon: unknown; claims: unknown }; console.log(cat, JSON.stringify({ tally: r.tally, pairs: r.pairs_by_relation, amazon: r.amazon, claims: r.claims })); }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
