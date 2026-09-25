import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin } from '@/lib/founder/api';
import { fetchFunding } from '@/lib/founder/finance';
import { createFunding, softDeleteFunding } from '@/lib/founder/ledger';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => NextResponse.json({ funding: await fetchFunding() }));

export const POST = withAdmin(async (req: NextRequest, admin) => {
  const body = await req.json();
  return NextResponse.json(await createFunding(body, admin.id), { status: 201 });
});

export const DELETE = withAdmin(async (req: NextRequest, admin) => {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await softDeleteFunding(id, admin.id);
  return NextResponse.json({ ok: true });
});
