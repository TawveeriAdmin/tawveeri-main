// PATCH /api/admin/growth/shadow-review — Radar 2.0 Phase 2, Checkpoint 3.
// The ONLY founder-facing Shadow surface (architecture doc §M/§W). Five
// labels only. Writes exclusively to Shadow's own tables via
// shadow-review.ts — never demand_opportunities, never draftReply(), never
// sendHighOpportunityAlert(). Same admin-auth gate as the existing founder-
// action route (PATCH /api/admin/growth/opportunities) — this is a NEW,
// separate route, not a modification of that one.

import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { labelShadowReview } from '@/lib/growth/demand-radar/shadow/shadow-review';
import { SHADOW_REVIEW_LABELS } from '@/lib/growth/demand-radar/shadow/types';

export async function PATCH(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
  let body: { id?: string; label?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!body.id || !body.label || !SHADOW_REVIEW_LABELS.includes(body.label as (typeof SHADOW_REVIEW_LABELS)[number])) {
    return NextResponse.json({ error: 'id and a valid label are required' }, { status: 400 });
  }
  const result = await labelShadowReview(body.id, body.label as (typeof SHADOW_REVIEW_LABELS)[number], body.note ?? null);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
