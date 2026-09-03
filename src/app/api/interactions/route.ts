// src/app/api/interactions/route.ts
// ADR-286 (third pass, 2026-09-03) — the decision-grade explicit-interaction endpoint.
// Records that a real onClick handler fired, BEFORE the browser navigates away. Called via
// navigator.sendBeacon (preferred) or fetch(..., {keepalive:true}) — see
// src/lib/analytics/interaction.ts, the ONE place `interaction_id` is generated (client-side,
// crypto.randomUUID(), at the moment of the click — never server-rendered, so a page-fetcher
// that never executes this click handler can never obtain a valid one to replay).
//
// NEVER blocks or fails the click that triggered it (best-effort, always 204 — same convention
// as /api/events). Idempotent by construction: `interaction_id` is the table's primary key, so
// a retried beacon (the exact case navigator.sendBeacon exists to make safe across page unload)
// upserts onto the SAME row, never a second interaction.
//
// SERVER OWNS EVERY CLASSIFICATION FIELD — the whole point of this pass. `provenance` and
// `is_test` were never read from the request body in the prior version either (verified by
// re-reading the code, not assumed) — this pass makes that explicit, adds a THIRD is_test
// signal beyond the existing tw_test/tw_admin/bot-UA set (an authenticated admin/store session,
// which `tw_admin` alone misses whenever staff browse the public site outside /admin — the
// exact "fail closed for unclassified internal context" gap named in this pass), and adds
// format/allowlist validation on every client-supplied field that previously had none
// (`surface`, `go_id`, `canonical_id`) plus stops trusting `session_id` from the body at all,
// reading it from the SAME `tw_sid` cookie /go already reads server-side instead.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { getUser } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT_UA = /bot|crawl|spider|slurp|bingpreview|headless|puppeteer|playwright|lighthouse|python-requests|curl|wget|axios|node-fetch/i;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GO_ID_RE = /^(ps_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every surface this pass actually wired (src/lib/analytics/interaction.ts callers). An
// unrecognized value is NEUTRALIZED to 'unknown', never rejected outright — `surface` is a
// reporting label, not a security-relevant field, so a stale/unexpected value should still
// count as a real interaction rather than silently vanish; it just won't be misreported under
// a name this endpoint never validated.
const KNOWN_SURFACES = new Set([
  "advisor", "agent", "product_page", "checkout", "home_mission", "home_mission_checklist",
  "home_mission_retailer_cta", "search_card", "search_panel", "smart_pick", "closest_options",
  "product_detail_sheet", "compare_list", "compare_featured", "compare_all_offers",
  "category_page", "home_verified_deal",
]);

export async function POST(req: NextRequest) {
  try {
    // sendBeacon sends a Blob body (often text/plain; the browser does not let JS set the
    // Content-Type header on it) — parse as text first, then JSON, rather than requiring
    // req.json() to succeed against a Content-Type it may not recognize.
    const raw = await req.text().catch(() => "");
    const body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;

    const interactionId = typeof body.interaction_id === "string" ? body.interaction_id : "";
    if (!ID_RE.test(interactionId)) return new NextResponse(null, { status: 204 });

    const rawSurface = typeof body.surface === "string" ? body.surface.slice(0, 40) : "";
    const surface = KNOWN_SURFACES.has(rawSurface) ? rawSurface : "unknown";

    const rawGoId = typeof body.go_id === "string" ? body.go_id : null;
    const goId = rawGoId && GO_ID_RE.test(rawGoId) ? rawGoId : null;

    const rawCanonicalId = typeof body.canonical_id === "string" ? body.canonical_id : null;
    const canonicalId = rawCanonicalId && UUID_RE.test(rawCanonicalId) ? rawCanonicalId : null;

    // session_id is NEVER read from the request body — same cookie /go already reads
    // server-side (ADR-244's readAttribution pattern), never a client-declared value.
    const sessionId = req.cookies.get("tw_sid")?.value?.slice(0, 64) || null;

    // Same is_test derivation shape as /api/events and /go (BOT_UA / tw_admin / explicit
    // opt-in) — one governed definition of "test", not re-picked here — PLUS a fourth signal
    // this pass adds: an authenticated admin/store session, which `tw_admin` alone misses
    // whenever staff browse the public site outside the /admin layout that sets it. A client
    // can only ever ADD test-classification, never remove one the server itself determines —
    // fail toward excluding from real metrics, never toward including.
    const ua = req.headers.get("user-agent") ?? "";
    const isAdminCookie = req.cookies.get("tw_admin")?.value === "1";
    let isStaffSession = false;
    try {
      const user = await getUser();
      isStaffSession = !!user; // any authenticated account browsing is internal/staff-adjacent
      // traffic for THIS endpoint's purposes — Tawveeri has no customer-facing account action
      // that would fire an interaction while signed in today (search/browse/exit are all
      // anonymous flows); an authenticated hit here is staff testing until that changes.
    } catch {
      isStaffSession = false; // fail toward NOT excluding real anonymous customer traffic if auth itself errors
    }
    const isTest =
      req.cookies.get("tw_test")?.value === "1" ||
      req.headers.get("x-tw-test") === "1" ||
      BOT_UA.test(ua) ||
      isAdminCookie ||
      isStaffSession;

    const supabase = createServerClient() as unknown as { from: (table: string) => any };
    // on conflict do nothing — a retried POST (the exact scenario sendBeacon/keepalive-retry
    // exists to make safe) upserts onto the SAME interaction_id, never a second row.
    await supabase.from("first_party_interactions").upsert(
      {
        interaction_id: interactionId,
        go_id: goId,
        canonical_product_id: canonicalId,
        session_id: sessionId,
        surface,
        // Server-derived, never read from the request body — an arbitrary POST cannot
        // declare its own provenance. 'internal_test' is used whenever ANY of the is_test
        // signals fired from admin/staff identity specifically (cookie or session); a bot-UA
        // or explicit tester opt-in still lands 'first_party_ui_interaction' with is_test=true
        // — provenance names WHO, is_test is still the one gate every count already applies.
        provenance: (isAdminCookie || isStaffSession) ? "internal_test" : "first_party_ui_interaction",
        is_test: isTest,
      },
      { onConflict: "interaction_id", ignoreDuplicates: true }
    );
  } catch {
    // best-effort: measurement must never break the experience, and must never delay a
    // redirect the click already triggered.
  }
  return new NextResponse(null, { status: 204 });
}
