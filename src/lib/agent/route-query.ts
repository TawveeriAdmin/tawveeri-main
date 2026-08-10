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
//
// UNIFIED TAWVEERI INTELLIGENCE (2026-08-09, founder architectural clarification — closing
// the "two parallel intent detectors" gap toward orchestration): comparison intent used to
// be detected independently in src/app/api/search/route.ts, via its own direct call to
// `detectCompareIntent()`, while this file separately decided retrieval-vs-advisory. Same
// query, two uncoordinated classifiers. Comparison verification (does the data actually
// support a comparison page?) stays OUT of this file on purpose — it is async and
// DB-bound, which would break `routeQuery`'s pure/synchronous contract above — but
// comparison DETECTION (`detectCompareIntent`, already pure and deterministic, ADR-002)
// belongs in the SAME shared classifier as retrieval/advisory, not a second one. This file
// is now the single place that decides WHAT KIND of question a query is; resolve-
// comparison.ts remains the single place that verifies whether the answer is deliverable.
import { parseShoppingTask, type ParsedTask } from './task-parser';
import { APPLIANCE_META } from './decision-engine';
import { detectCompareIntent, type CompareIntent } from './compare-intent';

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
  | { mode: 'advisory'; reason: string; task: ParsedTask }
  // `compareIntent.kind` is never 'none' here — see the guard in routeQuery() below.
  | { mode: 'comparison'; reason: string; task: ParsedTask | null; compareIntent: CompareIntent };

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
  // P1 (ONE BRAIN mandate, 2026-08-10): "أرخص لابتوب" as a FIRST message previously parsed
  // to zero signals — "cheapest" was never in this list — so it fell through to a bare
  // 'retrieval' browse (rule 5 below) and never reached the eligibility-safe decision engine
  // at all. Advisory mode still requires a real category (checked above); this only makes an
  // otherwise-bare cheapest request count as a describable need once a category is known.
  if (task.wants_cheapest) signals.push('cheapest');
  // NEED-DISCOVERY (2026-08-10, founder's own production gap): «وش أفضل لابتوب لاحتياجي
  // وميزانيتي؟» parsed to ZERO signals above — "أفضل"/"احتياجي"/"ميزانيتي" carry no
  // extractable VALUE, only a REFERENCE, so it fell through to rule 5 below ("category only
  // — a browse") exactly like a bare "لابتوب" would, and surfaced 83 unfiltered results
  // instead of asking what the shopper actually needs. The distinction that matters: a bare
  // category name is silence (nothing to react to); "أفضل"/"احتياجي"/"ميزانيتي" are the
  // shopper EXPLICITLY asking to be helped to a decision. Routing this to advisory does not
  // by itself produce a question — `shouldAsk()` (clarify.ts) still decides that, against
  // real candidate rows, using the exact same "does the answer change the outcome" test
  // already proven for room size/storage/RAM. This only earns the query a seat at that table.
  if (task.wants_recommendation) signals.push('wants_recommendation');
  if (task.budget_referenced) signals.push('budget_referenced');
  if (task.use_case_referenced) signals.push('use_case_referenced');
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
const MODEL_TOKEN = /(?:^|\s)(?=[a-z]*\d)(?=\d*[a-z])[a-z0-9][a-z0-9-]{2,}(?=\s|$)/gi;
const NAMED_SERIES = /iphone|galaxy|macbook|ipad|pixel|redmi|poco|vivobook|thinkpad|elitebook|inspiron|latitude|omen|nitro|rog|zenbook|ideapad|بيسبوك|ايفون|آيفون|جالكسي/i;

/**
 * MEASURED DEFECT (2026-08-10, D→E mission Part F — live-verified English-language
 * adversarial sweep): "laptop with 8gb ram under 2000" silently never reached the advisor
 * at all — confirmed via network capture, `/api/v1/agent/decide` was never called, only the
 * literal catalog search ran, which then matched nothing and rendered an honest-but-wrong
 * "No results found" for a need the decision engine answers perfectly when called directly
 * (verified: the SAME text posted straight to `/api/v1/agent/decide` returns count 4,
 * supported true). Root cause: `MODEL_TOKEN` matches ANY token mixing digits and letters —
 * "8gb" IS such a token (digit "8" + letters "gb"), so `namesASpecificModel` treated a plain
 * English spec shorthand as if it were a product code like "s24" or "g835lw", routing the
 * whole query to `retrieval` before `needSignals` (budget=2000, which WAS parsed correctly)
 * ever got a chance to route it to `advisory`. Arabic RAM/storage phrasing never triggered
 * this ("16 جيجا رام" has a space and non-Latin script; `MODEL_TOKEN` is ASCII-only) — this
 * silently broke the English decision-engine path for effectively any spec-bearing English
 * query ("16gb ram", "128gb storage", "6000mah battery", "4k tv", …), which is common
 * phrasing, not an edge case.
 */
// MEASURED DEFECT (2026-08-10, same session, re-verification sweep): "refrigerator 400l
// under 3000" reproduced the identical class of failure with a unit missing from the list
// above ("l" for liters, common for refrigerator/washer capacity) — confirmed the same way
// (decide() answers it directly with count 4; the client never called it). This list is
// inherently open-ended across appliance categories (capacity, weight, power, battery,
// resolution, …), so it is kept broad rather than re-patched one missed unit at a time.
const SPEC_UNIT_TOKEN = /^\d+(?:gb|tb|mb|mah|wh|kwh|hz|ghz|mhz|w|kw|v|a|kg|g|lb|lbs|oz|l|ml|mm|cm|inch|in|ft|mp|nit|nits|k|btu|rpm|db|fps)$/i;

export function namesASpecificModel(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  // "iphone 15", "galaxy s24" — a known series followed by any number is a model.
  if (NAMED_SERIES.test(t) && /\d/.test(t)) return true;
  const matches = t.match(MODEL_TOKEN) ?? [];
  // A token is a model candidate unless it is ENTIRELY a number+unit spec ("8gb", "6000mah",
  // "4k") — those describe a need, not a product identity, no matter how model-shaped they
  // look structurally. A genuine model code ("s24", "g835lw", "rtx4050") never matches this,
  // since it starts with a letter, not a digit.
  return matches.some((tok) => !SPEC_UNIT_TOKEN.test(tok.trim()));
}

/**
 * Decide which capability this query needs.
 *
 * The order is the rule, and each step exists because skipping it produces a worse answer
 * than the entry point already gives today:
 *   0. Comparison intent               → comparison. «S25 ولا iPhone 17؟» is a request to
 *      weigh two named things against each other, not a need to reason about or a plain
 *      browse — checked FIRST because a comparison sentence can otherwise satisfy the
 *      "named model" retrieval rule below by accident (both sides often name a model),
 *      which used to route it to plain retrieval with no comparison framing at all.
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

  const compareIntent = detectCompareIntent(raw);
  if (compareIntent.kind !== 'none') {
    return { mode: 'comparison', reason: `comparison marker: ${compareIntent.marker}`, task, compareIntent };
  }

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
