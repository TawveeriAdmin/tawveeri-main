import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';

export const dynamic = 'force-dynamic';

const REVIEW_STATUSES = new Set(['approved', 'changes_requested', 'rejected']);

/**
 * PATCH /api/admin/growth/content — founder review actions (ADR-244 Gate D).
 * Body: { content_id, status: approved|changes_requested|rejected, note? }
 * The founder never edits the creative here — a changes_requested note goes back
 * to the creative pipeline. Publishing stays a HUMAN act outside this system
 * (approval ≠ publication; nothing auto-posts).
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { content_id?: string; status?: string; note?: string };
    const contentId = String(body.content_id ?? '').slice(0, 80);
    const status = String(body.status ?? '');
    if (!contentId || !REVIEW_STATUSES.has(status)) {
      return NextResponse.json({ error: 'content_id and a valid review status are required' }, { status: 400 });
    }
    const supabase = createServerClient() as unknown as { from: (t: string) => any };
    const { error } = await supabase
      .from('growth_content')
      .update({
        status,
        founder_note: typeof body.note === 'string' ? body.note.slice(0, 2000) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('content_id', contentId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('growth content review failed:', e);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}
