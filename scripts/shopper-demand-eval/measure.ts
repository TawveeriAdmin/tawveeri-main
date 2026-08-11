// scripts/shopper-demand-eval/measure.ts
// SAUDI SHOPPER LANGUAGE & DEMAND DISCOVERY mission — measures the DETERMINISTIC
// parseShoppingTask()/routeQuery() pipeline against this mission's own corpus. Deliberately
// does NOT invoke the semantic fallback (scripts/waffar-eval/measure.ts already measures that
// layer for its own mission) — this corpus exists to test whether task-parser.ts's structural
// vocabulary (category/priorities/budget/room-size/discount-intent) covers real shopper-language
// SHAPES, which is a keyword/structure question, not a comprehension-ceiling question.
// Read-only, no network calls, no DB writes, instant.
// Run: npx tsx scripts/shopper-demand-eval/measure.ts dev
//      npx tsx scripts/shopper-demand-eval/measure.ts holdout
import { parseShoppingTask } from '../../src/lib/agent/task-parser';
import { routeQuery } from '../../src/lib/agent/route-query';
import { DEV_CORPUS } from './corpus-dev';
import { HOLDOUT_CORPUS } from './corpus-holdout';
import type { ShopperEvalCase } from './corpus-dev';

function run(cases: ShopperEvalCase[], label: string) {
  let pass = 0;
  const fails: { id: string; text: string; reasons: string[] }[] = [];
  const byCategory = new Map<string, { pass: number; total: number }>();
  const byStructureDim = new Map<string, { pass: number; total: number }>();

  for (const c of cases) {
    const route = routeQuery(c.text);
    const task = route.task ?? parseShoppingTask(c.text);
    const advisory = route.mode === 'advisory';
    const reasons: string[] = [];
    const exp = c.expected;

    if (exp.category !== undefined) {
      const got = task.category || null;
      if (got !== exp.category) reasons.push(`category: expected ${JSON.stringify(exp.category)}, got ${JSON.stringify(got)}`);
    }
    if (exp.budget !== undefined) {
      if (exp.budget === 'referenced') {
        if (!(task.budget_referenced && task.budget_total == null)) reasons.push(`budget: expected referenced-no-value, got budget_total=${task.budget_total} budget_referenced=${task.budget_referenced}`);
      } else if (exp.budget === true) {
        if (typeof task.budget_total !== 'number') reasons.push(`budget: expected a resolved number, got ${task.budget_total}`);
      } else if (exp.budget === null) {
        if (task.budget_total != null) reasons.push(`budget: expected none, got ${task.budget_total}`);
      } else {
        if (task.budget_total !== exp.budget) reasons.push(`budget: expected ${exp.budget}, got ${task.budget_total}`);
      }
    }
    const positives = task.priorities ?? [];
    for (const p of exp.prioritiesInclude ?? []) {
      if (!positives.includes(p)) reasons.push(`priorities: missing "${p}" (got [${positives.join(',')}])`);
    }
    for (const p of exp.prioritiesExclude ?? []) {
      if (positives.includes(p)) reasons.push(`priorities: "${p}" should NOT be positive (got [${positives.join(',')}])`);
    }
    const deprio = task.deprioritized_priorities ?? [];
    for (const p of exp.deprioritizedInclude ?? []) {
      if (!deprio.includes(p)) reasons.push(`deprioritized: missing "${p}" (got [${deprio.join(',')}])`);
    }
    const excluded = task.excluded_priorities ?? [];
    for (const p of exp.excludedInclude ?? []) {
      if (!excluded.includes(p)) reasons.push(`excluded: missing "${p}" (got [${excluded.join(',')}])`);
    }
    if (exp.wantsDiscount !== undefined) {
      const got = !!(task as { wants_discount?: boolean }).wants_discount;
      if (got !== exp.wantsDiscount) reasons.push(`wants_discount: expected ${exp.wantsDiscount}, got ${got}`);
    }
    if (exp.wantsCheapest !== undefined) {
      const got = !!(task as { wants_cheapest?: boolean }).wants_cheapest;
      if (got !== exp.wantsCheapest) reasons.push(`wants_cheapest: expected ${exp.wantsCheapest}, got ${got}`);
    }
    if (exp.wantsRecommendation !== undefined) {
      const got = !!task.wants_recommendation;
      if (got !== exp.wantsRecommendation) reasons.push(`wants_recommendation: expected ${exp.wantsRecommendation}, got ${got}`);
    }
    if (exp.roomSize !== undefined) {
      if (task.room_size_m2 !== exp.roomSize) reasons.push(`room_size_m2: expected ${exp.roomSize}, got ${task.room_size_m2}`);
    }
    if (exp.advisory !== undefined) {
      if (advisory !== exp.advisory) reasons.push(`advisory: expected ${exp.advisory}, got ${advisory}`);
    }

    const ok = reasons.length === 0;
    if (ok) pass++; else fails.push({ id: c.id, text: c.text, reasons });

    const catStat = byCategory.get(c.category) ?? { pass: 0, total: 0 };
    catStat.total++; if (ok) catStat.pass++;
    byCategory.set(c.category, catStat);

    const structStat = byStructureDim.get(c.structure) ?? { pass: 0, total: 0 };
    structStat.total++; if (ok) structStat.pass++;
    byStructureDim.set(c.structure, structStat);
  }

  console.log(`\n=== ${label}: ${pass}/${cases.length} passed (${Math.round((pass / cases.length) * 100)}%) ===`);
  console.log('\n-- by category --');
  for (const [cat, s] of [...byCategory.entries()].sort()) console.log(`  ${cat}: ${s.pass}/${s.total}`);
  console.log('\n-- failures --');
  for (const f of fails) {
    const c = cases.find((x) => x.id === f.id)!;
    const gapTag = c.knownGap ? ' [KNOWN GAP]' : ' [UNEXPECTED]';
    console.log(`\n  ${f.id}${gapTag}: "${f.text}"`);
    for (const r of f.reasons) console.log(`    - ${r}`);
  }
  return { pass, total: cases.length, fails, byCategory };
}

(() => {
  const which = process.argv[2] || 'dev';
  const corpus = which === 'dev' ? DEV_CORPUS : which === 'holdout' ? HOLDOUT_CORPUS : null;
  if (!corpus) { console.error('Unknown corpus:', which); process.exit(1); }
  run(corpus, `${which.toUpperCase()} CORPUS`);
})();
