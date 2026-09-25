import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin } from '@/lib/founder/api';
import { updateExpense, softDeleteExpense } from '@/lib/founder/ledger';

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (req: NextRequest, admin, ctx) => {
  const { id } = await ctx.params;
  const body = await req.json();
  await updateExpense(id, body, admin.id, typeof body.note === 'string' ? body.note : undefined);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAdmin(async (req: NextRequest, admin, ctx) => {
  const { id } = await ctx.params;
  const note = req.nextUrl.searchParams.get('note') ?? undefined;
  await softDeleteExpense(id, admin.id, note);
  return NextResponse.json({ ok: true });
});
