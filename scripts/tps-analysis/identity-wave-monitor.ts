// scripts/tps-analysis/identity-wave-monitor.ts — ADR-404/405 cutover monitoring.
// ─────────────────────────────────────────────────────────────────────────────
// What to look at after enabling TPS_IDENTITY_GATE for a category, and when to roll that category back.
// READ-ONLY on every pipeline and customer table; the only write is the append-only measurement row in
// `tps_identity_wave_log` (--persist), so the evidence outlives any session.
//
// Per category it measures:
//   • run health         — the isolated runner's last successful run and recent failures (tps_job_state, NOT signal
//                          computed_at: the signals job only touches rows whose verdict changed);
//   • verdict shares     — review / reject as a share of listings in multi-store canonicals;
//   • projection effect  — comparison count now vs the stored baseline (--baseline=db | <file>);
//   • identity effect    — from ONE snapshot of current offers: comparisons / cheapest-price claims / winners that exist
//                          only because an unconfirmed listing was counted. Prices are held fixed, so this is the
//                          identity effect, not price drift;
//   • merchants / Amazon — per-merchant participation in clean comparisons, Amazon kept / removed (an outcome, never a target);
//   • surface agreement  — (--consistency=N) a sample of keys through the live /api/compare, to see a signalled listing
//                          the page still shows as verified;
//   • candidate scan     — an INDEPENDENT scan of verified groups for two different stated model codes (the check that
//                          exposed the TV short-code gap). Informational: it lists candidates for a human, never a trigger;
//   • an audit sample    — N random currently-VERIFIED comparison groups for a human to read.
//
// Verdict ROLLBACK_REQUIRED (exit 2, `[ALERT]` on stderr, persisted) when a mechanical trigger fires: stale signals, runner
// repeatedly failing, runaway share, unexplained comparison collapse, an unexpected broad-chain run, or a human-reported
// confirmed false merge (--audit-false-merges=<n>). Automatic removal of the flag is deliberately NOT built: it would need a
// Railway token inside the worker (a broad credential); the alert + failed job state + stopped wave progression is the contract.
//
//   npx tsx scripts/tps-analysis/identity-wave-monitor.ts --categories=vacuum [--sample=25] [--persist]
//        [--save-baseline=db|file.json] [--baseline=db|file.json] [--consistency=20] [--audit-false-merges=0]
// Rollback of one category: remove it from TPS_IDENTITY_GATE on BOTH Railway services (read paths stop consulting the
// table immediately; the next runner cycle rebuilds the scope's projection ungated). If TPS_IDENTITY_V2 was enabled for it,
// also run scripts/tps-core/rollback-identity-v2.ts --categories=<cat> --go.
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

