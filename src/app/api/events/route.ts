import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { USAGE_EVENT_SET } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/events — the real-customer measurement layer (Founder Directive Part 6).
 *
 * Records anonymous funnel events (advisor_query, advisor_result, evidence_view,
 * go_click, no_answer, error) into the append-only `usage_events` table. It NEVER
 * blocks or fails the user (best-effort; always 204). It separates REAL from TEST
 * traffic so we never claim user validation until real users exist:
 *   - is_test = true when the client sends `x-tw-test: 1` (testers opt in via ?test=1),
 *     the user-agent is a known bot/crawler, or the `tw_admin` cookie is present (set
 *     by AdminActivityMarker only inside the already-role-gated /admin layout — see
 *     ADR-216, Founder Commercial Intelligence). Admin-caused rows are tagged
 *     `meta.excluded_reason = 'admin_session'` so they stay queryable as their own
 *     bucket even though they share the same `is_test` exclusion boolean as opt-in
 *     TEST traffic — this only affects FUTURE events, historical rows are untouched.
 * No auth, no PII: session_id is an anonymous client uuid, query_text is truncated.
 */
// ADR-244: derived from the shared contract, never hand-maintained here again —
// a hand-copied list silently dropped 3 emitted event types for months.
const ALLOWED = USAGE_EVENT_SET;
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|headless|puppeteer|playwright|lighthouse|python-requests|curl|wget|axios|node-fetch/i;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const eventType = String(body.event_type ?? "").slice(0, 40);
    if (!ALLOWED.has(eventType)) return new NextResponse(null, { status: 204 });

    const ua = req.headers.get("user-agent") ?? "";
    const isAdminSession = req.cookies.get("tw_admin")?.value === "1";
    const isTest = req.headers.get("x-tw-test") === "1" || body.is_test === true || BOT_UA.test(ua) || isAdminSession;

    const clamp = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
    const meta = body.meta && typeof body.meta === "object" ? { ...(body.meta as Record<string, unknown>) } : {};
    if (isAdminSession) meta.excluded_reason = "admin_session";
    const row = {
      event_type: eventType,
      session_id: clamp(body.session_id, 64),
      is_test: isTest,
      category: clamp(body.category, 40),
      query_text: clamp(body.query_text, 200),
      canonical_id: clamp(body.canonical_id, 64),
      store: clamp(body.store, 40),
      source: clamp(body.source, 20) ?? "web",
      meta: Object.keys(meta).length > 0 ? meta : null,
      user_agent: ua.slice(0, 300),
    };

    const supabase = createServerClient();
    await supabase.from("usage_events").insert(row);
  } catch {
    // best-effort: measurement must never break the experience
  }
  return new NextResponse(null, { status: 204 });
}
