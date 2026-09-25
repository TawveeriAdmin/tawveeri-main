import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin } from '@/lib/founder/api';
import { fetchSubscriptions, createSubscription, materializeExpectedExpenses } from '@/lib/founder/subscriptions';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => NextResponse.json({ subscriptions: await fetchSubscriptions() }));

export const POST = withAdmin(async (req: NextRequest, admin) => {
  const body = await req.json();
  if (body?.action === 'materialize') return NextResponse.json(await materializeExpectedExpenses(admin.id));
  return NextResponse.json(await createSubscription(body, admin.id), { status: 201 });
});
