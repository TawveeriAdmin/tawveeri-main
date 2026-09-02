// src/app/api/campaigns/eligible/route.ts
// Server-side eligibility resolution for the post-search commercial card. Homepage
// resolves campaigns directly in its server component (src/app/[locale]/page.tsx,
// same pattern as getHomeVerifiedDeals) — this route exists ONLY because search results
// are client-rendered and the category context isn't known until after the search API
// responds. Read-only, no auth (same trust level as /api/coupons — public, non-sensitive).
import { NextRequest, NextResponse } from 'next/server';
import { getEligibleCampaigns } from '@/lib/campaigns/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category');
  const safeCategory = category && /^[a-z_]{1,40}$/i.test(category) ? category : null;
  const campaigns = await getEligibleCampaigns('post_search', safeCategory, {
    sessionId: req.cookies.get('tw_sid')?.value ?? null,
    isTest: req.cookies.get('tw_test')?.value === '1' || req.cookies.get('tw_admin')?.value === '1',
  });
  return NextResponse.json({ campaigns }, { headers: { 'cache-control': 'no-store' } });
}
