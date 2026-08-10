// scripts/waffar-eval/parity.ts
// FINAL SEMANTIC INTELLIGENCE, BILINGUAL PARITY & WAFFAR CLOSURE MISSION (mission §19-20).
// For each Arabic/English (and code-switched) pair with the SAME shopping meaning, measures
// whether they converge to the SAME structured mission: category, budget, and priority set.
// Not asserting identical OUTPUT TEXT — asserting equivalent MEANING and commercial behavior,
// exactly as the mission brief requires ("do not demand identical output text; demand
// equivalent MEANING and COMMERCIAL BEHAVIOR").
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { parseShoppingTask, type ParsedTask } from '../../src/lib/agent/task-parser';
import { routeQuery } from '../../src/lib/agent/route-query';
import { semanticExtract } from '../../src/lib/agent/semantic-fallback';

interface ParityPair {
  id: string;
  ar: string;
  en: string;
}

const PAIRS: ParityPair[] = [
  { id: 'P01', ar: 'أبي لابتوب ألعاب تحت 5000', en: 'I need a gaming laptop under SAR 5,000.' },
  { id: 'P02', ar: 'أبي جوال تصويره ممتاز وبطاريته قوية وميزانيتي 3000', en: 'I need a phone with strong camera and battery under SAR 3,000.' },
  { id: 'P03', ar: 'أرخص لابتوب', en: 'Cheapest laptop.' },
  { id: 'P04', ar: 'ما يهمني الألعاب', en: "Gaming doesn't matter to me." },
  { id: 'P05', ar: 'أبي laptop gaming تحت 5000', en: 'I need a gaming laptop under 5000' }, // code-switched vs plain English
];

async function resolveMeaning(text: string): Promise<{ category: string | null; budget: number | null; priorities: string[]; deprioritized: string[]; advisory: boolean }> {
  const route = routeQuery(text);
  let task: ParsedTask = route.task ?? parseShoppingTask(text);
  const descriptive = text.trim().split(/\s+/).filter(Boolean).length >= 5;
  let advisory = route.mode === 'advisory';

  if (!task.category || descriptive) {
    const semantic = await semanticExtract(text).catch(() => null);
    if (semantic) {
      if (semantic.category && !task.category) { task = { ...task, category: semantic.category }; advisory = true; }
      if (semantic.budget_total != null && task.budget_total == null) task = { ...task, budget_total: semantic.budget_total };
      if (semantic.priorities.length) {
        const conflicts = new Set([...(task.deprioritized_priorities ?? []), ...(task.excluded_priorities ?? [])]);
        const safe = semantic.priorities.filter((p) => !conflicts.has(p));
        if (safe.length) task = { ...task, inferred_priorities: safe };
      }
      if (semantic.deprioritized_priorities.length) task = { ...task, deprioritized_priorities: [...new Set([...(task.deprioritized_priorities ?? []), ...semantic.deprioritized_priorities])] };
    }
  }
  return {
    category: task.category || null,
    budget: task.budget_total ?? null,
    priorities: [...new Set([...(task.priorities ?? []), ...(task.inferred_priorities ?? [])])],
    deprioritized: task.deprioritized_priorities ?? [],
    advisory,
  };
}

(async () => {
  let converged = 0;
  for (const p of PAIRS) {
    const [ar, en] = await Promise.all([resolveMeaning(p.ar), resolveMeaning(p.en)]);
    const categoryMatch = ar.category === en.category;
    const budgetMatch = ar.budget === en.budget;
    const prioritiesMatch = JSON.stringify([...ar.priorities].sort()) === JSON.stringify([...en.priorities].sort());
    const deprioritizedMatch = JSON.stringify([...ar.deprioritized].sort()) === JSON.stringify([...en.deprioritized].sort());
    const advisoryMatch = ar.advisory === en.advisory;
    const ok = categoryMatch && budgetMatch && prioritiesMatch && deprioritizedMatch && advisoryMatch;
    if (ok) converged++;
    console.log(`\n${p.id}: ${ok ? 'CONVERGED ✓' : 'DIVERGED ✗'}`);
    console.log(`  AR "${p.ar}" -> ${JSON.stringify(ar)}`);
    console.log(`  EN "${p.en}" -> ${JSON.stringify(en)}`);
    if (!ok) {
      if (!categoryMatch) console.log(`    category diverges: ${ar.category} vs ${en.category}`);
      if (!budgetMatch) console.log(`    budget diverges: ${ar.budget} vs ${en.budget}`);
      if (!prioritiesMatch) console.log(`    priorities diverge: [${ar.priorities}] vs [${en.priorities}]`);
      if (!deprioritizedMatch) console.log(`    deprioritized diverges: [${ar.deprioritized}] vs [${en.deprioritized}]`);
      if (!advisoryMatch) console.log(`    advisory diverges: ${ar.advisory} vs ${en.advisory}`);
    }
  }
  console.log(`\n=== BILINGUAL PARITY: ${converged}/${PAIRS.length} pairs converged (${Math.round((converged / PAIRS.length) * 100)}%) ===`);
})();
