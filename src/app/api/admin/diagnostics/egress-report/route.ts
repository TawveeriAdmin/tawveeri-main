import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/diagnostics/egress-report — TEMPORARY, single-purpose diagnostic.
 *
 * Noon commerce data truth mission (2026-09-10), founder follow-up: evaluate a FIXED
 * alternate egress/worker architecture (distinct from IP rotation) as a legitimate
 * candidate data path, per the founder's explicit A/B distinction. This route is the
 * receiving end of a one-off GitHub Actions job that curls Noon directly from GitHub's
 * runner network (a different, already-used-by-this-project infrastructure category,
 * not a scraping-specific proxy) and reports what it saw. Logs to stdout (readable via
 * `railway logs`) rather than writing to the database — this is a connectivity probe,
 * not data. Delete this route (and the triggering workflow) once the decision is made.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  console.log('[egress-probe-report]', JSON.stringify(body));
  return NextResponse.json({ received: true });
}
