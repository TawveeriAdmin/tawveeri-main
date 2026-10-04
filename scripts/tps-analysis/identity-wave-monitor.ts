// scripts/tps-analysis/identity-wave-monitor.ts — ADR-404 cutover monitoring. READ-ONLY.
// ─────────────────────────────────────────────────────────────────────────────
// What to look at after enabling TPS_IDENTITY_GATE for a category, and when to roll that category
// back. Per category it reports:
//   • signal freshness  — newest computed_at (the chain's `identity-gate` step must have run in the last 3 h);
//   • verdict shares     — review / reject as a share of listings in multi-store canonicals;
//   • projection effect  — has_comparison count now vs a saved baseline (--baseline=<file> / --save-baseline);
//   • an audit sample    — N random currently-VERIFIED comparison groups (their listing titles side by side), for a
//     human to read: ONE confirmed false merge in the sample is a rollback trigger.
// Exit code 2 and "ROLLBACK_RECOMMENDED" when a mechanical trigger fires (stale signals, runaway share, projection
// collapse without matching signals). The audit trigger is human input: --audit-false-merges=<n>.
//
//   npx tsx scripts/tps-analysis/identity-wave-monitor.ts --categories=tv,vacuum [--sample=25]
//        [--save-baseline=file.json | --baseline=file.json] [--audit-false-merges=0]
// Rollback of one category: unset it from TPS_IDENTITY_GATE on BOTH Railway services (read paths stop consulting the
// table immediately; the next chain run deletes its rows). If TPS_IDENTITY_V2 was enabled for it, also run
// scripts/tps-core/rollback-identity-v2.ts --categories=<cat> --go.
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

const argv = process.argv.slice(2);
const arg = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? null;
const CATS = (arg("categories") ?? "").split(",").filter(Boolean);
const SAMPLE = Number(arg("sample") ?? 25);
const MAX_SHARE = Number(arg("max-share") ?? 0.35);
const STALE_H = Number(arg("stale-hours") ?? 3);
const COLLAPSE = Number(arg("collapse") ?? 0.4);
const AUDIT_FALSE = Number(arg("audit-false-merges") ?? 0);
if (!CATS.length) { console.error("--categories=<a,b> required"); process.exit(1); }

(async () => {
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing");
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only");
  const out: Record<string, unknown> = { at: new Date().toISOString(), categories: {} };
  const triggers: string[] = [];
  const baseline = arg("baseline") ? JSON.parse(readFileSync(arg("baseline")!, "utf8")) : null;
  const saved: Record<string, unknown> = {};
  const hasTable = (await pg.query("select to_regclass('tps_offer_identity_signals') as t")).rows[0].t !== null;
  for (const cat of CATS) {
    const proj = (await pg.query("select count(*) filter (where has_comparison)::int as comparable, count(*)::int as total from tps_product_projection where category = $1", [cat])).rows[0];
    let sig = { review: 0, reject: 0, newest: null as string | null, version: null as string | null };
    if (hasTable) {
      const r = (await pg.query("select count(*) filter (where verdict='review')::int as review, count(*) filter (where verdict='reject')::int as reject, max(computed_at) as newest, max(rules_version) as version from tps_offer_identity_signals where category = $1", [cat])).rows[0];
      sig = { review: r.review, reject: r.reject, newest: r.newest ? new Date(r.newest).toISOString() : null, version: r.version };
    }
    const listings = (await pg.query(
      `select count(*)::int as n from tps_current_offers co join canonical_products c on c.tps_identity_key = co.identity_key
        where c.is_active and c.category = $1 and co.status = 'valid' and co.identity_key in (select identity_key from tps_current_offers where status='valid' group by 1 having count(distinct store_id) >= 2)`, [cat])).rows[0].n as number;
    const ageH = sig.newest ? (Date.now() - Date.parse(sig.newest)) / 3_600_000 : null;
    const share = listings ? (sig.review + sig.reject) / listings : 0;
    const base = baseline?.categories?.[cat];
    const collapse = base?.comparable ? 1 - proj.comparable / base.comparable : 0;
    if (!hasTable || ageH == null || ageH > STALE_H) triggers.push(`${cat}: signals missing/stale (age ${ageH?.toFixed(1) ?? "none"} h > ${STALE_H} h)`);
    if (listings >= 20 && share > MAX_SHARE) triggers.push(`${cat}: verdict share ${(share * 100).toFixed(1)}% > ${(MAX_SHARE * 100).toFixed(0)}%`);
    if (base && collapse > COLLAPSE && (sig.review + sig.reject) < (base.comparable - proj.comparable) / 4) triggers.push(`${cat}: comparable products fell ${(collapse * 100).toFixed(0)}% (${base.comparable} → ${proj.comparable}) with far fewer signals than the drop — unexplained`);
    // audit sample: random verified (no signal) comparison groups, titles side by side
    const sample = (await pg.query(
      `with g as (
         select c.id, c.tps_identity_key as key, c.name_en, array_agg(co.store_id order by co.store_id) stores, array_agg(left(co.name, 90) order by co.store_id) titles
           from canonical_products c join tps_current_offers co on co.identity_key = c.tps_identity_key and co.status = 'valid'
          where c.is_active and c.category = $1
            ${hasTable ? "and not exists (select 1 from tps_offer_identity_signals s where s.canonical_product_id = c.id and s.store_id = co.store_id)" : ""}
          group by 1, 2, 3 having count(distinct co.store_id) >= 2)
       select * from g order by md5(id::text || $3::text) limit $2`, [cat, SAMPLE, new Date().toISOString().slice(0, 10)])).rows;
    (out.categories as Record<string, unknown>)[cat] = { projection: proj, signals: sig, listings_in_multi_store: listings, verdict_share: Number(share.toFixed(4)), signal_age_hours: ageH && Number(ageH.toFixed(2)), baseline_comparable: base?.comparable ?? null, audit_sample: sample };
    saved[cat] = { comparable: proj.comparable, total: proj.total };
  }
  if (AUDIT_FALSE > 0) triggers.push(`audit: ${AUDIT_FALSE} confirmed false merge(s) in the sample`);
  await pg.query("rollback"); await pg.end();
  if (arg("save-baseline")) writeFileSync(arg("save-baseline")!, JSON.stringify({ at: out.at, categories: saved }, null, 1));
  out.triggers = triggers; out.verdict = triggers.length ? "ROLLBACK_RECOMMENDED" : "HEALTHY";
  console.log(JSON.stringify(out, null, 1));
  process.exit(triggers.length ? 2 : 0);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
