// scripts/quality/typecheck-baseline.ts
// ─────────────────────────────────────────────────────────────────────────────
// TYPE-DEBT RATCHET (ADR-059)
//
// The repository carries a large pre-existing TypeScript error count. "Pre-existing"
// must never become permanent permission for deterioration, and equally must not
// let legacy cleanup consume the roadmap. So we hold an explicit, committed
// baseline and enforce a one-way ratchet:
//
//   • errors ABOVE baseline  → fail loud (a milestone added debt)
//   • errors BELOW baseline  → fail loud too, with the new number to commit
//                              (debt paid down must be LOCKED IN, not re-spendable)
//
// Per-file counts make regressions attributable instead of a single opaque total.
//
// Usage:
//   npx tsx scripts/quality/typecheck-baseline.ts            # verify
//   npx tsx scripts/quality/typecheck-baseline.ts --update   # re-record
// ─────────────────────────────────────────────────────────────────────────────
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const BASELINE_PATH = resolve(process.cwd(), "scripts/quality/typecheck-baseline.json");
const UPDATE = process.argv.includes("--update");

interface Baseline { total: number; recordedAt: string; byFile: Record<string, number> }

function runTsc(): string {
  try {
    execSync("npx tsc --noEmit", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
    return "";
  } catch (e) {
    // tsc exits non-zero when there are errors; its report is on stdout.
    const err = e as { stdout?: string; stderr?: string };
    return `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
}

function parse(output: string): { total: number; byFile: Record<string, number> } {
  const byFile: Record<string, number> = {};
  let total = 0;
  for (const line of output.split(/\r?\n/)) {
    // e.g. "src/lib/foo.ts(19,16): error TS2339: ..."
    const m = /^(.+?)\((\d+),(\d+)\): error TS\d+:/.exec(line.trim());
    if (!m) continue;
    const file = m[1].replace(/\\/g, "/");
    byFile[file] = (byFile[file] ?? 0) + 1;
    total++;
  }
  return { total, byFile };
}

const current = parse(runTsc());

if (UPDATE || !existsSync(BASELINE_PATH)) {
  const next: Baseline = { total: current.total, recordedAt: new Date().toISOString(), byFile: current.byFile };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log(`baseline recorded: ${current.total} errors across ${Object.keys(current.byFile).length} files`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
console.log(`typecheck: ${current.total} errors (baseline ${baseline.total}, recorded ${baseline.recordedAt.slice(0, 10)})`);

// Attribute the change per file so a regression names its own culprit.
const files = new Set([...Object.keys(baseline.byFile), ...Object.keys(current.byFile)]);
const worse: string[] = [], better: string[] = [];
for (const f of files) {
  const b = baseline.byFile[f] ?? 0, c = current.byFile[f] ?? 0;
  if (c > b) worse.push(`  + ${f}: ${b} → ${c}`);
  else if (c < b) better.push(`  - ${f}: ${b} → ${c}`);
}

if (worse.length) {
  console.error(`\nTYPE DEBT INCREASED in ${worse.length} file(s):`);
  for (const w of worse) console.error(w);
  console.error(`\nFix these, or if the increase is intentional and justified, re-record with --update.`);
  process.exit(1);
}

if (current.total < baseline.total) {
  console.log(`\nType debt REDUCED by ${baseline.total - current.total}:`);
  for (const b of better) console.log(b);
  console.error(`\nLock it in so it cannot be re-spent: npx tsx scripts/quality/typecheck-baseline.ts --update`);
  process.exit(1);
}

console.log("no new type errors — baseline held.");
