import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin } from '@/lib/founder/api';
import { fetchBudgets } from '@/lib/founder/finance';
import { upsertBudget } from '@/lib/founder/ledger';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => NextResponse.json({ budgets: await fetchBudgets() }));

export const POST = withAdmin(async (req: NextRequest, admin) => {
  const body = await req.json();
  return NextResponse.json(await upsertBudget(body, admin.id), { status: 201 });
});
