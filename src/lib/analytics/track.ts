// src/lib/analytics/track.ts
// Lightweight, best-effort, PII-free client tracker for the real-customer measurement
// layer (Founder Directive Part 6). Emits anonymous funnel events to POST /api/events.
// Never throws, never blocks navigation. An anonymous session id lives in localStorage.
//
// TEST vs REAL: a tester opts in by visiting any page with `?test=1` (persisted), which
// makes every event from that browser `is_test=true`. Everyone else is real. This is how
// the founder/QA can exercise the loop without polluting real-user validation metrics.

import { getEntryVariant } from "./variant";
import { getCampaign } from "./campaign";
import type { UsageEventType } from "./events";

const SID_KEY = "tw_sid";
const TEST_KEY = "tw_test";

function uuid(): string {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch { /* noop */ }
  return "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Anonymous, stable per-browser session id (NOT a user id). Mirrored into a
 *  cookie (ADR-244) so plain-navigation exits through `/go` can carry the same
 *  session identity server-side — this is what joins a retailer exit back to
 *  the session/campaign that produced it, CONFIRMED instead of a 10s-window
 *  estimate. Same pattern the tw_test cookie already uses. */
export function sessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let s = localStorage.getItem(SID_KEY);
    if (!s) { s = uuid(); localStorage.setItem(SID_KEY, s); }
    try { document.cookie = `tw_sid=${encodeURIComponent(s)}; path=/; max-age=31536000; samesite=lax`; } catch { /* noop */ }
    return s;
  } catch { return ""; }
}

function setTestCookie(on: boolean): void {
  try { document.cookie = on ? "tw_test=1; path=/; max-age=31536000; samesite=lax" : "tw_test=; path=/; max-age=0; samesite=lax"; } catch { /* noop */ }
}

/** Persist a test-mode opt-in from `?test=1` (call once on mount). Mirrors the flag into
 *  a cookie so plain-navigation exits (`/go`) can also be tagged as test, not just fetch events. */
export function initTestModeFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get("test") === "1") { localStorage.setItem(TEST_KEY, "1"); setTestCookie(true); }
    else if (p.get("test") === "0") { localStorage.removeItem(TEST_KEY); setTestCookie(false); }
    else if (localStorage.getItem(TEST_KEY) === "1") setTestCookie(true); // keep cookie in sync
  } catch { /* noop */ }
}

export function isTestMode(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(TEST_KEY) === "1"; } catch { return false; }
}

// Canonical funnel steps span BOTH customer surfaces (storefront + AI advisor), unified by
// step in the funnel report: Search (search|advisor_query) → Results (results|advisor_result)
// → Product View (product_view) → Comparison (comparison_view) → Evidence (evidence_view)
// → Outbound Click (go_click). `no_answer`/`error` are off-funnel signals.
//
// ADR-244: the list itself lives in ./events.ts — ONE contract shared with the
// ingestion API, so an event added here can never again be silently dropped there.
// Per-event semantics (asked-vs-answered, Decision Receipt, Constraint Ledger)
// are documented on the contract entries.
export type EventType = UsageEventType;

// ── Client-side duplicate-fire guard (ADR-282) ──────────────────────────────────────────
// MEASURED in production, August 2026: at least 4 real sessions each fired the SAME
// event_type + query_text 150-242 times inside under a minute (root cause: a circular
// URL<->state sync effect in search-client.tsx, fixed separately) — inflating that
// session's contribution to category-demand counts by two orders of magnitude. The React
// effect bug is fixed at its source, but track() is the ONE choke point every event on the
// site passes through, so a cheap, generic suppression here closes this entire CLASS of bug
// (a render loop, a duplicated listener, a retry storm) regardless of which future call site
// causes it — a UI bug must not be able to inflate a founder business metric by 200x again.
// Deliberately short (1.5s, longer than a single render-loop tick, shorter than any
// plausible legitimate rapid resubmission) and keyed on the fields that actually identify
// "the same logical action", not full prop equality (a rerender rarely reproduces every
// prop byte-for-byte, but query_text/canonical_id/category are stable for a genuine repeat).
const recentFires = new Map<string, number>();
const DUPLICATE_SUPPRESS_MS = 1500;

// Deliberately built from the fields that identify WHICH thing this event is about, not full
// prop equality — a go_click on two DIFFERENT products at the same store within 1.5s (e.g.
// comparing several results quickly) must never collapse into one row, so `store`/`canonical_id`
// both participate; a search/advisor_query repeat-fire (no product/store, same query_text) is
// exactly the pattern this exists to catch.
function dedupeKey(event_type: EventType, props?: Record<string, unknown>): string {
  const pick = (k: string) => (typeof props?.[k] === "string" ? (props[k] as string) : "");
  return [event_type, pick("query_text"), pick("category"), pick("canonical_id"), pick("store"), pick("source")].join("|");
}

/** True if an event with this exact identity fired within the suppression window — call
 *  BEFORE sending, and it records this fire for the next call's check. Bounded map: prunes
 *  stale entries opportunistically so a long browsing session never leaks memory. */
function isDuplicateFire(key: string): boolean {
  const now = Date.now();
  const last = recentFires.get(key);
  recentFires.set(key, now);
  if (recentFires.size > 200) {
    for (const [k, ts] of recentFires) if (now - ts > DUPLICATE_SUPPRESS_MS) recentFires.delete(k);
  }
  return last !== undefined && now - last < DUPLICATE_SUPPRESS_MS;
}

/** Fire-and-forget an event. Safe to call anywhere on the client. Every event carries the
 *  visitor's entry-experiment arm (in meta.variant) so the whole funnel can be compared
 *  advisor-first vs search-first without any per-call plumbing. */
export function track(event_type: EventType, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (isDuplicateFire(dedupeKey(event_type, props))) return;
  try {
    let variant: string | undefined;
    try { variant = getEntryVariant(); } catch { /* noop */ }
    let campaign: Record<string, unknown> = {};
    try { campaign = { ...(getCampaign() ?? {}) }; } catch { /* noop */ }
    const meta = { ...(props?.meta && typeof props.meta === "object" ? (props.meta as Record<string, unknown>) : {}), ...(variant ? { variant } : {}), ...campaign };
    const payload = JSON.stringify({ event_type, session_id: sessionId(), source: "web", ...props, meta });
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (isTestMode()) headers["x-tw-test"] = "1";
    // keepalive lets a go_click event survive the immediate navigation away.
    fetch("/api/events", { method: "POST", headers, body: payload, keepalive: true }).catch(() => {});
  } catch { /* best-effort */ }
}
