// scripts/tps-analysis/rehearsal/scenario-v2-rollback.ts — ADR-403/404 write-path rollback REHEARSAL (2026-10-04).
// Runs ONLY against the loopback replica. Drives the REAL code: runSweepUnit (via run-sweep.ts), the signals job, the
// projection builder and scripts/tps-core/rollback-identity-v2.ts. Answers the founder's questions with measurements:
//   what does the v2 write path write · what remains after flag-off · how are v2 rows isolated/removed · does rollback
//   restore the behaviour AND the data · how long · does it need reconciliation.
//
//   npx tsx scripts/tps-analysis/rehearsal/scenario-v2-rollback.ts [--stores=2,4,5] [--repeat=4] [--categories=mobile,tv]
//   (requires start.ts + setup.ts done; restores the post-setup snapshot `baseline` first if it exists)
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import { localDbUrl, REPO } from "./lib";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const STORES = arg("stores", "2,4,5"), REPEAT = arg("repeat", "4"), CATS = arg("categories", "mobile,tv");
const OUTDIR = path.join(REPO, "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/rehearsal");
fs.mkdirSync(OUTDIR, { recursive: true });

const LOCAL = localDbUrl();
const NEUTRAL: NodeJS.ProcessEnv = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SERVICE_ROLE_KEY: "rehearsal-none", NEXT_PUBLIC_SUPABASE_ANON_KEY: "rehearsal-none", SUPABASE_DB_URL: LOCAL };
const timeline: { step: string; ms: number; ok: boolean; note?: string }[] = [];
const results: Record<string, unknown> = {};

function run(step: string, script: string, args: string[], env: NodeJS.ProcessEnv = {}): string {
  const t0 = Date.now();
  const clean = { ...process.env } as NodeJS.ProcessEnv;
  for (const k of Object.keys(clean)) if (/^(TPS_IDENTITY_|SUPABASE)/.test(k)) delete clean[k];
  const r = spawnSync("npx", ["tsx", script, ...args], { cwd: REPO, encoding: "utf8", shell: true, maxBuffer: 512 * 1024 * 1024, env: { ...clean, ...env } });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  timeline.push({ step, ms: Date.now() - t0, ok: r.status === 0, note: r.status === 0 ? undefined : out.slice(-400) });
  if (r.status !== 0) { console.error(`STEP FAILED: ${step}\n${out.slice(-1500)}`); }
  return out;
}
const reh = (s: string) => `scripts/tps-analysis/rehearsal/${s}`;
const jsonLines = (out: string) => out.split("\n").filter((l) => l.startsWith("{")).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

async function q<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: LOCAL }); await c.connect();
  try { return (await c.query(sql, args)).rows as T[]; } finally { await c.end(); }
}
async function state(label: string) {
  const [v2Canon, v2Offers, superseded, active, proj] = await Promise.all([
    q("select category, count(*)::int n from canonical_products where attributes->>'identity_rules' = 'v2' group by 1 order by 1"),
    q("select category, count(*)::int n from tps_current_offers where payload->>'_identity_rules' = 'v2' group by 1 order by 1"),
    q("select count(*)::int n from tps_current_offers where payload ? '_superseded_by_identity'"),
    q("select count(*) filter (where is_active)::int active, count(*)::int total from canonical_products where category = any($1::text[])", [CATS.split(",")]),
    q("select count(*)::int n, count(*) filter (where has_comparison)::int comparable from tps_product_projection where category = any($1::text[])", [CATS.split(",")]),
  ]);
  const snap = { label, v2_stamped_canonicals: v2Canon, v2_stamped_current_offers: v2Offers, superseded_current_offers: superseded[0], canonicals_in_scope: active[0], projection_in_scope: proj[0] };
  results[label] = snap; return snap;
}
async function projectionRows() {
  return q<{ key: string; category: string; store_count: number; has_comparison: boolean; lowest_price: string | null; highest_price: string | null; cheapest_store: string | null }>(
    "select tps_identity_key as key, category, store_count, has_comparison, lowest_price::text, highest_price::text, cheapest_store from tps_product_projection where category = any($1::text[]) order by 1", [CATS.split(",")]);
}
async function currentOffers() {
  return q<{ k: string; raw_obs_id: string; price: string | null; status: string; url: string | null; name: string | null; observed_at: string | null }>(
    "select category || '|' || identity_key || '|' || store_id as k, raw_obs_id::text, price::text, status, url, name, observed_at::text from tps_current_offers where category = any($1::text[]) order by 1", [CATS.split(",")]);
}
function diffOffers(a: Awaited<ReturnType<typeof currentOffers>>, b: Awaited<ReturnType<typeof currentOffers>>) {
  const B = new Map(b.map((r) => [r.k, r]));
  const missing = a.filter((r) => !B.has(r.k)).length;
  const differing = a.filter((r) => B.has(r.k) && JSON.stringify(r) !== JSON.stringify(B.get(r.k)));
  const extra = b.length - (a.length - missing);
  return { rows_before: a.length, rows_after: b.length, missing_after: missing, differing_after: differing.length, extra_rows_after: extra, differing_examples: differing.slice(0, 5).map((r) => ({ before: r, after: B.get(r.k) })) };
}
function diffProjection(a: Awaited<ReturnType<typeof projectionRows>>, b: Awaited<ReturnType<typeof projectionRows>>) {
  const A = new Map(a.map((r) => [r.key, r])), B = new Map(b.map((r) => [r.key, r]));
  const onlyA = [...A.keys()].filter((k) => !B.has(k)), onlyB = [...B.keys()].filter((k) => !A.has(k));
  const changed = [...A.keys()].filter((k) => B.has(k) && JSON.stringify(A.get(k)) !== JSON.stringify(B.get(k)));
  return { rows_a: a.length, rows_b: b.length, only_in_a: onlyA.length, only_in_b: onlyB.length, changed: changed.length, equal: !onlyA.length && !onlyB.length && !changed.length,
    examples: { only_in_a: onlyA.slice(0, 5), only_in_b: onlyB.slice(0, 5), changed: changed.slice(0, 5).map((k) => ({ key: k, a: A.get(k), b: B.get(k) })) } };
}

