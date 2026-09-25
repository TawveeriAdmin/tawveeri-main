import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin } from '@/lib/founder/api';
import { updateGoal, archiveGoal } from '@/lib/founder/ledger';

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (req: NextRequest, admin, ctx) => {
  const { id } = await ctx.params;
  const body = await req.json();
  const { reason, ...input } = body;
  await updateGoal(id, input, String(reason ?? ''), admin.id);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAdmin(async (req: NextRequest, admin, ctx) => {
  const { id } = await ctx.params;
  await archiveGoal(id, req.nextUrl.searchParams.get('reason') ?? 'archived', admin.id);
  return NextResponse.json({ ok: true });
});
