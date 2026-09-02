// tests/campaigns/exposure-logging-contract.test.ts — src/lib/campaigns/store.ts
// Structural contract for campaign_exposures logging (final program, Phase 2B),
// mirroring the existing project convention (tests/scraping/scheduler-security.test.ts,
// tests/campaigns/click-route-contract.test.ts) rather than mocking a live Supabase
// client end-to-end.
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/campaigns/store.ts'), 'utf8');

describe('campaign_exposures logging contract', () => {
  it('writes to campaign_exposures, never outbound_clicks or usage_events', () => {
    expect(source).toMatch(/campaign_exposures/);
    expect(source).not.toMatch(/outbound_clicks/);
    expect(source).not.toMatch(/usage_events/);
  });

  it('logExposure is fire-and-forget — not awaited inside getEligibleCampaigns', () => {
    const fnStart = source.indexOf('export async function getEligibleCampaigns');
    const fnBody = source.slice(fnStart, source.indexOf('\n}', fnStart));
    expect(fnBody).toMatch(/logExposure\(/);
    expect(fnBody).not.toMatch(/await logExposure\(/);
  });

  it('logExposure never throws into its caller (wrapped in try/catch)', () => {
    const fnStart = source.indexOf('function logExposure');
    const fnBody = source.slice(fnStart, source.indexOf('\n}', fnStart));
    expect(fnBody).toMatch(/try \{/);
    expect(fnBody).toMatch(/catch/);
  });

  it('an exposure is only logged for a campaign that actually survived link resolution (never a broken/unresolvable one)', () => {
    const fnStart = source.indexOf('export async function getEligibleCampaigns');
    const fnBody = source.slice(fnStart, source.indexOf('\n}', fnStart));
    const linkCheckIdx = fnBody.indexOf('if (!link) continue');
    const logIdx = fnBody.indexOf('logExposure(');
    expect(linkCheckIdx).toBeGreaterThan(-1);
    expect(logIdx).toBeGreaterThan(linkCheckIdx);
  });
});
