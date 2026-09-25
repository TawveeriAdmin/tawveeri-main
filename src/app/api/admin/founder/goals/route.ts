import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin } from '@/lib/founder/api';
import { fetchGoals } from '@/lib/founder/goals';
import { createGoal } from '@/lib/founder/ledger';
import { riyadhMonthStart } from '@/lib/founder/windows';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (req: NextRequest) => {
  const m = req.nextUrl.searchParams.get('month');
  const month = m && /^\d{4}-\d{2}-01$/.test(m) ? new Date(`${m}T00:00:00+03:00`) : riyadhMonthStart();
  return NextResponse.json({ goals: await fetchGoals(month) });
});

export const POST = withAdmin(async (req: NextRequest, admin) => {
  const body = await req.json();
  return NextResponse.json(await createGoal(body, admin.id), { status: 201 });
});
