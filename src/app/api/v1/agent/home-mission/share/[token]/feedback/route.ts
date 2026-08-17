// Feedback on a shared plan (ADR-257). POST = a recipient's lightweight opinion
// (reaction + optional short note + name — no account); GET = the OWNER reading the
// feedback, gated by the owner_key returned once at share creation. Anonymous writes
// are capped per share and rate-limited by the global /api middleware limiter.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { SHARE_TOKEN_RE, MAX_FEEDBACK_PER_SHARE, validateFeedback, type ShareSnapshot } from "@/lib/agent/home-mission-share";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadShare(sb: any, token: string) {
  if (!SHARE_TOKEN_RE.test(token)) return null;
  const res = await sb.from("shared_home_plans")
    .select("id, owner_key, snapshot, revoked_at, expires_at")
    .eq("token", token).maybeSingle();
  const row = res?.data as { id: string; owner_key: string; snapshot: ShareSnapshot; revoked_at: string | null; expires_at: string } | null;
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServerClient() as any;
  const share = await loadShare(sb, token);
  if (!share) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const fb = validateFeedback(body, share.snapshot);
  if (!fb) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const countRes = await sb.from("shared_home_plan_feedback")
    .select("id", { count: "exact", head: true }).eq("share_id", share.id);
  if ((countRes?.count ?? 0) >= MAX_FEEDBACK_PER_SHARE) {
    return NextResponse.json({ error: "full" }, { status: 429 });
  }
  const ins = await sb.from("shared_home_plan_feedback").insert({
    share_id: share.id, leg_id: fb.leg_id, reaction: fb.reaction, note: fb.note, reviewer_name: fb.reviewer_name,
  });
  if (ins?.error) return NextResponse.json({ error: "store_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServerClient() as any;
  const share = await loadShare(sb, token);
  if (!share) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Owner-only readback: the owner_key never appears in the share URL or the viewer page.
  const key = request.nextUrl.searchParams.get("owner_key") ?? "";
  if (key !== share.owner_key) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const res = await sb.from("shared_home_plan_feedback")
    .select("leg_id, reaction, note, reviewer_name, created_at")
    .eq("share_id", share.id).order("created_at", { ascending: false }).limit(MAX_FEEDBACK_PER_SHARE);
  return NextResponse.json({ feedback: res?.data ?? [] });
}
