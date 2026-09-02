// src/app/api/admin/campaigns/[id]/route.ts — Phase 2. PATCH covers edit/pause/enable/
// preview-state changes; DELETE removes a campaign row (campaign_clicks keeps its own
// history via ON DELETE CASCADE — acceptable for V1: a deleted campaign's click history
// is not separately required to survive, unlike outbound_clicks which is never deleted).
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/auth/audit';
import { validateCampaignDestination } from '@/lib/campaigns/destination-validation';
import type { CampaignMerchant } from '@/lib/campaigns/types';

const PATCHABLE_FIELDS = [
  'title_ar', 'title_en', 'cta_ar', 'cta_en', 'destination_url', 'tracking_id', 'categories',
  'placement', 'enabled', 'start_at', 'end_at', 'verified_at', 'source', 'is_test',
  'disclosure_ar', 'disclosure_en',
] as const;

// affiliate_campaigns is a new table not yet in the generated Database type — same escape
// hatch as growth_content (src/app/api/admin/growth/content/route.ts).
function untypedClient() {
  return createServerClient() as unknown as { from: (table: string) => any };
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireRequestAdmin(request);
    const { id } = await props.params;
    const body = await request.json();

    const supabase = untypedClient();
    const { data: existing, error: fetchError } = await supabase
      .from('affiliate_campaigns')
      .select('id, merchant, destination_url')
      .eq('id', id)
      .maybeSingle();
    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    for (const field of PATCHABLE_FIELDS) {
      if (field in body) updates[field] = body[field];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    // If destination_url changes, re-validate against the campaign's (immutable in
    // V1) merchant — never trust a client-supplied URL without re-checking the host.
    if (typeof updates.destination_url === 'string') {
      const merchant = existing.merchant as CampaignMerchant;
      const destCheck = validateCampaignDestination(merchant, updates.destination_url);
      if (!destCheck.valid) {
        return NextResponse.json({ error: `destination_url rejected: ${destCheck.reason}` }, { status: 400 });
      }
    }
    if (updates.start_at || updates.end_at) {
      const { data: current } = await supabase.from('affiliate_campaigns').select('start_at, end_at').eq('id', id).single();
      const start = Date.parse((updates.start_at as string) || current?.start_at);
      const end = Date.parse((updates.end_at as string) || current?.end_at);
      if (end <= start) return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('affiliate_campaigns')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    await createAuditLog({
      user_id: profile.id,
      action: AUDIT_ACTIONS.AFFILIATE_CAMPAIGN_UPDATED,
      entity_type: 'affiliate_campaign',
      entity_id: id,
      details: { fields: Object.keys(updates) },
    });

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireRequestAdmin(request);
    const { id } = await props.params;
    const supabase = untypedClient();
    const { error } = await supabase.from('affiliate_campaigns').delete().eq('id', id);
    if (error) throw error;

    await createAuditLog({
      user_id: profile.id,
      action: AUDIT_ACTIONS.AFFILIATE_CAMPAIGN_DELETED,
      entity_type: 'affiliate_campaign',
      entity_id: id,
      details: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error deleting campaign:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
