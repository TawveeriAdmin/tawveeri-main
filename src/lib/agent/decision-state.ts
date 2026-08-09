// src/lib/agent/decision-state.ts
// THE SHOPPING DECISION STATE (2026-08-09, Unified Intelligence mission, Phase 2 · Section 6).
//
// Conversation LANGUAGE can change turn to turn — the same shopper might say «مكيف هادي
// لغرفة 30 متر», then «خليه تحت 3500», then «طيب ليش هذا أفضل؟». What must NOT change
// shape on every turn is the system's understanding of what's being decided. This is that
// stable, inspectable structure: one object, built up incrementally, never re-interpreted
// from scratch each turn (Section 6's hard requirement).
//
// This does NOT replace `journey-context.ts` — that file's exact storage format and public
// functions (`saveJourneyTask`/`readJourneyTask`) are pinned by existing tests and existing
// callers and stay untouched. This is the richer, formal contract those callers now ALSO
// populate (see journey-context.ts's shadow-write), and the one new surfaces (the Constraint
// Ledger UI, Section 7) read from. One state, two access paths during the migration — never
// two independent understandings of the same conversation.
//
// Same-tab only (sessionStorage), same safety discipline as journey-context.ts: best-effort,
// never throws, gone when the tab closes. No server write, no account linkage, no persistent
// memory (E7 — persistent cross-session memory is research+design only this mission).
import type { AdvisorParsed } from './advisor-api';
import type { DecisionIntent } from './decision-intent';

export interface EliminatedCandidate {
  id: string;
  reason: string;
}

export interface PriceContext {
  budget_total: number | null;
  anyWithinBudget: boolean | null;
}

export interface DecisionState {
  journey_id: string;
  category: string | null;
  intent: DecisionIntent | null;
  /** Constraints that must hold — never silently relaxed (Section 0). Keyed by field name
   *  (`budget_total`, `room_size_m2`, `city`, `storage_min`, `ram_min`, …). */
  hard_constraints: Record<string, number | string>;
  /** Preferences the engine RANKS by, never filters out (`priorities` from the parser). */
  soft_preferences: string[];
  /** Stated outright by the shopper, vs `inferred_preferences` below — kept separate so a
   *  guess is never presented with the same confidence as something the shopper said. */
  explicit_preferences: string[];
  inferred_preferences: string[];
  /** Fields the parser could not extract (`ParsedTask.unresolved`) — carried so a later
   *  clarification or Constraint Ledger prompt can target exactly what's missing. */
  unresolved_questions: string[];
  /** Canonical IDs currently in play. Lean by design — full product objects live in the
   *  evidence layer (`evidence-engine.ts`) and are never duplicated into this state. */
  current_candidate_set: string[];
  eliminated_candidates: EliminatedCandidate[];
  current_shortlist: string[];
  selected_product: string | null;
  selected_offer: string | null;
  merchant_preferences: string[];
  /** ISO timestamp of the evidence this state reflects — a Decision Delta / counterfactual
   *  (Section 32, research+design this mission) needs to know how fresh its baseline is. */
  evidence_snapshot_at: string | null;
  /** Named gaps ("installation cost unknown") — never silently absent from the state just
   *  because nothing was found; "unknown" is itself a fact worth carrying (Section 0). */
  unknowns: string[];
  price_context: PriceContext;
  conversation_turn: number;
  updated_at: string;
}

function newJourneyId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `j_${Date.now().toString(36)}${rand}`;
}

export function createDecisionState(): DecisionState {
  const now = new Date().toISOString();
  return {
    journey_id: newJourneyId(),
    category: null,
    intent: null,
    hard_constraints: {},
    soft_preferences: [],
    explicit_preferences: [],
    inferred_preferences: [],
    unresolved_questions: [],
    current_candidate_set: [],
    eliminated_candidates: [],
    current_shortlist: [],
    selected_product: null,
    selected_offer: null,
    merchant_preferences: [],
    evidence_snapshot_at: null,
    unknowns: [],
    price_context: { budget_total: null, anyWithinBudget: null },
    conversation_turn: 0,
    updated_at: now,
  };
}

const HARD_CONSTRAINT_FIELDS: (keyof AdvisorParsed)[] = ['room_size_m2', 'budget_total', 'city'];

