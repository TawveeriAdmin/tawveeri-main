// GET /r/<shortId> — clean tracking link for manual social replies (ADR-247 §27).
// The founder pastes tawveeri.com/r/abc123 in a reply; this 302s to the Arabic
// home with the opportunity's full UTM lineage, which the EXISTING campaign
// capture (ADR-244) then stamps onto the session → searches → the exit ledger.
// No new attribution machinery — this route only translates short → UTM.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  const { shortId } = await params;
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';
  // Unknown/invalid ids still land the visitor somewhere useful.
  const fallback = NextResponse.redirect(`${base}/ar`, 302);
  if (!/^[a-z0-9]{4,12}$/i.test(shortId)) return fallback;

  const sb = createServerClient() as any;
  const { data } = await sb
    .from('demand_opportunities')
    .select('short_id, source, category, is_test')
    .eq('short_id', shortId)
    .maybeSingle();
  if (!data) return fallback;

  const utm = new URLSearchParams({
    utm_source: data.source === 'x' ? 'x' : 'radar_test',
    utm_medium: 'social_reply',
    utm_campaign: 'demand_radar',
    utm_content: `dr-${data.short_id}`,
  });
  if (data.is_test) utm.set('test', '1'); // TEST lineage stays TEST end-to-end
  return NextResponse.redirect(`${base}/ar?${utm}`, 302);
}
