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

/** Fire-and-forget an event. Safe to call anywhere on the client. Every event carries the
 *  visitor's entry-experiment arm (in meta.variant) so the whole funnel can be compared
 *  advisor-first vs search-first without any per-call plumbing. */
export function track(event_type: EventType, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
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
