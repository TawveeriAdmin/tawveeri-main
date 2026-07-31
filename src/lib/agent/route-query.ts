// src/lib/agent/route-query.ts
// P2-8 · UNIFIED SEARCH — the routing decision, and nothing else.
//
// Constitution → UNIFIED SEARCH: "Routing is determined by the query, NEVER by the
// customer." There is one entry point; this function is what decides, internally, which
// capability that entry point needs. It is deterministic and LLM-free (ADR-002): the same
// query always routes the same way, and the reason is returned so the decision can be
// audited rather than guessed at.
//
// It decides ONLY the route. It does not fetch, rank, or render.
import { parseShoppingTask, type ParsedTask } from './task-parser';
import { APPLIANCE_META } from './decision-engine';

/**
 * Categories the decision engine can actually advise on — read from the engine's own
 * dispatch rather than restated, so the two cannot drift apart. `decide()` handles these
 * explicitly and everything in APPLIANCE_META generically; anything else returns
 * `supported: false`.
 *
 * This is the routing rule's hard edge. `audio` and `camera` ARE parseable as categories
 * but the engine does NOT advise on them — routing "سماعات للألعاب" to advisory would
 * render the "category not supported yet" state where plain results were available. A
 * worse answer than the one we already had is not a migration, it is a regression.
 */
export const ADVISABLE_CATEGORIES: ReadonlySet<string> = new Set([
  'air_conditioner', 'tv', 'tablet', 'mobile', 'laptop', 'refrigerator', 'washing_machine',
  ...Object.keys(APPLIANCE_META),
]);

export type QueryRoute =
  | { mode: 'retrieval'; reason: string; task: ParsedTask | null }
  | { mode: 'advisory'; reason: string; task: ParsedTask };

/**
 * A need signal is the customer describing a SITUATION rather than naming a product:
 * a budget, a room to cool, or a priority ("quiet", "for gaming", "for a family").
 * Suitability reasoning has something to reason ABOUT only when at least one is present.
 */
function needSignals(task: ParsedTask): string[] {
  const signals: string[] = [];
  if (typeof task.budget_total === 'number') signals.push('budget');
  if (typeof task.room_size_m2 === 'number') signals.push('room_size');
  if (task.priorities?.length) signals.push(`priorities:${task.priorities.join('+')}`);
  if (typeof task.storage_min === 'number') signals.push('storage_min');
  if (typeof task.ram_min === 'number') signals.push('ram_min');
  return signals;
}

/**
 * A query that names a specific MODEL is an exact product query — the customer has already
 * decided WHAT, and is asking WHERE and HOW MUCH. The Constitution routes those straight to
 * comparison. Advising someone who named their model is answering a question they did not
 * ask.
 *
 * Detected structurally, not by a brand list: a token carrying digits next to letters
 * ("s24", "g835lw", "a54"), or a bare model number after a known model word. A standalone
 * number is deliberately NOT a model — it is far more often a budget ("تحت 4000") or a
 * size ("30 متر"), both of which are need signals.
 */
const MODEL_TOKEN = /(?:^|\s)(?=[a-z]*\d)(?=\d*[a-z])[a-z0-9][a-z0-9-]{2,}(?=\s|$)/i;
const NAMED_SERIES = /iphone|galaxy|macbook|ipad|pixel|redmi|poco|vivobook|thinkpad|elitebook|inspiron|latitude|omen|nitro|rog|zenbook|ideapad|بيسبوك|ايفون|آيفون|جالكسي/i;

export function namesASpecificModel(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  // "iphone 15", "galaxy s24" — a known series followed by any number is a model.
  if (NAMED_SERIES.test(t) && /\d/.test(t)) return true;
  return MODEL_TOKEN.test(t);
}

/**
 * Decide which capability this query needs.
 *
 * The order is the rule, and each step exists because skipping it produces a worse answer
 * than the entry point already gives today:
 *   1. No category we can name        → retrieval. We cannot advise on what we cannot classify.
 *   2. Category we cannot advise on   → retrieval. Better plain results than "not supported".
 *   3. A named model                  → retrieval. They asked where and how much, not what.
 *   4. At least one need signal       → advisory. There is something to reason about.
 *   5. Otherwise                      → retrieval. A bare category is a browse, not a need.
 */
export function routeQuery(text: string): QueryRoute {
  const raw = (text || '').trim();
  if (!raw) return { mode: 'retrieval', reason: 'empty query', task: null };

  const task = parseShoppingTask(raw);

  if (!task.category) {
    return { mode: 'retrieval', reason: 'no category could be classified', task };
  }
  if (!ADVISABLE_CATEGORIES.has(task.category)) {
    return { mode: 'retrieval', reason: `category "${task.category}" is not advisable`, task };
  }
  if (namesASpecificModel(raw)) {
    return { mode: 'retrieval', reason: 'query names a specific model', task };
  }

  const signals = needSignals(task);
  if (signals.length === 0) {
    return { mode: 'retrieval', reason: 'category only — a browse, not a described need', task };
  }

  return { mode: 'advisory', reason: `need signals: ${signals.join(', ')}`, task };
}
