import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin } from '@/lib/founder/api';
import { fetchRevenueEntries } from '@/lib/founder/finance';
import { createRevenue } from '@/lib/founder/ledger';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => NextResponse.json({ entries: await fetchRevenueEntries() }));

export const POST = withAdmin(async (req: NextRequest, admin) => {
  const body = await req.json();
  const result = await createRevenue(body, admin.id);
  return NextResponse.json(result, { status: 201 });
});
