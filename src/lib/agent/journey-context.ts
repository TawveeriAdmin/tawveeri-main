// src/lib/agent/journey-context.ts
// ONE TAWVEERI BRAIN (2026-08-09, founder architectural clarification) — a shopper who
// searches «مكيف لغرفة 30 متر هادي تحت 4000» and then opens a product and asks «طيب ليش
// هذا أفضل؟» must not lose that context. This is JOURNEY context, not a user profile: it
// lives in sessionStorage (gone when the tab closes), holds only what Waffar already parsed
// from the shopper's own words, and is read ONLY when the viewed product's category matches
// — a laptop budget must never leak into an AC consultation. No server write, no account
// linkage; purely a same-tab convenience so the next question doesn't start from zero.
import type { AdvisorParsed } from "./advisor-api";

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
 *  surfaced, since this is a convenience layer, not a required capability. */
export function saveJourneyTask(task: AdvisorParsed | undefined | null): void {
  if (!task?.category || typeof window === "undefined") return;
  try {
    const entry: StoredJourneyTask = { task, savedAt: Date.now() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* best-effort only */
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