/**
 * Fold a freshly-parsed task into the state — additively. A field present in `task` overwrites
 * the same field in `hard_constraints`/`soft_preferences`; a field ABSENT from `task` is left
 * as it was, never cleared. That is the "must not re-interpret the whole conversation from
 * scratch" rule made concrete: turn 2 saying only a budget does not erase turn 1's room size.
 */
export function applyParsedTask(state: DecisionState, task: AdvisorParsed, intent: DecisionIntent): DecisionState {
  const hard_constraints = { ...state.hard_constraints };
  for (const field of HARD_CONSTRAINT_FIELDS) {
    const v = task[field];
    if (v !== undefined && v !== null) hard_constraints[field] = v as number | string;
  }
  const soft_preferences = task.priorities?.length
    ? [...new Set([...state.soft_preferences, ...task.priorities])]
    : state.soft_preferences;
  const explicit_preferences = task.priorities?.length
    ? [...new Set([...state.explicit_preferences, ...task.priorities])]
    : state.explicit_preferences;
  return {
    ...state,
    // `task.category` is a plain `string` on `AdvisorParsed`/`ParsedTask` (never `null`) —
    // `parseShoppingTask` returns `category: ""` when nothing was classified, so `??` alone
    // does NOT fall back (empty string is not null/undefined). MEASURED (2026-08-09, Section
    // 43 multi-turn missions): a category-less follow-up turn ("خليه تحت 4000") silently
    // wiped an already-established category. Truthy check, matching the convention
    // `journey-context.ts`'s own `saveJourneyTask` guard already uses for the same reason.
    category: task.category || state.category,
    intent,
    hard_constraints,
    soft_preferences,
    explicit_preferences,
    unresolved_questions: task.unresolved?.length ? [...new Set(task.unresolved)] : state.unresolved_questions,
    conversation_turn: state.conversation_turn + 1,
    updated_at: new Date().toISOString(),
  };
}

/** Fold the decision engine's result into the state (Section 6: current_candidate_set,
 *  current_shortlist, price_context, evidence_snapshot_at). Pure — reads only what the engine
 *  already returned, never invents a candidate or a budget verdict. */
export function applyDecisionResult(
  state: DecisionState,
  result: {
    recommendations?: Array<{ canonical_id: string }>;
    smart_pick?: { canonical_id: string } | null;
    budget_satisfied?: boolean;
  },
): DecisionState {
  const ids = (result.recommendations ?? []).map((r) => r.canonical_id);
  return {
    ...state,
    current_candidate_set: ids,
    current_shortlist: ids,
    selected_product: result.smart_pick?.canonical_id ?? state.selected_product,
    price_context: {
      budget_total: typeof state.hard_constraints.budget_total === 'number' ? state.hard_constraints.budget_total : null,
      anyWithinBudget: result.budget_satisfied ?? null,
    },
    evidence_snapshot_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * THE CONSTRAINT LEDGER'S WRITE PATH (Section 7 — "tap to modify"). Removing a constraint is
 * the one state mutation a shopper triggers directly, so it is a named, auditable operation
 * rather than a generic "set field" — the caller always knows exactly which promise it is
 * retracting, and the state records that the request narrowed rather than silently drifting.
 */
export function removeConstraint(state: DecisionState, field: string): DecisionState {
  const hard_constraints = { ...state.hard_constraints };
  delete hard_constraints[field];
  const soft_preferences = state.soft_preferences.filter((p) => p !== field);
  const explicit_preferences = state.explicit_preferences.filter((p) => p !== field);
  return {
    ...state,
    hard_constraints,
    soft_preferences,
    explicit_preferences,
    conversation_turn: state.conversation_turn + 1,
    updated_at: new Date().toISOString(),
  };
}

// ── Storage (same-tab, best-effort — mirrors journey-context.ts's discipline) ──────────────
const STATE_KEY = 'tawveeri:decision_state';
const MAX_AGE_MS = 45 * 60_000; // same freshness window as journey-context.ts, for one consistent rule

export function saveDecisionState(state: DecisionState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* best-effort only */
  }
}

/** Returns the saved state only when fresh; stale state is treated as absent (same rule
 *  journey-context.ts applies), never silently reused as if it were the current need. */
export function readDecisionState(): DecisionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as DecisionState;
    if (!state?.journey_id || typeof state.updated_at !== 'string') return null;
    const age = Date.now() - new Date(state.updated_at).getTime();
    if (!Number.isFinite(age) || age > MAX_AGE_MS) return null;
    return state;
  } catch {
    return null;
  }
}

export function clearDecisionState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* best-effort only */
  }
}
