// PATCH /api/admin/growth/opportunities — founder decisions on radar
// opportunities (ADR-247 §22, §29). Approval is INTERNAL — it never publishes
// anywhere. Founder decisions are the evaluation feedback loop.

import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';

const ACTIONS = new Set(['approved', 'changes_requested', 'dismissed', 'replied_manually']);

export async function PATCH(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
  let body: { id?: string; action?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!body.id || !body.action || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: 'id and a valid action are required' }, { status: 400 });
  }
  const sb = createServerClient() as any;
  const { data, error } = await sb
    .from('demand_opportunities')
    .update({
      status: body.action,
      founder_note: body.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .select('id, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, opportunity: data });
}
