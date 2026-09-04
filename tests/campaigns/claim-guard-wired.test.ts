// tests/campaigns/claim-guard-wired.test.ts — src/lib/campaigns/store.ts
// Proves checkClaimGuard is actually called on the REAL runtime path that produces campaign
// card copy (getEligibleCampaigns, the one function the homepage and post-search surfaces
// call), not just exercised by claim-guard's own unit tests. Same structural-contract
// convention as tests/campaigns/exposure-logging-contract.test.ts, rather than mocking a
// live Supabase client end-to-end.
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/campaigns/store.ts'), 'utf8');

describe('claim guard — runtime wiring contract', () => {
  it('store.ts imports checkClaimGuard from claim-guard.ts', () => {
    expect(source).toMatch(/import\s*\{\s*checkClaimGuard\s*\}\s*from\s*['"]\.\/claim-guard['"]/);
  });

  it('getEligibleCampaigns calls checkClaimGuard before a campaign is ever pushed to the returned/rendered list', () => {
    const fnStart = source.indexOf('export async function getEligibleCampaigns');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf('\nexport async function getCampaignById', fnStart));
    const claimCheckIdx = fnBody.indexOf('checkClaimGuard(');
    const pushIdx = fnBody.indexOf('withLinks.push(');
    expect(claimCheckIdx).toBeGreaterThan(-1);
    expect(pushIdx).toBeGreaterThan(-1);
    expect(claimCheckIdx).toBeLessThan(pushIdx); // the check runs BEFORE the campaign can be served
  });

  it('a non-compliant campaign is dropped (continue), never pushed to the served list', () => {
    const fnStart = source.indexOf('export async function getEligibleCampaigns');
    const fnBody = source.slice(fnStart, source.indexOf('\nexport async function getCampaignById', fnStart));
    const claimCheckIdx = fnBody.indexOf('checkClaimGuard(');
    const nearby = fnBody.slice(claimCheckIdx, claimCheckIdx + 400);
    expect(nearby).toMatch(/compliant/);
    expect(nearby).toMatch(/continue/);
  });

  it('claim guard is checked against ALL customer-visible copy fields (both locales, title and CTA)', () => {
    const fnStart = source.indexOf('export async function getEligibleCampaigns');
    const fnBody = source.slice(fnStart, source.indexOf('\nexport async function getCampaignById', fnStart));
    const callLine = fnBody.slice(fnBody.indexOf('checkClaimGuard('), fnBody.indexOf('checkClaimGuard(') + 120);
    for (const field of ['title_ar', 'title_en', 'cta_ar', 'cta_en']) {
      expect(callLine).toMatch(new RegExp(`c\\.${field}`));
    }
  });

  it('the guard defaults to hasFreshOfferEvidence=false — no schema field exists yet to claim otherwise, so nothing is assumed verified', () => {
    const fnStart = source.indexOf('export async function getEligibleCampaigns');
    const fnBody = source.slice(fnStart, source.indexOf('\nexport async function getCampaignById', fnStart));
    const callLine = fnBody.slice(fnBody.indexOf('checkClaimGuard('), fnBody.indexOf('checkClaimGuard(') + 120);
    expect(callLine).toMatch(/,\s*false\s*\)/);
  });
});
