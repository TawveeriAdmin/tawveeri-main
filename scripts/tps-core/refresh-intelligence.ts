// scripts/tps-core/refresh-intelligence.ts
// ─────────────────────────────────────────────────────────────────────────────
// INTELLIGENCE REFRESH ORCHESTRATOR (ADR-062)
//
// Turning evidence into consumer value is a CHAIN, and every link used to be a
// separate script a human had to remember:
//   canonicals → projection → search index
//              → listing facts → merchant trust
//              → product edges
//
// Nothing enforced the order and nothing noticed when a link was skipped. The
// measured consequence: the search index held 394 of 1,215 products and had not
// been rebuilt in ~34 hours — **68% of the catalog was unsearchable**, including a
// full day of identity work. Under the Constitution (Art. IX) value that never
// propagates is not value.
//
// This runs the whole chain in dependency order, idempotently, with per-step
// timing and failure isolation: a failing step is reported and the chain
// continues where the next step does not depend on it, so one broken link never
// silently blocks everything downstream of it.
//
// Usage:
//   npm run tps:refresh                 # full chain
//   npm run tps:refresh -- --fast       # skip the slow projection rebuild
//   npm run tps:refresh -- --only search,trust
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { spawnSync } from "child_process";

interface Step {
  key: string;
  label: string;
  /** Steps whose output this one consumes — used only for reporting. */
  needs: string[];
  run: () => { ok: boolean; detail: string };
  /** Slow steps are skipped by --fast. */
  slow?: boolean;
}

function runScript(path: string, args: string[] = []): { ok: boolean; detail: string } {
  const r = spawnSync("npx", ["tsx", path, ...args], { encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const tail = out.trim().split(/\r?\n/).filter((l) => l && !l.includes("injected env")).slice(-2).join(" | ");
  return { ok: r.status === 0, detail: tail.slice(0, 220) || (r.status === 0 ? "done" : `exit ${r.status}`) };
}

const STEPS: Step[] = [
  {
    // ADR-069 — the chain used to START at projection, so it only ever refreshed
    // products that ALREADY had an identity. Ingestion runs continuously but
    // nothing converted new observations into identities, so newly-ingested
    // products stayed invisible until a human ran bulk-backfill. Incremental and
    // cursor-based, so this processes only what arrived since the last run.
    key: "normalize", label: "new observations → identities (incremental)", needs: [],
    // ADR-148: `--adaptive` lets the batch count follow the measured backlog (6 when the
    // queue is short, up to the engine's 20-batch ceiling when it is deep). A constant 6
    // could not keep up with burst ingestion and let almanea reach 320k rows behind.
    run: () => runScript("scripts/tps-core/normalize-incremental.ts", ["--batches", "6", "--adaptive"]),
  },
  {
    // ADR-065 found 770 identities with no canonical; the leak RECURS every time
    // staging grows, which is now every hour. `corroboratePass` in the step above
    // writes only >=2-store canonicals, so single-store products need this pass or
    // they never reach a customer. Honest by construction: comparison_eligible=false.
    key: "resolved-single", label: "single-store identities → canonicals", needs: ["normalize"],
    run: () => runScript("scripts/tps-matcher/write-resolved-single.ts"),
  },
  {
    key: "projection", label: "serving projection (canonicals → comparison rows)", needs: ["resolved-single"], slow: true,
    run: () => runScript("scripts/build-tps-projection.ts"),
  },
  {
    // ADR-063/065: must run BEFORE the search sync, otherwise a newly-projected
    // product reaches search with no picture and no way to buy.
    key: "presentation", label: "product images + measured exit links", needs: ["projection"],
    run: () => runScript("scripts/tps-core/build-projection-presentation.ts"),
  },
  {
    key: "search", label: "search index (projection → Algolia)", needs: ["projection", "presentation"],
    // A dedicated script so a missing Algolia credential fails THIS step only.
    run: () => runScript("scripts/tps-core/sync-search-index.ts"),
  },
  {
    key: "facts", label: "per-listing price facts (observations → facts)", needs: [],
    run: () => runScript("scripts/tps-core/build-listing-facts.ts"),
  },
  {
    key: "trust", label: "merchant trust (facts → store profiles)", needs: ["facts"],
    run: () => runScript("scripts/tps-core/build-merchant-trust.ts"),
  },
  {
    key: "edges", label: "knowledge-graph edges (canonicals → relationships)", needs: ["projection"],
    run: () => runScript("scripts/tps-core/build-product-edges.ts"),
  },
];

(async () => {
  const fast = process.argv.includes("--fast");
  const onlyArg = process.argv[process.argv.indexOf("--only") + 1];
  const only = process.argv.includes("--only") && onlyArg ? new Set(onlyArg.split(",").map((s) => s.trim())) : null;

  const selected = STEPS.filter((s) => (only ? only.has(s.key) : !(fast && s.slow)));
  console.log(`\n╔══ INTELLIGENCE REFRESH — ${selected.length} step(s)${fast ? " (fast: projection skipped)" : ""}\n`);

  const failed = new Set<string>();
  const results: { key: string; ok: boolean; ms: number; detail: string }[] = [];
  for (const step of selected) {
    const blocked = step.needs.filter((n) => failed.has(n));
    if (blocked.length) {
      console.log(`  [ SKIP ] ${step.key.padEnd(11)} ${step.label}\n            ↳ depends on failed step(s): ${blocked.join(", ")}`);
      failed.add(step.key);
      results.push({ key: step.key, ok: false, ms: 0, detail: `skipped — ${blocked.join(",")} failed` });
      continue;
    }
    const t0 = Date.now();
    const r = step.run();
    const ms = Date.now() - t0;
    if (!r.ok) failed.add(step.key);
    console.log(`  [ ${r.ok ? " ok " : "FAIL"} ] ${step.key.padEnd(11)} ${step.label}  (${(ms / 1000).toFixed(1)}s)`);
    console.log(`            ↳ ${r.detail}`);
    results.push({ key: step.key, ok: r.ok, ms, detail: r.detail });
  }

  const bad = results.filter((r) => !r.ok);
  console.log(`\n  ${results.length - bad.length}/${results.length} steps succeeded in ${(results.reduce((a, r) => a + r.ms, 0) / 1000).toFixed(1)}s`);
  console.log(`  Verify propagation with: npm run tps:health\n`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(2); });
