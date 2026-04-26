import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { normalizeAffiliateConfig } from '@/lib/transactions/affiliate-config';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireRequestAdmin(request);

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const enabled = Boolean(body.enabled);
    const param = typeof body.param === 'string' ? body.param.trim() : '';
    const value = typeof body.value === 'string' ? body.value.trim() : '';

    if (enabled && (!param || !value)) {
      return NextResponse.json(
        { error: 'Affiliate parameter and value are required when enabled.' },
        { status: 400 },
      );
    }

    const affiliateConfig = enabled
      ? normalizeAffiliateConfig({ enabled, param, value })
      : { enabled: false, param, value };

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('stores')
      .update({ affiliate_config: affiliateConfig })
      .eq('id', id)
      .select('id, slug, affiliate_config')
      .single();

    if (error) throw error;

    return NextResponse.json({ store: data });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Authentication required' || error.message === 'Admin access required')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.error('Error updating affiliate config:', error);
    return NextResponse.json(
      { error: 'Failed to update affiliate settings' },
      { status: 500 },
    );
  }
}
