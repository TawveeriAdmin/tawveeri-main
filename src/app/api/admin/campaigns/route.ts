// src/app/api/admin/campaigns/route.ts — Phase 2 minimal founder admin.
// GET: list every campaign (any status — the admin needs to see paused/expired too).
// POST: create a campaign. Destination is validated against the merchant's approved
// host allowlist at write time (never trusted from the client) — this is the ONE
// place an arbitrary external destination_url could be smuggled in, so it is refused
// here, not just at click time.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/auth/audit';
import { validateCampaignDestination } from '@/lib/campaigns/destination-validation';
import type { CampaignMerchant, CampaignPlacement } from '@/lib/campaigns/types';

const MERCHANTS: CampaignMerchant[] = ['amazon', 'noon'];
const PLACEMENTS: CampaignPlacement[] = ['homepage', 'post_search', 'both'];

// affiliate_campaigns is a new table not yet in the generated Database type — same escape
// hatch as growth_content (src/app/api/admin/growth/content/route.ts).
function untypedClient() {
  return createServerClient() as unknown as { from: (table: string) => any };
}

export async function GET(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
    const supabase = untypedClient();
    const { data, error } = await supabase
      .from('affiliate_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ campaigns: data || [] });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireRequestAdmin(request);
    const body = await request.json();
    const {
      merchant, title_ar, title_en, cta_ar, cta_en, destination_url, tracking_id,
      categories, placement, start_at, end_at, source, is_test,
      disclosure_ar, disclosure_en,
    } = body;

    if (!merchant || !MERCHANTS.includes(merchant)) {
      return NextResponse.json({ error: 'merchant must be "amazon" or "noon"' }, { status: 400 });
    }
    if (!title_ar || !title_en || !destination_url || !placement || !start_at || !end_at) {
      return NextResponse.json(
        { error: 'title_ar, title_en, destination_url, placement, start_at, end_at are required' },
        { status: 400 },
      );
    }
    if (!PLACEMENTS.includes(placement)) {
      return NextResponse.json({ error: 'invalid placement' }, { status: 400 });
    }
    if (Date.parse(end_at) <= Date.parse(start_at)) {
      return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 });
    }
    const destCheck = validateCampaignDestination(merchant, destination_url);
    if (!destCheck.valid) {
      return NextResponse.json({ error: `destination_url rejected: ${destCheck.reason}` }, { status: 400 });
    }

    const supabase = untypedClient();
    const { data, error } = await supabase
      .from('affiliate_campaigns')
      .insert({
        merchant,
        title_ar,
        title_en,
        cta_ar: cta_ar || undefined,
        cta_en: cta_en || undefined,
        destination_url,
        // Campaign-level Amazon Tracking ID / Noon tag override (final closure round
        // §2/D) — a static, admin-entered, non-personal value. null = provider default.
        tracking_id: typeof tracking_id === 'string' && tracking_id.trim() ? tracking_id.trim() : null,
        categories: Array.isArray(categories) ? categories.filter((c) => typeof c === 'string') : [],
        placement,
        // New campaigns are created PAUSED by default — an admin must explicitly flip
        // `enabled` (a second, deliberate action) before anything can render publicly.
        enabled: false,
        start_at,
        end_at,
        source: source || null,
        is_test: !!is_test,
        disclosure_ar: disclosure_ar || undefined,
        disclosure_en: disclosure_en || undefined,
        created_by: profile.id,
      })
      .select('*')
      .single();
    if (error) throw error;

    await createAuditLog({
      user_id: profile.id,
      action: AUDIT_ACTIONS.AFFILIATE_CAMPAIGN_CREATED,
      entity_type: 'affiliate_campaign',
      entity_id: data.id,
      details: { merchant, placement, title_ar },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
