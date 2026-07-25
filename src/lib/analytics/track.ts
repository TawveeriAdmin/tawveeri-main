// src/lib/analytics/track.ts
// Lightweight, best-effort, PII-free client tracker for the real-customer measurement
// layer (Founder Directive Part 6). Emits anonymous funnel events to POST /api/events.
// Never throws, never blocks navigation. An anonymous session id lives in localStorage.
//
// TEST vs REAL: a tester opts in by visiting any page with `?test=1` (persisted), which
// makes every event from that browser `is_test=true`. Everyone else is real. This is how
// the founder/QA can exercise the loop without polluting real-user validation metrics.

const SID_KEY = "tw_sid";
const TEST_KEY = "tw_test";

function uuid(): string {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch { /* noop */ }
  return "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Anonymous, stable per-browser session id (NOT a user id). */
export function sessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let s = localStorage.getItem(SID_KEY);
    if (!s) { s = uuid(); localStorage.setItem(SID_KEY, s); }
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

export type EventType = "advisor_query" | "advisor_result" | "evidence_view" | "go_click" | "no_answer" | "error" | "product_view";

/** Fire-and-forget an event. Safe to call anywhere on the client. */
export function track(event_type: EventType, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ event_type, session_id: sessionId(), source: "web", ...props });
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (isTestMode()) headers["x-tw-test"] = "1";
    // keepalive lets a go_click event survive the immediate navigation away.
    fetch("/api/events", { method: "POST", headers, body: payload, keepalive: true }).catch(() => {});
  } catch { /* best-effort */ }
}
