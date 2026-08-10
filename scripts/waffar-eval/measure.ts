// scripts/waffar-eval/measure.ts
// FINAL SEMANTIC INTELLIGENCE MISSION — measures BOTH pipelines against a corpus:
//   deterministic-only (parseShoppingTask/routeQuery alone)
//   deterministic + semantic fallback (mirrors the exact merge logic in
//     /api/v1/agent/decide/route.ts — semanticExtract only called when no category resolved,
//     validated against the closed vocabularies, never overriding an already-resolved field)
// Read-only, no DB writes; the semantic pass makes real Anthropic API calls (same provisioned
// key /api/ai-assistant already uses) so it costs a few cents and ~1-2 min for the full corpus.
// Run: npx tsx scripts/waffar-eval/measure.ts dev [--semantic]
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { parseShoppingTask, type ParsedTask } from '../../src/lib/agent/task-parser';
import { routeQuery } from '../../src/lib/agent/route-query';
import { semanticExtract } from '../../src/lib/agent/semantic-fallback';
import { DEV_CORPUS, type EvalCase } from './corpus-dev';
import { HOLDOUT_CORPUS } from './corpus-holdout';

async function resolveTask(text: string, useSemantic: boolean): Promise<{ task: ParsedTask; advisory: boolean; semanticUsed: boolean }> {
  const route = routeQuery(text);
  let task = route.task ?? parseShoppingTask(text);
  let advisory = route.mode === 'advisory';
  let semanticUsed = false;

  const descriptiveText = text.trim().split(/\s+/).filter(Boolean).length >= 5;
  if (useSemantic && (!task.category || descriptiveText)) {
    const semantic = await semanticExtract(text).catch(() => null);
    if (semantic) {
      semanticUsed = true;
      if (semantic.category && !task.category) {
        task = { ...task, category: semantic.category, semantic_confidence: semantic.confidence };
        advisory = true; // a resolved category with real signal is worth advising on
      }
      if (semantic.budget_total != null && task.budget_total == null) {
        task = { ...task, budget_total: semantic.budget_total };
      }
      if (semantic.priorities.length) {
        const conflicts = new Set([...(task.deprioritized_priorities ?? []), ...(task.excluded_priorities ?? [])]);
        const safe = semantic.priorities.filter((p) => !conflicts.has(p));
        if (safe.length) task = { ...task, inferred_priorities: safe };
      }
    }
  }
  return { task, advisory, semanticUsed };
}

async function run(cases: EvalCase[], label: string, useSemantic: boolean) {
  let pass = 0;
  const fails: { id: string; text: string; reasons: string[] }[] = [];
  let semanticCalls = 0;

  for (const c of cases) {
    const { task, advisory, semanticUsed } = await resolveTask(c.text, useSemantic);
    if (semanticUsed) semanticCalls++;
    const reasons: string[] = [];
    const exp = c.expected;

    if (exp.category !== undefined) {
      const got = task.category || null;
      if (got !== exp.category) reasons.push(`category: expected ${JSON.stringify(exp.category)}, got ${JSON.stringify(got)}`);
    }
    if (exp.budget !== undefined) {
      if (exp.budget === 'referenced') {
        if (!(task.budget_referenced && task.budget_total == null)) reasons.push(`budget: expected a referenced-no-value signal, got budget_total=${task.budget_total} budget_referenced=${task.budget_referenced}`);
      } else if (exp.budget === true) {
        if (typeof task.budget_total !== 'number') reasons.push(`budget: expected a resolved number, got ${task.budget_total}`);
      } else if (exp.budget === null) {
        if (task.budget_total != null) reasons.push(`budget: expected none, got ${task.budget_total}`);
      } else {
        if (task.budget_total !== exp.budget) reasons.push(`budget: expected ${exp.budget}, got ${task.budget_total}`);
      }
    }
    const positives = [...(task.priorities ?? []), ...(task.inferred_priorities ?? [])];
    for (const p of exp.prioritiesInclude ?? []) {
      if (!positives.includes(p)) reasons.push(`priorities: missing "${p}" (got [${positives.join(',')}])`);
    }
    for (const p of exp.prioritiesExclude ?? []) {
      if ((task.priorities ?? []).includes(p)) reasons.push(`priorities: "${p}" should NOT be positive (got [${(task.priorities ?? []).join(',')}])`);
    }
    const deprio = task.deprioritized_priorities ?? [];
    for (const p of exp.deprioritizedInclude ?? []) {
      if (!deprio.includes(p)) reasons.push(`deprioritized: missing "${p}" (got [${deprio.join(',')}])`);
    }
    if (exp.advisory !== undefined) {
      if (advisory !== exp.advisory) reasons.push(`advisory: expected ${exp.advisory}, got ${advisory}`);
    }

    if (reasons.length === 0) pass++;
    else fails.push({ id: c.id, text: c.text, reasons });
  }

  console.log(`\n=== ${label}: ${pass}/${cases.length} passed (${Math.round((pass / cases.length) * 100)}%) ${useSemantic ? `[semantic fallback used on ${semanticCalls} cases]` : '[deterministic only]'} ===`);
  for (const f of fails) {
    const c = cases.find((x) => x.id === f.id)!;
    const gapTag = c.knownDeterministicGap ? ' [KNOWN GAP]' : ' [UNEXPECTED]';
    console.log(`\n  ${f.id}${gapTag}: "${f.text}"`);
    for (const r of f.reasons) console.log(`    - ${r}`);
  }
  return { pass, total: cases.length, fails };
}

(async () => {
  const which = process.argv[2] || 'dev';
  const useSemantic = process.argv.includes('--semantic');
  const corpus = which === 'dev' ? DEV_CORPUS : which === 'holdout' ? HOLDOUT_CORPUS : null;
  if (!corpus) { console.error('Unknown corpus:', which); process.exit(1); }
  await run(corpus, `${which.toUpperCase()} CORPUS`, useSemantic);
})();