(async () => {
  console.log("== start / restore baseline");
  run("start", reh("start.ts"), []);
  const snaps = run("snapshot list", reh("db-snapshot.ts"), ["list"]);
  if (/tps_snap_baseline/.test(snaps)) run("restore baseline", reh("db-snapshot.ts"), ["restore", "baseline"]); else run("save baseline", reh("db-snapshot.ts"), ["save", "baseline"]);

  // ── A. v1 steady state (flags unset) ──────────────────────────────────────────────────────────────────────────
  console.log("== A. v1 sweeps (flags unset)");
  results.v1_sweeps = jsonLines(run("A sweeps v1", reh("run-sweep.ts"), ["--limit", "500", "--stores", STORES, "--repeat", REPEAT, "--rewind"])).map((j) => ({ fetched: j.fetched, staged: j.staged, corroborate: Object.keys(j.corroborate ?? {}).length }));
  run("A snapshot", reh("snapshot.ts"), ["--out", path.join(OUTDIR, "S1-v1.json")]);
  await state("S1_v1_steady");
  run("save v1done", reh("db-snapshot.ts"), ["save", "v1done"]);
  run("A projection v1", "scripts/build-tps-projection.ts", ["--quiet"], NEUTRAL);
  const P1 = await projectionRows(); await state("S1_after_projection");
  const OFFERS1 = await currentOffers();

  // ── B. v2 write path ON (re-observation of the same listings) ─────────────────────────────────────────────────
  console.log("== B. v2 write path on");
  results.v2_sweeps = jsonLines(run("B sweeps v2", reh("run-sweep.ts"), ["--limit", "500", "--stores", STORES, "--repeat", REPEAT, "--rewind"], { TPS_IDENTITY_V2: CATS })).map((j) => ({ fetched: j.fetched, staged: j.staged, corroborate: j.corroborate }));
  run("B snapshot", reh("snapshot.ts"), ["--out", path.join(OUTDIR, "S2-v2.json")]);
  results.diff_S1_S2 = run("B diff", reh("snapshot.ts"), ["--diff", path.join(OUTDIR, "S1-v1.json"), path.join(OUTDIR, "S2-v2.json")]).split("\n").filter(Boolean).slice(-40);
  await state("S2_v2_written");
  run("B projection v2", "scripts/build-tps-projection.ts", ["--quiet"], NEUTRAL);
  const P2 = await projectionRows(); results.projection_v1_vs_v2_written = diffProjection(P1, P2);
  run("save v2done", reh("db-snapshot.ts"), ["save", "v2done"]);

  // ── C. flag OFF again, listings re-observed (what REMAINS) ───────────────────────────────────────────────────
  console.log("== C. flag off, re-observe");
  run("C sweeps v1 (flag off)", reh("run-sweep.ts"), ["--limit", "500", "--stores", STORES, "--repeat", REPEAT, "--rewind"]);
  run("C snapshot", reh("snapshot.ts"), ["--out", path.join(OUTDIR, "S3-flagoff.json")]);
  results.diff_S2_S3 = run("C diff", reh("snapshot.ts"), ["--diff", path.join(OUTDIR, "S2-v2.json"), path.join(OUTDIR, "S3-flagoff.json")]).split("\n").filter(Boolean).slice(-40);
  const s3 = await state("S3_flag_off_residual");
  run("C projection", "scripts/build-tps-projection.ts", ["--quiet"], NEUTRAL);
  const P3 = await projectionRows(); results.projection_v1_vs_flagoff_residual = diffProjection(P1, P3);

  // ── D. rollback script ───────────────────────────────────────────────────────────────────────────────────────
  console.log("== D. rollback (dry, then --go, then idempotency)");
  results.rollback_dry = jsonLines(run("D rollback dry", "scripts/tps-core/rollback-identity-v2.ts", [`--categories=${CATS}`], NEUTRAL))[0];
  results.rollback_go = jsonLines(run("D rollback --go", "scripts/tps-core/rollback-identity-v2.ts", [`--categories=${CATS}`, "--go"], NEUTRAL))[0];
  await state("S4_after_rollback");
  results.rollback_go_again = jsonLines(run("D rollback --go (idempotency)", "scripts/tps-core/rollback-identity-v2.ts", [`--categories=${CATS}`, "--go"], NEUTRAL))[0];
  run("D projection", "scripts/build-tps-projection.ts", ["--quiet"], NEUTRAL);
  const P4 = await projectionRows(); results.projection_v1_vs_after_rollback = diffProjection(P1, P4);
  results.current_offers_v1_vs_after_rollback = diffOffers(OFFERS1, await currentOffers());

  // ── E. read-path gate (signals table) on the v1 steady state, then flag off ──────────────────────────────────
  console.log("== E. read-path gate on v1 state");
  run("E restore v1done", reh("db-snapshot.ts"), ["restore", "v1done"]);
  run("E projection (gate unset)", "scripts/build-tps-projection.ts", ["--quiet"], NEUTRAL);
  const P5 = await projectionRows();
  const sig = jsonLines(run("E signals job (gate on)", "scripts/tps-core/build-identity-signals.ts", [], { ...NEUTRAL, TPS_IDENTITY_GATE: CATS }))[0]; results.signals_job_on = sig;
  run("E projection (gate on)", "scripts/build-tps-projection.ts", ["--quiet"], { ...NEUTRAL, TPS_IDENTITY_GATE: CATS });
  const P6 = await projectionRows(); results.projection_gate_off_vs_on = diffProjection(P5, P6);
  results.signals_rows = await q("select category, verdict, count(*)::int n from tps_offer_identity_signals group by 1, 2 order by 1, 2");
  const sig2 = jsonLines(run("E signals job (idempotent re-run)", "scripts/tps-core/build-identity-signals.ts", [], { ...NEUTRAL, TPS_IDENTITY_GATE: CATS }))[0]; results.signals_job_rerun = sig2;
  const off = jsonLines(run("E signals job (flag OFF = rollback)", "scripts/tps-core/build-identity-signals.ts", [], NEUTRAL))[0]; results.signals_job_off = off;
  run("E projection (gate off again)", "scripts/build-tps-projection.ts", ["--quiet"], NEUTRAL);
  const P7 = await projectionRows(); results.projection_after_gate_rollback_equals_original = diffProjection(P5, P7);
  results.signals_rows_after_off = await q("select count(*)::int n from tps_offer_identity_signals");

  results.timeline = timeline; results.params = { stores: STORES, repeat: REPEAT, categories: CATS, at: new Date().toISOString() };
  const out = path.join(OUTDIR, `scenario-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  console.log(JSON.stringify({ written: out, timeline }, null, 1));
  console.log(JSON.stringify({ S3_residual: s3, rollback_go: results.rollback_go, projection_equal_after_rollback: (results.projection_v1_vs_after_rollback as { equal: boolean }).equal, gate_rollback_equal: (results.projection_after_gate_rollback_equals_original as { equal: boolean }).equal }, null, 1));
})().catch((e) => { console.error("scenario failed:", e); process.exit(1); });
