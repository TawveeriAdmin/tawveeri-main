// scripts/tps-analysis/rehearsal/scenario-identity-runner.ts — ADR-405 isolated identity-gate runner REHEARSAL (2026-10-04).
// Runs ONLY against the loopback replica. Independent of the unit tests: it compares what the runner produces with what the
// ORIGINAL code (git HEAD copies of the signals job and the projection builder, taken before ADR-405) produces on the SAME
// inputs, and measures the blast radius with row hashes of every pipeline table.
//
//   npx tsx scripts/tps-analysis/rehearsal/scenario-identity-runner.ts [--categories=tv,vacuum]
//
// Questions answered (founder §11): 1 flags off → no change · 2 the runner runs only identity-gate/projection · 3 signals ==
// original path · 4 projection == original path · 5 rerun idempotent · 6 disable/rollback returns the baseline ·
// + failure semantics (signals failure ⇒ no projection; projection failure ⇒ all-or-nothing, no partial scope).
import { spawnSync, execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import { localDbUrl, REPO } from "./lib";

const CATS = (process.argv.find((a) => a.startsWith("--categories="))?.split("=")[1] ?? "tv,vacuum");
const OUT = path.join(REPO, "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/wave1");
fs.mkdirSync(OUT, { recursive: true });
const LOCAL = localDbUrl();
const NEUTRAL: NodeJS.ProcessEnv = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SERVICE_ROLE_KEY: "rehearsal-none", NEXT_PUBLIC_SUPABASE_ANON_KEY: "rehearsal-none", SUPABASE_DB_URL: LOCAL };
const reh = (s: string) => `scripts/tps-analysis/rehearsal/${s}`;
const checks: { id: string; question: string; pass: boolean; detail: unknown }[] = [];
const timings: Record<string, number> = {};
const check = (id: string, question: string, pass: boolean, detail: unknown) => { checks.push({ id, question, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${question}`); };

function run(label: string, script: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  const t0 = Date.now();
  const clean = { ...process.env } as NodeJS.ProcessEnv;
  for (const k of Object.keys(clean)) if (/^(TPS_IDENTITY_|SUPABASE|WORKER_)/.test(k)) delete clean[k];
  const r = spawnSync("npx", ["tsx", script, ...args], { cwd: REPO, encoding: "utf8", shell: true, maxBuffer: 256 * 1024 * 1024, env: { ...clean, ...NEUTRAL, ...env } });
  timings[label] = Date.now() - t0;
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}
async function q<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: LOCAL }); await c.connect();
  try { return (await c.query(sql, args)).rows as T[]; } finally { await c.end(); }
}
const scopeArr = CATS.split(",");
const projRows = (cats: string[] | null) => q<Record<string, unknown>>(
  `select tps_identity_key, canonical_id::text, category, lowest_price::text, highest_price::text, saving::text, price_spread_pct::text, cheapest_store, store_count, has_comparison,
          compare_url, display_name_ar, display_name_en, brand, identity_confidence::text, text_for_search, last_observed_at::text, image_url, affiliate_best_url
     from tps_product_projection ${cats ? "where category = any($1::text[])" : ""} order by tps_identity_key`, cats ? [cats] : []);
const sigRows = () => q<Record<string, unknown>>(
  "select canonical_product_id::text, store_id, category, verdict, reasons, listing_name, rules_version from tps_offer_identity_signals order by canonical_product_id, store_id").catch(() => []);
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const diffKeys = (a: Record<string, unknown>[], b: Record<string, unknown>[], key = "tps_identity_key") => {
  const A = new Map(a.map((r) => [String(r[key]), r])), B = new Map(b.map((r) => [String(r[key]), r]));
  return { only_a: [...A.keys()].filter((k) => !B.has(k)).length, only_b: [...B.keys()].filter((k) => !A.has(k)).length,
    changed: [...A.keys()].filter((k) => B.has(k) && !eq(A.get(k), B.get(k))).length };
};
const snap = (file: string) => { run("snapshot", reh("snapshot.ts"), ["--out", file, "--all-tables"]); return JSON.parse(fs.readFileSync(file, "utf8")) as { tables: Record<string, { rows: number; full_hash: string; content_hash: string }> }; };
const changedTables = (a: ReturnType<typeof snap>, b: ReturnType<typeof snap>) => Object.keys(b.tables).filter((k) => a.tables[k]?.full_hash !== b.tables[k].full_hash);
const dropSignals = () => q("drop table if exists tps_offer_identity_signals");
const reset = () => { run("restore", reh("db-snapshot.ts"), ["restore", "baseline"]); };

// ORIGINAL (pre-ADR-405, git HEAD) copies, placed beside the real files so their relative imports resolve.
const ORIG_PROJ = "scripts/_orig_build-tps-projection.ts", ORIG_SIG = "scripts/tps-core/_orig_build-identity-signals.ts";
const writeOrig = () => {
  for (const [rel, dst] of [["scripts/build-tps-projection.ts", ORIG_PROJ], ["scripts/tps-core/build-identity-signals.ts", ORIG_SIG]]) {
    // `git show` returns the committed bytes; the committed files are the pre-ADR-405 versions as long as this scenario runs before the ADR-405 commit.
    fs.writeFileSync(path.join(REPO, dst), execSync(`git show HEAD:${rel}`, { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }));
  }
};
const rmOrig = () => { for (const f of [ORIG_PROJ, ORIG_SIG]) try { fs.unlinkSync(path.join(REPO, f)); } catch { /* */ } };

(async () => {
  try {
    run("start", reh("start.ts"), []);
    const lst = run("list", reh("db-snapshot.ts"), ["list"]).out;
    if (!/tps_snap_baseline/.test(lst)) throw new Error("replica snapshot `baseline` missing — run setup.ts first");
    writeOrig();
    reset();
    const S0 = snap(path.join(OUT, "runner-S0-baseline.json"));
    const P0 = await projRows(null);

    // ── 1. flags off → no change ─────────────────────────────────────────────────────────
    const sigOff = run("signals flags-off", "scripts/tps-core/build-identity-signals.ts", []);
    const tableAfterOff = (await q("select to_regclass('tps_offer_identity_signals') as t"))[0].t;
    const S1 = snap(path.join(OUT, "runner-S1-flagsoff.json"));
    check("1a", "flags/scope unset: the signals job processes nothing, creates no table, changes no pipeline table",
      /"gated_categories":\[\]/.test(sigOff.out) && tableAfterOff === null && changedTables(S0, S1).length === 0, { table: tableAfterOff, changed: changedTables(S0, S1) });
    // new unscoped projection builder == ORIGINAL unscoped builder on identical inputs (flags off)
    run("projection ORIG unscoped", ORIG_PROJ, ["--quiet"]);
    const P_orig_full = await projRows(null);
    reset();
    run("projection NEW unscoped", "scripts/build-tps-projection.ts", ["--quiet"]);
    const P_new_full = await projRows(null);
    const dFull = diffKeys(P_orig_full, P_new_full);
    check("1b", "flags off: the NEW unscoped projection build is identical to the ORIGINAL build (all categories)", dFull.only_a + dFull.only_b + dFull.changed === 0 && P_new_full.length > 0, { rows: P_new_full.length, ...dFull });

    // ── 3. signals: runner path == original path ─────────────────────────────────────────
    reset(); await dropSignals();
    run("signals ORIG (gate flag)", ORIG_SIG, [], { TPS_IDENTITY_GATE: CATS });
    const SIG_orig = await sigRows();
    reset(); await dropSignals();
    const rShadow = run("runner shadow (identity-gate only)", "scripts/tps-core/refresh-intelligence.ts", ["--only", "identity-gate", `--scope=${CATS}`], { TPS_IDENTITY_RUNNER_CATEGORIES: CATS });
    const SIG_runner = await sigRows();
    const S2 = snap(path.join(OUT, "runner-S2-shadow.json"));
    check("3", "signals written by the runner (read gate OFF) == signals written by the original path (same inputs)", SIG_orig.length > 0 && eq(SIG_orig, SIG_runner),
      { original_rows: SIG_orig.length, runner_rows: SIG_runner.length, byCategory: Object.fromEntries(scopeArr.map((c) => [c, SIG_runner.filter((r) => r.category === c).length])) });
    // ── 2. scope fence ───────────────────────────────────────────────────────────────────
    const stepsRan = [...rShadow.out.matchAll(/\[ (?: ok |FAIL|SKIP) \] (\S+)/g)].map((m) => m[1]);
    const changedShadow = changedTables(S0, S2);
    check("2a", "shadow runner executes exactly one chain step (identity-gate) and changes no pipeline table (projection untouched)",
      rShadow.status === 0 && eq(stepsRan, ["identity-gate"]) && changedShadow.length === 0, { stepsRan, exit: rShadow.status, changedTables: changedShadow });

    // ── 4. projection: runner == original path ───────────────────────────────────────────
    reset(); await dropSignals();
    run("ORIG chain (signals+projection, full)", ORIG_SIG, [], { TPS_IDENTITY_GATE: CATS });
    run("projection ORIG gated unscoped", ORIG_PROJ, ["--quiet"], { TPS_IDENTITY_GATE: CATS });
    const P_orig_gated = await projRows(null);
    reset(); await dropSignals();
    const rOn = run("runner on (signals + scoped projection)", "scripts/tps-core/refresh-intelligence.ts", ["--only", "identity-gate,projection", `--scope=${CATS}`], { TPS_IDENTITY_GATE: CATS, TPS_IDENTITY_RUNNER_CATEGORIES: CATS });
    const P_runner = await projRows(null);
    const S3 = snap(path.join(OUT, "runner-S3-on.json"));
    const inScope = (rows: Record<string, unknown>[]) => rows.filter((r) => scopeArr.includes(String(r.category)));
    const outScope = (rows: Record<string, unknown>[]) => rows.filter((r) => !scopeArr.includes(String(r.category)));
    const dScope = diffKeys(inScope(P_orig_gated), inScope(P_runner));
    check("4a", "gated projection of the scope categories built by the runner == built by the original chain path", dScope.only_a + dScope.only_b + dScope.changed === 0 && inScope(P_runner).length > 0,
      { scope_rows: inScope(P_runner).length, ...dScope });
    const dOut = diffKeys(outScope(P0), outScope(P_runner));
    check("2b", "scope fence: projection rows of every OTHER category are byte-identical to before the runner ran", dOut.only_a + dOut.only_b + dOut.changed === 0, { other_rows: outScope(P_runner).length, ...dOut });
    const stepsOn = [...rOn.out.matchAll(/\[ (?: ok |FAIL|SKIP) \] (\S+)/g)].map((m) => m[1]);
    const changedOn = changedTables(S0, S3);
    check("2c", "runner (on) executes exactly identity-gate + projection; the only pipeline tables that change are the projection (scope rows) and the signals table",
      rOn.status === 0 && eq(stepsOn, ["identity-gate", "projection"]) && eq(changedOn.sort(), ["tps_product_projection"]), { stepsOn, exit: rOn.status, changedTables: changedOn });
    // what the gate changes in the scope (informational, the "expected projection diff")
    const P_scope_baseline = await (async () => { reset(); run("scoped ungated", "scripts/build-tps-projection.ts", ["--quiet", `--categories=${CATS}`]); return projRows(scopeArr); })();
    const gateEffect = diffKeys(P_scope_baseline, inScope(P_runner));
    const comparableBefore = Object.fromEntries(scopeArr.map((c) => [c, P_scope_baseline.filter((r) => r.category === c && r.has_comparison).length]));
    const comparableAfter = Object.fromEntries(scopeArr.map((c) => [c, inScope(P_runner).filter((r) => r.category === c && r.has_comparison).length]));

    // ── 5. idempotency ───────────────────────────────────────────────────────────────────
    reset(); await dropSignals();
    const envOn = { TPS_IDENTITY_GATE: CATS, TPS_IDENTITY_RUNNER_CATEGORIES: CATS };
    const runnerArgs = ["--only", "identity-gate,projection", `--scope=${CATS}`];
    run("runner #1", "scripts/tps-core/refresh-intelligence.ts", runnerArgs, envOn);
    const SIG1 = await sigRows(), PR1 = await projRows(null), SN1 = snap(path.join(OUT, "runner-S4-run1.json"));
    const r2 = run("runner #2", "scripts/tps-core/refresh-intelligence.ts", runnerArgs, envOn);
    const SIG2 = await sigRows(), PR2 = await projRows(null), SN2 = snap(path.join(OUT, "runner-S5-run2.json"));
    const sigLine = [...r2.out.matchAll(/"upserted":(\d+),"deleted":(\d+)/g)][0];
    check("5", "re-running on the same inputs: 0 signal upserts/deletes, identical signals and projection rows, no row-count change",
      r2.status === 0 && eq(SIG1, SIG2) && eq(PR1, PR2) && changedTables(SN1, SN2).filter((t) => t !== "tps_product_projection").length === 0,
      { signal_rows: SIG2.length, projection_rows: PR2.length, second_run_signal_line: sigLine?.[0] ?? null, tables_differing_run1_vs_run2: changedTables(SN1, SN2) });

    // ── 6. disable / rollback returns the baseline ───────────────────────────────────────
    // rollback step 1: remove the READ gate; the runner keeps running (scope + projection) and rebuilds the scope ungated.
    run("runner after gate removed", "scripts/tps-core/refresh-intelligence.ts", runnerArgs, { TPS_IDENTITY_RUNNER_CATEGORIES: CATS });
    const P_after_gate_off = await projRows(scopeArr);
    const dRb = diffKeys(P_scope_baseline, P_after_gate_off);
    check("6a", "rollback (remove TPS_IDENTITY_GATE): the next runner cycle returns the scope's projection to the ungated baseline exactly", dRb.only_a + dRb.only_b + dRb.changed === 0, { scope_rows: P_after_gate_off.length, ...dRb });
    // rollback step 2: runner switched off and scope removed; one signals run (flag-off semantics) clears the table
    const clr = run("signals flags-off clear", "scripts/tps-core/build-identity-signals.ts", []);
    const sigLeft = (await sigRows()).length;
    check("6b", "kill switch + scope removed: a flags-off signals run deletes every signal row; nothing reads them", sigLeft === 0 && /"gated_categories":\[\]/.test(clr.out), { rows_left: sigLeft });
    const otherAfter = diffKeys(outScope(P0), outScope(await projRows(null)));
    check("6c", "after the whole rollback, no row outside the scope ever changed", otherAfter.only_a + otherAfter.only_b + otherAfter.changed === 0, otherAfter);

    // ── 7. failure semantics ─────────────────────────────────────────────────────────────
    // 7a signals write fails ⇒ identity-gate FAIL, projection SKIPPED, signals table and projection untouched, exit 1
    reset(); await dropSignals();
    run("seed signals", "scripts/tps-core/build-identity-signals.ts", [], { TPS_IDENTITY_RUNNER_CATEGORIES: CATS }); // creates table + rows
    await q("delete from tps_offer_identity_signals where ctid in (select ctid from tps_offer_identity_signals limit 5)"); // make the next run need upserts
    const sigBefore = await sigRows(), projBefore = await projRows(null);
    await q("create or replace function _fail_sig() returns trigger language plpgsql as $$ begin raise exception 'rehearsal: forced signals failure'; end $$");
    await q("create trigger _fail_sig_t before insert on tps_offer_identity_signals for each row execute function _fail_sig()");
    const f1 = run("runner signals-failure", "scripts/tps-core/refresh-intelligence.ts", runnerArgs, envOn);
    await q("drop trigger _fail_sig_t on tps_offer_identity_signals");
    const sigAfterFail = await sigRows(), projAfterFail = await projRows(null);
    check("7a", "signals failure: job exits non-zero, projection step is SKIPPED, signals unchanged (transaction rolled back), projection unchanged",
      f1.status === 1 && /\[ SKIP \] projection/.test(f1.out) && eq(sigBefore, sigAfterFail) && eq(projBefore, projAfterFail), { exit: f1.status, skipLine: (f1.out.match(/\[ SKIP \] projection[^\n]*/) ?? [])[0] ?? null });
    // 7b projection write fails ⇒ exit non-zero, the scope is all-or-nothing (no partial rows)
    reset(); await dropSignals();
    run("seed signals #2", "scripts/tps-core/build-identity-signals.ts", [], { TPS_IDENTITY_RUNNER_CATEGORIES: CATS });
    const projBefore2 = await projRows(null);
    await q("create or replace function _fail_proj() returns trigger language plpgsql as $$ begin if new.tps_identity_key = (select tps_identity_key from tps_product_projection where category = any($1) order by canonical_id desc limit 1) then raise exception 'rehearsal: forced projection failure'; end if; return new; end $$".replace("any($1)", `any(string_to_array('${CATS}', ','))`));
    await q("create trigger _fail_proj_t before update on tps_product_projection for each row execute function _fail_proj()");
    const f2 = run("runner projection-failure", "scripts/tps-core/refresh-intelligence.ts", runnerArgs, envOn);
    await q("drop trigger _fail_proj_t on tps_product_projection");
    const projAfter2 = await projRows(null);
    const dPart = diffKeys(projBefore2, projAfter2);
    check("7b", "projection failure: job exits non-zero and NO row of the scope is partially updated (single transaction)", f2.status === 1 && dPart.only_a + dPart.only_b + dPart.changed === 0, { exit: f2.status, ...dPart, failLine: (f2.out.match(/CHAIN-FAIL[^\n]*/) ?? [])[0] ?? null });

    const result = {
      date: new Date().toISOString(), categories: scopeArr, all_pass: checks.every((c) => c.pass), checks,
      gate_effect_on_scope_projection: { changed_rows: gateEffect.changed, only_a: gateEffect.only_a, only_b: gateEffect.only_b, comparable_before: comparableBefore, comparable_after: comparableAfter },
      timings_ms: timings, replica_limits: "3-day raw sample; price_history for mobile/tv only (vacuum projects from tps_current_offers); no Algolia; no RLS; fsync off — timings are this machine's",
    };
    fs.writeFileSync(path.join(OUT, "runner-rehearsal-2026-10-04.json"), JSON.stringify(result, null, 1));
    console.log(JSON.stringify({ all_pass: result.all_pass, failed: checks.filter((c) => !c.pass).map((c) => c.id) }));
  } finally {
    rmOrig();
    try { reset(); } catch { /* */ }
  }
})().catch((e) => { rmOrig(); console.error("FATAL", e); process.exit(1); });
