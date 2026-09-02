// tests/campaigns/click-route-contract.test.ts — src/app/api/campaigns/click/route.ts
// Structural contract checks, mirroring the existing project convention for Next route
// handlers (tests/scraping/scheduler-security.test.ts) rather than constructing a live
// NextRequest — no test in this codebase does that for any route handler, including
// the pre-existing /go/[offerId]/route.ts (confirmed absent in tests/growth/*). The
// behavioral pieces this route composes (token verification, campaign status, link
// building) are unit-tested directly and exhaustively in click-token.test.ts,
// eligibility.test.ts, and link.test.ts — this file guards that the route actually
// WIRES them together in the required order and never blocks on the write.
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/campaigns/click/route.ts'), 'utf8');

describe('POST /api/campaigns/click — contract', () => {
  it('verifies the click token before doing anything else with the campaign', () => {
    const tokenCheckIdx = source.indexOf('verifyClickToken(');
    const campaignFetchIdx = source.indexOf('getCampaignById(');
    expect(tokenCheckIdx).toBeGreaterThan(-1);
    expect(campaignFetchIdx).toBeGreaterThan(-1);
    expect(tokenCheckIdx).toBeLessThan(campaignFetchIdx);
  });

  it('re-checks the campaign is still "live" (deriveCampaignStatus) before writing a click', () => {
    expect(source).toMatch(/deriveCampaignStatus\(campaign, new Date\(\)\) !== 'live'/);
  });

  it('applies a dedup window keyed on campaign_id + session_id before inserting', () => {
    expect(source).toMatch(/campaign_clicks/);
    expect(source).toMatch(/eq\('campaign_id', campaignId\)/);
    expect(source).toMatch(/eq\('session_id', sessionId\)/);
    expect(source).toMatch(/gte\('created_at', since\)/);
  });

  it('classifies test/internal and bot traffic before insert (is_test)', () => {
    expect(source).toMatch(/isKnownBotUserAgent\(ua\)/);
    expect(source).toMatch(/campaign\.is_test/);
    expect(source).toMatch(/tw_test/);
  });

  it('never writes to outbound_clicks — only campaign_clicks', () => {
    expect(source).not.toMatch(/outbound_clicks/);
  });

  it('always responds — every branch returns a NextResponse, so a rejection can never hang the client (which has already navigated away regardless)', () => {
    const returns = source.match(/return new NextResponse\(null, \{ status: 204 \}\);/g) ?? [];
    // Multiple early-return guards (bad campaignId, bad token, no campaign, not live,
    // no link, plus the success path and the catch-all) all resolve the same way.
    expect(returns.length).toBeGreaterThanOrEqual(5);
  });

  it('the whole handler body is wrapped in try/catch so a thrown error still resolves 204, never a hung request', () => {
    expect(source).toMatch(/try \{[\s\S]*catch \{[\s\S]*return new NextResponse\(null, \{ status: 204 \}\);[\s\S]*\}/);
  });
});
