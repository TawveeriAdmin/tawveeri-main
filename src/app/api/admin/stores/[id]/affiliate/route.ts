import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// DEPRECATED (2026-08-05, closeout defect fix): this route wrote to `stores.affiliate_config`,
// a column from migration 20 that was never applied to production (ADR-212) and, even where it
// exists, is not read by the actual exit path — every `/go` redirect resolves the affiliate tag
// from the code-based Provider Registry (`src/lib/providers/registry.ts`, ADR-085), which is the
// real authoritative source. Kept as a route (not deleted) so a stale client call fails with a
// clear, honest explanation instead of a raw "column does not exist" Postgres error.
export async function PATCH(request: NextRequest, _context: RouteContext) {
  try {
    await requireRequestAdmin(request);
    return NextResponse.json(
      {
        error: 'Affiliate configuration is code-managed, not DB-editable.',
        detail: 'See src/lib/providers/registry.ts (ADR-085/ADR-212). Change the tag/param there and deploy.',
      },
      { status: 410 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Authentication required' || error.message === 'Admin access required')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
