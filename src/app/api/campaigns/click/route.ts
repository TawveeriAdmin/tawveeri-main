// src/app/api/campaigns/click/route.ts
// Final closure round §3 — the authoritative campaign_clicks writer under the new
// direct-link architecture. The browser has ALREADY navigated to the merchant via the
// card's own href by the time this fires (navigator.sendBeacon / fetch keepalive from
// the client) — this endpoint is pure measurement and can never block or delay that
// navigation, by construction (there is nothing left for it to gate).
//
// Anti-forgery: requires a token issued alongside a real eligible-campaign response
// (src/lib/campaigns/click-token.ts). This is a bar-raiser, not a security boundary —
// see that file's header for the explicit limitation.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { verifyClickToken } from '@/lib/campaigns/click-token';
import { buildCampaignMerchantUrl } from '@/lib/campaigns/link';
import { getCampaignById } from '@/lib/campaigns/store';
import { deriveCampaignStatus } from '@/lib/campaigns/types';
import { isKnownBotUserAgent } from '@/lib/analytics/bot-detection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function untypedClient() {
  return createServerClient() as unknown as { from: (table: string) => any };
}

function readAttribution(req: NextRequest): { sessionId: string | null; campaign: Record<string, string> | null } {
  const sessionId = req.cookies.get('tw_sid')?.value?.slice(0, 64) || null;
  let campaign: Record<string, string> | null = null;
  try {
    const raw = req.cookies.get('tw_campaign')?.value;
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
      const pick = (k: string, n: number) => (typeof parsed[k] === 'string' ? (parsed[k] as string).slice(0, n) : undefined);
      const c = {
        utm_source: pick('utm_source', 32), utm_medium: pick('utm_medium', 32),
        utm_campaign: pick('utm_campaign', 64), utm_content: pick('utm_content', 64),
      };
      if (c.utm_source) campaign = Object.fromEntries(Object.entries(c).filter(([, v]) => v)) as Record<string, string>;
    }
  } catch { /* malformed cookie → no campaign, never an error */ }
  return { sessionId, campaign };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const campaignId = String(body.campaignId ?? '');
    const token = typeof body.token === 'string' ? body.token : null;
    if (!UUID_RE.test(campaignId)) return new NextResponse(null, { status: 204 });

    const verification = verifyClickToken(campaignId, token);
    if (!verification.valid) {
      console.warn('campaign click rejected: token', verification.reason, campaignId);
      return new NextResponse(null, { status: 204 });
    }

    const campaign = await getCampaignById(campaignId);
    if (!campaign) return new NextResponse(null, { status: 204 });
    // Re-check enabled/window only — category isn't re-verified at click time (a
    // shopper who navigated categories between impression and click is still a real
    // click on the campaign they were shown, not a defect).
    if (deriveCampaignStatus(campaign, new Date()) !== 'live') return new NextResponse(null, { status: 204 });

    const link = buildCampaignMerchantUrl(campaign);
    if (!link) return new NextResponse(null, { status: 204 });

    const ua = req.headers.get('user-agent') ?? '';
    const isTest =
      campaign.is_test ||
      req.cookies.get('tw_test')?.value === '1' ||
      req.cookies.get('tw_admin')?.value === '1' ||
      body.is_test === true ||
      isKnownBotUserAgent(ua);
    const { sessionId, campaign: acquisitionCampaign } = readAttribution(req);

    const placement = typeof body.placement === 'string' ? body.placement.slice(0, 20) : 'campaign';
    const category = typeof body.category === 'string' ? body.category.slice(0, 40) : null;
    const source = typeof body.source === 'string' ? body.source.slice(0, 32) : placement;

    const supabase = untypedClient();

    // Idempotency (best-effort, not a hard uniqueness constraint — a real second click
    // after a genuine pause must still count): suppress a duplicate write for the same
    // campaign+session within a short window, mirroring track.ts's own dedup window.
    if (sessionId) {
      const since = new Date(Date.now() - 5000).toISOString();
      const { data: recent } = await supabase
        .from('campaign_clicks')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('session_id', sessionId)
        .gte('created_at', since)
        .limit(1);
      if (Array.isArray(recent) && recent.length > 0) return new NextResponse(null, { status: 204 });
    }

    const ipAddress = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || null;

    await supabase.from('campaign_clicks').insert({
      campaign_id: campaign.id,
      merchant: campaign.merchant,
      placement,
      category,
      destination_url: link.url,
      affiliate_program: link.program,
      affiliate_tag: link.tag,
      sub_id: null, // never generated in V1 — see src/lib/campaigns/link.ts
      source,
      // Amazon Decision Layer V2 §6 — same fact as campaign_exposures: every click
      // this endpoint can currently receive came from the CATEGORY-mode link the card
      // was built with (getEligibleCampaigns() resolves no other mode yet).
      destination_mode: 'category',
      session_id: sessionId,
      acquisition_campaign: acquisitionCampaign,
      is_test: isTest,
      user_agent: ua || null,
      referrer: req.headers.get('referer') ?? null,
      ip_address: ipAddress,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    // best-effort: measurement must never break the experience, and by this point
    // navigation has already happened independently of this request either way.
    return new NextResponse(null, { status: 204 });
  }
}
