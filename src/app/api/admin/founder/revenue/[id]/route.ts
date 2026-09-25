import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin } from '@/lib/founder/api';
import { updateRevenue, softDeleteRevenue } from '@/lib/founder/ledger';

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (req: NextRequest, admin, ctx) => {
  const { id } = await ctx.params;
  const body = await req.json();
  await updateRevenue(id, body, admin.id, typeof body.note === 'string' ? body.note : undefined);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAdmin(async (req: NextRequest, admin, ctx) => {
  const { id } = await ctx.params;
  await softDeleteRevenue(id, admin.id, req.nextUrl.searchParams.get('note') ?? undefined);
  return NextResponse.json({ ok: true });
});
