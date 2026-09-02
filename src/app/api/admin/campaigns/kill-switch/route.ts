// src/app/api/admin/campaigns/kill-switch/route.ts
// Read-only status of the GLOBAL kill switch (AFFILIATE_CAMPAIGNS_ENABLED, Phase 1A).
// There is deliberately NO PATCH/POST here: this app cannot write a Railway process
// environment variable from inside itself, and faking a DB-backed toggle nothing else
// reads would be exactly the kind of "unknown beats incorrect" violation this project
// must not commit. The admin page surfaces this value plus the exact Railway steps to
// flip it — the real toggle lives in Railway's dashboard, not in this codebase.
import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { isCampaignsGloballyEnabled, parseAllowedMerchants } from '@/lib/campaigns/eligibility';

export async function GET(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
    const allowed = parseAllowedMerchants(process.env.AFFILIATE_CAMPAIGNS_MERCHANTS);
    return NextResponse.json({
      globallyEnabled: isCampaignsGloballyEnabled(),
      allowedMerchants: Array.from(allowed),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to read kill switch status' }, { status: 500 });
  }
}
