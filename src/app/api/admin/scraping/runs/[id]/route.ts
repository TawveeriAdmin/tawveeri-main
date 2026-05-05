import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('scraping_runs')
    .select(`
      *,
      stores:store_id (slug, name_ar, name_en, logo_url),
      schedule:schedule_id (id, cron_expression)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ run: data });
}
