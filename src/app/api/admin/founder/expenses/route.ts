import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin } from '@/lib/founder/api';
import { fetchExpenses } from '@/lib/founder/finance';
import { createExpense } from '@/lib/founder/ledger';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => NextResponse.json({ expenses: await fetchExpenses() }));

export const POST = withAdmin(async (req: NextRequest, admin) => {
  const body = await req.json();
  const { id } = await createExpense(body, admin.id);
  return NextResponse.json({ id }, { status: 201 });
});
