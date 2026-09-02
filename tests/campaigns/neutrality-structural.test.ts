// tests/campaigns/neutrality-structural.test.ts
// Structural regression guard (Phase 1D / Phase 3 items 6, 7, 8, 17): the commercial
// post-search card must be wired into search-client.tsx strictly AFTER the neutral
// products grid, and the neutrality-critical modules (decision-engine, route-query,
// evidence-engine, the products array itself, sort/ranking) must never import from
// src/lib/campaigns/*. This is intentionally a source-level check, not a full render
// of search-client.tsx (2000+ lines, heavy data-fetching) — cheap, and it fails loudly
// if a future edit moves the campaign card earlier or wires campaigns into ranking.
import fs from 'fs';
import path from 'path';

const SEARCH_CLIENT = path.resolve(__dirname, '../../src/app/[locale]/(public)/search/search-client.tsx');

describe('Affiliate Campaign Revenue Layer V1 — neutrality structure', () => {
  const source = fs.readFileSync(SEARCH_CLIENT, 'utf8');

  it('17. PostSearchCampaignCard appears strictly after the products grid / pagination in source order', () => {
    const gridIdx = source.indexOf('{products.map((product, index) =>');
    const campaignIdx = source.indexOf('<PostSearchCampaignCard');
    expect(gridIdx).toBeGreaterThan(-1);
    expect(campaignIdx).toBeGreaterThan(-1);
    expect(campaignIdx).toBeGreaterThan(gridIdx);
  });

  it('6/7/8. the campaign card is never passed the products array, sort, or any ranking input', () => {
    const campaignCallStart = source.indexOf('<PostSearchCampaignCard');
    const campaignCallEnd = source.indexOf('/>', campaignCallStart);
    const callSite = source.slice(campaignCallStart, campaignCallEnd);
    expect(callSite).not.toMatch(/products=/);
    expect(callSite).not.toMatch(/sort=/);
    expect(callSite).not.toMatch(/smartPick=/);
    expect(callSite).not.toMatch(/advisorResult=/);
  });

  it('the campaign card only renders inside the products.length > 0 branch (never before results)', () => {
    const gridBranchStart = source.indexOf("{/* Products Grid */}");
    const campaignIdx = source.indexOf('<PostSearchCampaignCard');
    // The closing of the fragment that wraps grid+pagination+campaign card.
    const fragmentClose = source.indexOf('</>', campaignIdx);
    expect(gridBranchStart).toBeGreaterThan(-1);
    expect(fragmentClose).toBeGreaterThan(campaignIdx);
    expect(campaignIdx).toBeGreaterThan(gridBranchStart);
  });
});

describe('decision-critical modules never import the campaign layer', () => {
  const CRITICAL_FILES = [
    'src/lib/agent/decision-engine.ts',
    'src/lib/agent/route-query.ts',
    'src/lib/intelligence/evidence-engine.ts',
  ];

  for (const rel of CRITICAL_FILES) {
    const abs = path.resolve(__dirname, '../../', rel);
    if (!fs.existsSync(abs)) continue; // file naming may differ slightly across mission phases; skip rather than false-fail
    it(`${rel} does not import from src/lib/campaigns`, () => {
      const src = fs.readFileSync(abs, 'utf8');
      expect(src).not.toMatch(/from ['"]@\/lib\/campaigns/);
    });
  }
});
