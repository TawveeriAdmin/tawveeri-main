// src/lib/agent/journey-context.ts
// ONE TAWVEERI BRAIN (2026-08-09, founder architectural clarification) — a shopper who
// searches «مكيف لغرفة 30 متر هادي تحت 4000» and then opens a product and asks «طيب ليش
// هذا أفضل؟» must not lose that context. This is JOURNEY context, not a user profile: it
// lives in sessionStorage (gone when the tab closes), holds only what Waffar already parsed
// from the shopper's own words, and is read ONLY when the viewed product's category matches
// — a laptop budget must never leak into an AC consultation. No server write, no account
// linkage; purely a same-tab convenience so the next question doesn't start from zero.
//
// PHASE 2 (2026-08-09, Unified Intelligence mission, Section 6): `saveJourneyTask` now ALSO
// folds the same understanding into the formal `DecisionState` (`decision-state.ts`) — the
// richer, structured contract new surfaces (the Constraint Ledger, Section 7) read from. This
// file's own storage key/format and both exported functions are UNCHANGED and still pinned by
// `tests/agent/journey-context.test.ts`; the DecisionState write is additive and best-effort,
// never a replacement for the existing behavior.
import type { AdvisorParsed } from "./advisor-api";
import { classifyDecisionIntent } from "./decision-intent";
import { applyParsedTask, createDecisionState, readDecisionState, saveDecisionState } from "./decision-state";

const STORAGE_KEY = "tawveeri:journey_task";
// A journey context older than this is more likely stale intent than a still-relevant need
// (the shopper may have moved on to browsing something else entirely in the same tab).
const MAX_AGE_MS = 45 * 60_000;

interface StoredJourneyTask {
  task: AdvisorParsed;
  savedAt: number;
}

/** Called after a search yields a real Waffar answer — persists what was UNDERSTOOD (not
 *  the raw query text), so a later product-page question can build on it. Best-effort:
 *  sessionStorage can be unavailable (SSR, privacy mode) — failures are silent, never
 *  surfaced, since this is a convenience layer, not a required capability.
 *
 *  `rawText` is OPTIONAL and used only to classify the DecisionState's `intent` (Section 6)
 *  via the shared `classifyDecisionIntent` — every existing caller that omits it keeps
 *  working exactly as before (the legacy key/behavior below never depended on it), and the
 *  shadow-written state simply falls back to a generic 'NEEDS_DISCOVERY' intent. */
export function saveJourneyTask(task: AdvisorParsed | undefined | null, rawText?: string): void {
  if (!task?.category || typeof window === "undefined") return;
  try {
    const entry: StoredJourneyTask = { task, savedAt: Date.now() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* best-effort only */
  }
  try {
    const intent = rawText ? classifyDecisionIntent(rawText).intent : 'NEEDS_DISCOVERY';
    const existing = readDecisionState() ?? createDecisionState();
    saveDecisionState(applyParsedTask(existing, task, intent));
  } catch {
    /* best-effort only, same discipline as the legacy write above */
  }
}

/** Returns the saved journey task ONLY when it is fresh AND its category matches the
 *  product/page currently being viewed — never carried across an unrelated category (a
 *  room-size/budget parsed for an AC search must never apply to a laptop). */
export function readJourneyTask(forCategory: string | null | undefined): AdvisorParsed | null {
  if (!forCategory || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as StoredJourneyTask;
    if (!entry?.task?.category || entry.task.category !== forCategory) return null;
    if (typeof entry.savedAt !== "number" || Date.now() - entry.savedAt > MAX_AGE_MS) return null;
    return entry.task;
  } catch {
    return null;
  }
}
