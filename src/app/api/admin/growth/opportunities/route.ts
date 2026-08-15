// PATCH /api/admin/growth/opportunities — founder decisions on radar
// opportunities (ADR-247 §22, §29). Approval is INTERNAL — it never publishes
// anywhere. Founder decisions are the evaluation feedback loop.

import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';

const OPPORTUNITY_ACTIONS = new Set(['approved', 'changes_requested', 'dismissed', 'replied_manually']);
const MENTION_ACTIONS = new Set(['handled', 'dismissed']);

export async function PATCH(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
  let body: { id?: string; action?: string; note?: string; kind?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const isMention = body.kind === 'mention';
  const valid = isMention ? MENTION_ACTIONS : OPPORTUNITY_ACTIONS;
  if (!body.id || !body.action || !valid.has(body.action)) {
    return NextResponse.json({ error: 'id and a valid action are required' }, { status: 400 });
  }
  const sb = createServerClient() as any;
  const { data, error } = await sb
    .from(isMention ? 'brand_mentions' : 'demand_opportunities')
    .update({
      status: body.action,
      founder_note: body.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .select('id, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}