const argv = process.argv.slice(2);
const arg = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? null;
const flag = (k: string) => argv.includes(`--${k}`);
const CATS = (arg("categories") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const SAMPLE = Number(arg("sample") ?? 25);
const MAX_SHARE = Number(arg("max-share") ?? 0.35);
const STALE_H = Number(arg("stale-hours") ?? 3);
const COLLAPSE = Number(arg("collapse") ?? 0.4);
const AUDIT_FALSE = Number(arg("audit-false-merges") ?? 0);
const CONSISTENCY = Number(arg("consistency") ?? 0);
const PERSIST = flag("persist");
const SOURCE = (arg("source") ?? (PERSIST ? "runner" : "manual")) as "runner" | "manual" | "baseline";
if (!CATS.length) { console.error("--categories=<a,b> required"); process.exit(1); }
if (CATS.some((c) => !/^[a-z0-9_]+$/.test(c))) { console.error("invalid --categories"); process.exit(1); }

const AMAZON_STORE_ID = 2;
const WAVE_LOG_DDL = "scripts/database/knowledge-db/038_identity_wave_log.sql";

// ── independent stated-code scan (informational) ────────────────────────────────────────
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const NOT_A_CODE = /INCH|SMART|QLED|LED|MINI|OLED|UHD|CRYSTAL|GOOGLE|VIDAA|HDR|DOLBY|FRAME|VACUUM|CLEANER|WATT|BAGLESS|CANISTER|POWER|DRUM|CORDLESS|STICK|ROBOT/;
const SHORT_CODE = /^\d{2,3}[A-Z]{1,2}\d[A-Z0-9]{0,3}(PRO)?$/; // 85T8D 65S7N 55E8S 85C6KPRO
const LONG_CODE = /^(?=.*\d)(?=.*[A-Z])[A-Z0-9]{8,18}$/; // QA55Q7FAAUXSA CV960FSS220
const looksLikeCode = (t: string) => !NOT_A_CODE.test(t) && (SHORT_CODE.test(t) || LONG_CODE.test(t)) && !/^\d+(HZ|K|W|L|GB|TB)$/.test(t);
function statedCodes(name: string | null, payload: Record<string, unknown> | null): string[] {
  const out = new Set<string>();
  for (const f of ["modelNumber", "model_number", "mpn", "model"]) {
    const v = payload?.[f];
    if (typeof v === "string" && v.length <= 22) { const t = norm(v); if (looksLikeCode(t)) out.add(t); }
  }
  for (const tok of String(name ?? "").split(/[\s,()/|–-]+/)) { const t = norm(tok); if (t && looksLikeCode(t)) out.add(t); }
  return [...out];
}
// Compatible = equal, one a prefix of the other (a retailer truncating the code), or the same code up to a short suffix — the
// colour/region tail (CV-BA18SS220-BRE vs -PWH) that the founder rule says is not a variant. 55P8L vs 55P8K stays a conflict.
const sharedPrefix = (x: string, y: string) => { let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
const codesCompatible = (a: string[], b: string[]) => a.some((x) => b.some((y) => x === y || x.startsWith(y) || y.startsWith(x) || sharedPrefix(x, y) >= Math.max(8, Math.min(x.length, y.length) - 3)));

type Row = Record<string, unknown>;
const hoursSince = (v: unknown) => (v ? (Date.now() - new Date(v as string).getTime()) / 3_600_000 : null);
const round = (v: number | null, d = 2) => (v == null ? null : Number(v.toFixed(d)));

async function ensureLogTable(pg: Client) {
  const exists = (await pg.query("select to_regclass('tps_identity_wave_log') as t")).rows[0].t !== null;
  if (!exists) await pg.query(readFileSync(resolve(process.cwd(), WAVE_LOG_DDL), "utf8"));
}

(async () => {
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing");
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const connStr = toPoolerDbUrl(url);
  const pg = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only");
  const out: Record<string, unknown> = { at: new Date().toISOString(), categories: {} };
  const triggers: string[] = [];
  const warnings: string[] = [];

  // baseline: a file, or the stored pre-wave row(s) in the log table
  let baseline: { at?: string; categories?: Record<string, { comparable: number; total: number }> } | null = null;
  const logExists = (await pg.query("select to_regclass('tps_identity_wave_log') as t")).rows[0].t !== null;
  if (arg("baseline") === "db") {
    if (logExists) {
      const rows = (await pg.query("select taken_at, metrics from tps_identity_wave_log where source = 'baseline' order by taken_at asc")).rows as { taken_at: string; metrics: { categories?: Record<string, { comparable: number; total: number }> } }[];
      if (rows.length) {
        baseline = { at: new Date(rows[0].taken_at).toISOString(), categories: {} };
        for (const r of rows) Object.assign(baseline.categories!, r.metrics.categories ?? {}); // later rows override per category
      }
    }
    if (!baseline) warnings.push("--baseline=db requested but no baseline row exists: collapse / broad-chain triggers are not evaluated");
  } else if (arg("baseline")) baseline = JSON.parse(readFileSync(arg("baseline")!, "utf8"));
  const saved: Record<string, unknown> = {};

  const hasTable = (await pg.query("select to_regclass('tps_offer_identity_signals') as t")).rows[0].t !== null;

  // ── run health (ADR-405): the RUN's success, not a row's computed_at ──
  const jobs = Object.fromEntries((await pg.query("select job, last_success_at, updated_at, last_note from tps_job_state where job in ('identity_gate','refresh')")).rows.map((r) => [r.job, r]));
  const runnerOkH = hoursSince(jobs.identity_gate?.last_success_at);
  const chainOkH = hoursSince(jobs.refresh?.last_success_at);
  const runAgeH = [runnerOkH, chainOkH].filter((v): v is number => v != null).sort((a, b) => a - b)[0] ?? null;
  const noteSeconds = /(\d+(?:\.\d+)?)s\b[^|]*$/.exec(String(jobs.identity_gate?.last_note ?? "").split("|").find((p) => /steps succeeded in/.test(p)) ?? "");
  out.runner = {
    identity_gate: jobs.identity_gate ?? null, refresh_chain: jobs.refresh ?? null, run_age_hours: round(runAgeH),
    last_run_seconds: noteSeconds ? Number(noteSeconds[1]) : null,
  };
  // "Repeatedly failing": the latest attempt ran > 1.5 h after the last success (≈ two consecutive failed hourly cycles).
  const gateJob = jobs.identity_gate;
  if (gateJob?.last_success_at && gateJob?.updated_at) {
    const sinceOk = hoursSince(gateJob.last_success_at)!, sinceTry = hoursSince(gateJob.updated_at)!;
    if (sinceOk - sinceTry > 1.5) triggers.push(`isolated runner failing: last success ${sinceOk.toFixed(1)} h ago, latest attempt ${sinceTry.toFixed(1)} h ago (${String(gateJob.last_note).slice(0, 80)})`);
  }
  if (baseline?.at && jobs.refresh?.updated_at && new Date(jobs.refresh.updated_at).getTime() > Date.parse(baseline.at)) triggers.push(`unexpected broad-chain execution: 'refresh' job state changed at ${new Date(jobs.refresh.updated_at).toISOString()} (after the baseline)`);

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
    const ageH = runAgeH;
    const share = listings ? (sig.review + sig.reject) / listings : 0;
    const base = baseline?.categories?.[cat];
    const collapse = base?.comparable ? 1 - proj.comparable / base.comparable : 0;
    if (!hasTable || ageH == null || ageH > STALE_H) triggers.push(`${cat}: signals missing/stale (last successful run ${ageH?.toFixed(1) ?? "never"} h ago > ${STALE_H} h)`);
    if (listings >= 20 && share > MAX_SHARE) triggers.push(`${cat}: verdict share ${(share * 100).toFixed(1)}% > ${(MAX_SHARE * 100).toFixed(0)}%`);
    if (base && collapse > COLLAPSE && (sig.review + sig.reject) < (base.comparable - proj.comparable) / 4) triggers.push(`${cat}: comparable products fell ${(collapse * 100).toFixed(0)}% (${base.comparable} → ${proj.comparable}) with far fewer signals than the drop — unexplained`);

    // ── identity effect: ONE snapshot of current offers, prices held fixed ──
    let identityEffect: Row | null = null, merchants: Row[] = [];
    if (hasTable) {
      const OFFERS = `with o as (
          select c.id as cid, co.store_id, co.price::numeric as price, s.verdict
            from canonical_products c
            join tps_current_offers co on co.identity_key = c.tps_identity_key and co.status = 'valid' and co.price > 0
                 and coalesce(co.payload->>'_availability','') <> 'out_of_stock' and co.payload->>'_superseded_by_identity' is null
            left join tps_offer_identity_signals s on s.canonical_product_id = c.id and s.store_id = co.store_id
           where c.is_active and c.category = $1)`;
      identityEffect = (await pg.query(
        `${OFFERS}, agg as (
           select cid, count(distinct store_id) as n_all, count(distinct store_id) filter (where verdict is null) as n_clean,
                  (array_agg(store_id order by price asc, store_id asc))[1] as cheapest_all_store, min(price) as min_all,
                  (array_agg(store_id order by price asc, store_id asc) filter (where verdict is null))[1] as cheapest_clean_store,
                  min(price) filter (where verdict is null) as min_clean,
                  bool_or(verdict is not null) as has_sig,
                  bool_or(store_id = ${AMAZON_STORE_ID} and verdict is null) as amazon_clean, bool_or(store_id = ${AMAZON_STORE_ID} and verdict is not null) as amazon_sig
             from o group by 1)
         select count(*) filter (where has_sig)::int as canonicals_with_unconfirmed_offer,
                count(*) filter (where n_all >= 2 and n_clean < 2)::int as comparisons_removed,
                count(*) filter (where n_clean >= 2)::int as comparisons_verified,
                count(*) filter (where n_clean >= 2 and has_sig)::int as comparisons_kept_after_dropping_unconfirmed,
                count(*) filter (where has_sig and min_all < coalesce(min_clean, 1e12))::int as lowest_price_claims_removed,
                count(*) filter (where n_clean >= 2 and has_sig and cheapest_all_store <> cheapest_clean_store and min_all < min_clean)::int as cheapest_merchant_changed_by_identity,
                count(*) filter (where amazon_sig)::int as amazon_listings_unconfirmed,
                count(*) filter (where amazon_clean and n_clean >= 2)::int as amazon_in_verified_comparisons,
                count(*) filter (where amazon_clean and n_clean >= 2 and cheapest_clean_store = ${AMAZON_STORE_ID})::int as amazon_cheapest_in_verified_comparisons
           from agg`, [cat])).rows[0];
      merchants = (await pg.query(
        `${OFFERS}, comp as (select cid from o group by 1 having count(distinct store_id) filter (where verdict is null) >= 2)
         select store_id, count(*) filter (where verdict is null and cid in (select cid from comp))::int as in_verified_comparisons,
                count(*) filter (where verdict = 'review')::int as review, count(*) filter (where verdict = 'reject')::int as reject
           from o group by 1 order by 1`, [cat])).rows;
    }

    // ── independent candidate scan over VERIFIED groups (two different stated model codes) ──
    const offerRows = (await pg.query(
      `select co.identity_key as k, co.store_id, co.name, r.payload
         from tps_current_offers co
         join canonical_products cp on cp.tps_identity_key = co.identity_key and cp.is_active and cp.category = $1
         left join raw_observations r on r.id = co.raw_obs_id
         ${hasTable ? "left join tps_offer_identity_signals s on s.canonical_product_id = cp.id and s.store_id = co.store_id" : ""}
        where co.status = 'valid' ${hasTable ? "and s.canonical_product_id is null" : ""}
        order by 1, 2`, [cat])).rows as { k: string; store_id: number; name: string | null; payload: Record<string, unknown> | null }[];
    const byKey = new Map<string, typeof offerRows>();
    for (const x of offerRows) { const l = byKey.get(x.k); if (l) l.push(x); else byKey.set(x.k, [x]); }
    let verifiedGroups = 0; const candidates: string[] = [];
    for (const [k, L] of byKey) {
      if (new Set(L.map((x) => x.store_id)).size < 2) continue;
      verifiedGroups++;
      const cs = L.map((x) => ({ s: x.store_id, codes: statedCodes(x.name, x.payload) }));
      let bad: [typeof cs[number], typeof cs[number]] | null = null;
      for (let i = 0; i < cs.length && !bad; i++) for (let j = i + 1; j < cs.length && !bad; j++) if (cs[i].codes.length && cs[j].codes.length && !codesCompatible(cs[i].codes, cs[j].codes)) bad = [cs[i], cs[j]];
      if (bad) candidates.push(`${k}  ${bad[0].s}:${bad[0].codes.join("/")}  vs  ${bad[1].s}:${bad[1].codes.join("/")}`);
    }
    if (candidates.length) warnings.push(`${cat}: ${candidates.length} verified group(s) hold two different stated model codes — candidates for a human to confirm (not a trigger)`);

    // ── audit sample: random verified (no signal) comparison groups, titles side by side ──
    const sample = SAMPLE > 0 ? (await pg.query(
      `with g as (
         select c.id, c.tps_identity_key as key, c.name_en, array_agg(co.store_id order by co.store_id) stores, array_agg(left(co.name, 90) order by co.store_id) titles
           from canonical_products c join tps_current_offers co on co.identity_key = c.tps_identity_key and co.status = 'valid'
          where c.is_active and c.category = $1
            ${hasTable ? "and not exists (select 1 from tps_offer_identity_signals s where s.canonical_product_id = c.id and s.store_id = co.store_id)" : ""}
          group by 1, 2, 3 having count(distinct co.store_id) >= 2)
       select * from g order by md5(id::text || $3::text) limit $2`, [cat, SAMPLE, new Date().toISOString().slice(0, 10)])).rows : [];

    // ── surface agreement: live /api/compare vs the signals table ──
    let surface: Row | null = null;
    if (CONSISTENCY > 0) {
      const appBase = (process.env.NEXT_PUBLIC_APP_URL || "https://tawveeri.com").replace(/\/$/, "");
      const keys = (await pg.query(
        `select p.tps_identity_key as key, p.store_count, p.has_comparison, c.id::text as cid from tps_product_projection p join canonical_products c on c.id = p.canonical_id
          where p.category = $1 and (p.has_comparison or exists (select 1 from tps_offer_identity_signals s where s.canonical_product_id = c.id))
          order by md5(p.canonical_id::text || $3::text) limit $2`, [cat, CONSISTENCY, new Date().toISOString().slice(0, 13)])).rows as { key: string; store_count: number; has_comparison: boolean; cid: string }[];
      const sigKeys = new Map<string, string>();
      if (hasTable && keys.length) for (const r of (await pg.query("select canonical_product_id::text as cid, store_slug, verdict from tps_offer_identity_signals where canonical_product_id = any($1::uuid[])", [keys.map((k) => k.cid)])).rows) sigKeys.set(`${r.cid}|${r.store_slug}`, r.verdict);
      let checked = 0, failed = 0, signalledShownAsVerified = 0; const detail: string[] = [];
      for (const k of keys) {
        try {
          const res = await fetch(`${appBase}/api/compare?key=${encodeURIComponent(k.key)}&locale=en`, { signal: AbortSignal.timeout(15_000) });
          if (!res.ok) { failed++; continue; }
          const j = await res.json() as { offers?: { store_slug?: string; store?: string; identity_verdict?: unknown }[] };
          checked++;
          for (const o of j.offers ?? []) {
            const slug = o.store_slug ?? o.store ?? "";
            if (sigKeys.has(`${k.cid}|${slug}`) && !o.identity_verdict) { signalledShownAsVerified++; if (detail.length < 8) detail.push(`${k.key} @${slug}`); }
          }
        } catch { failed++; }
        await new Promise((r) => setTimeout(r, 2500)); // stay well under the middleware's per-IP API limit
      }
      surface = { requested: keys.length, checked, failed, signalled_listing_shown_as_verified: signalledShownAsVerified, detail };
      if (failed > keys.length / 2 && keys.length >= 4) warnings.push(`${cat}: surface check failed for ${failed}/${keys.length} requests`);
      if (signalledShownAsVerified) warnings.push(`${cat}: ${signalledShownAsVerified} signalled listing(s) shown as verified on /api/compare (tier/membership difference — see detail)`);
    }

    (out.categories as Record<string, unknown>)[cat] = {
      projection: proj, signals: sig, listings_in_multi_store: listings, verdict_share: Number(share.toFixed(4)), signal_age_hours: round(ageH),
      baseline_comparable: base?.comparable ?? null, identity_effect: identityEffect, merchants,
      verified_groups_scanned: verifiedGroups, code_conflict_candidates: candidates, surface, audit_sample: sample,
    };
    saved[cat] = { comparable: proj.comparable, total: proj.total };
  }
  if (AUDIT_FALSE > 0) triggers.push(`audit: ${AUDIT_FALSE} confirmed false merge(s) in the sample`);
  await pg.query("rollback"); await pg.end();

  out.triggers = triggers; out.warnings = warnings; out.verdict = triggers.length ? "ROLLBACK_REQUIRED" : "HEALTHY";

  // ── persistence (append-only) ──
  const saveBaseline = arg("save-baseline");
  if (saveBaseline && saveBaseline !== "db") writeFileSync(saveBaseline, JSON.stringify({ at: out.at, categories: saved }, null, 1));
  if (PERSIST || saveBaseline === "db") {
    const w = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    await w.connect();
    try {
      await ensureLogTable(w);
      if (saveBaseline === "db") await w.query("insert into tps_identity_wave_log (source, categories, verdict, triggers, metrics) values ('baseline', $1, 'BASELINE', '{}', $2)", [CATS, JSON.stringify({ at: out.at, categories: saved })]);
      if (PERSIST) await w.query("insert into tps_identity_wave_log (source, categories, verdict, triggers, metrics) values ($1, $2, $3, $4, $5)", [SOURCE, CATS, out.verdict, triggers, JSON.stringify(out)]);
    } finally { await w.end(); }
  }

  console.log(JSON.stringify(out, null, 1));
  if (triggers.length) console.error(`[ALERT] identity wave ROLLBACK_REQUIRED for ${CATS.join(",")}: ${triggers.join(" | ")}`);
  process.exit(triggers.length ? 2 : 0);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
