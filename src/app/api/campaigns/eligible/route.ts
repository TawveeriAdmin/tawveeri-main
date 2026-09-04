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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category');
  const safeCategory = category && /^[a-z_]{1,40}$/i.test(category) ? category : null;
  // Amazon Decision Layer V2.1 §3 — evidence for resolveAmazonDestination(), NEVER
  // trusted as-is: productId is re-verified server-side against product_stores
  // (amazon-evidence.ts) before it can influence a link; queryText only ever reaches
  // sanitizeModelSearchTerm(), never an unsanitized Amazon URL.
  const productIdRaw = req.nextUrl.searchParams.get('productId');
  const productId = productIdRaw && UUID_RE.test(productIdRaw) ? productIdRaw : null;
  const queryText = req.nextUrl.searchParams.get('q')?.slice(0, 200) || null;
  const campaigns = await getEligibleCampaigns(
    'post_search',
    safeCategory,
    {
      sessionId: req.cookies.get('tw_sid')?.value ?? null,
      isTest: req.cookies.get('tw_test')?.value === '1' || req.cookies.get('tw_admin')?.value === '1',
    },
    { productId, queryText },
  );
  return NextResponse.json({ campaigns }, { headers: { 'cache-control': 'no-store' } });
}
