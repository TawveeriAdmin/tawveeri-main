// tests/campaigns/decision-layer-wiring.test.ts
// Amazon Decision Layer V2.1 §3/§17 — structural contract for the wiring that makes
// resolveAmazonDestination() part of the real serving path (src/lib/campaigns/store.ts)
// and the evidence lookup that feeds it (src/lib/campaigns/amazon-evidence.ts). Same
// structural-contract convention as click-route-contract.test.ts /
// exposure-logging-contract.test.ts — these functions need a live Supabase client, which
// no test in this codebase mocks end-to-end.
import fs from 'fs';
import path from 'path';

const storeSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/campaigns/store.ts'), 'utf8');
const evidenceSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/campaigns/amazon-evidence.ts'), 'utf8');
const eligibleRouteSource = fs.readFileSync(path.join(process.cwd(), 'src/app/api/campaigns/eligible/route.ts'), 'utf8');

describe('getEligibleCampaigns — amazon routing wiring', () => {
  const fnStart = storeSource.indexOf('export async function getEligibleCampaigns');
  const fnBody = storeSource.slice(fnStart, storeSource.indexOf('\nexport async function getCampaignById', fnStart));

  it('only routes through resolveAmazonDestination for merchant === "amazon"', () => {
    expect(fnBody).toMatch(/c\.merchant === 'amazon' && category/);
  });

  it('every safety flag passed to resolveAmazonDestination is an explicit, documented boolean — never left undefined/truthy by accident', () => {
    const callIdx = fnBody.indexOf('resolveAmazonDestination({');
    expect(callIdx).toBeGreaterThan(-1);
    const callBody = fnBody.slice(callIdx, fnBody.indexOf('});', callIdx));
    for (const flag of ['accessoryLeakageRisk: false', 'conditionMismatch: false', 'storageOrModelMismatch: false', 'openQualityIncident: false']) {
      expect(callBody).toContain(flag);
    }
  });

  it('out-of-stock offers are never passed through as an exact_product candidate', () => {
    expect(fnBody).toMatch(/amazonEvidence\.inStock \? amazonEvidence\.amazonProductUrl : null/);
  });

  it('the identity-confidence proxy is gated on the SAME threshold constant the resolver enforces, not a re-invented number', () => {
    expect(storeSource).toMatch(/EXACT_IDENTITY_CONFIDENCE_THRESHOLD/);
  });

  it('a resolver decision of "unavailable" is dropped, never rendered with a null/broken destination', () => {
    expect(fnBody).toMatch(/decision\.mode === 'unavailable' \|\| !decision\.destination\) continue/);
  });

  it('the final campaign object carries the real resolved mode/canonicalProductId/reasonCode, not a hardcoded value', () => {
    const decisionIdx = fnBody.indexOf('resolveAmazonDestination(');
    const pushIdx = fnBody.indexOf('destinationMode: decision.mode', decisionIdx);
    expect(pushIdx).toBeGreaterThan(decisionIdx);
    expect(fnBody.slice(pushIdx, pushIdx + 150)).toMatch(/canonicalProductId: decision\.canonicalProductId/);
    expect(fnBody.slice(pushIdx, pushIdx + 150)).toMatch(/reasonCode: decision\.reasonCode/);
  });

  it('exposure logging is stamped with the real decision mode/reasonCode, not the string literal "category" unconditionally', () => {
    expect(fnBody).toMatch(/logExposure\(c, placement, category, ctx, decision\.mode, decision\.reasonCode\)/);
  });

  it('a non-amazon (Noon) campaign never calls resolveAmazonDestination or the Amazon evidence lookup', () => {
    // The non-amazon fallback branch is textually AFTER the amazon-only branch's `continue`,
    // so it never falls through into the amazon-specific resolver call.
    const nonAmazonComment = fnBody.indexOf('Non-amazon (Noon) or no category context');
    const resolverCallIdx = fnBody.indexOf('resolveAmazonDestination(');
    expect(nonAmazonComment).toBeGreaterThan(resolverCallIdx);
  });

  it('claim-guard still runs before ANY campaign (amazon or not) can be pushed', () => {
    const claimIdx = fnBody.indexOf('checkClaimGuard(');
    const amazonBranchIdx = fnBody.indexOf("c.merchant === 'amazon' && category");
    expect(claimIdx).toBeGreaterThan(-1);
    expect(claimIdx).toBeLessThan(amazonBranchIdx);
  });
});

describe('amazon-evidence.ts — trust boundary', () => {
  it('validates productId as a UUID shape before ever querying', () => {
    expect(evidenceSource).toMatch(/if \(!productId \|\| !\/\^\[0-9a-f-\]\{36\}\$\/i\.test\(productId\)\) return EMPTY_EVIDENCE/);
  });

  it('reads product_stores (current state), never queries price_history (SEV-1 hot-path rule)', () => {
    expect(evidenceSource).toMatch(/\.from\('product_stores'\)/);
    expect(evidenceSource).not.toMatch(/\.from\('price_history'\)/);
  });

  it('Amazon is matched by the established store_id, never a guessed slug/name match', () => {
    expect(evidenceSource).toMatch(/AMAZON_STORE_ID = '2'/);
  });

  it('never throws — wrapped in try/catch, degrading to EMPTY_EVIDENCE', () => {
    const fnStart = evidenceSource.indexOf('export async function getAmazonExactProductEvidence');
    const fnBody = evidenceSource.slice(fnStart);
    expect(fnBody).toMatch(/try \{/);
    expect(fnBody).toMatch(/catch \{\s*return EMPTY_EVIDENCE;\s*\}/);
  });
});

describe('GET /api/campaigns/eligible — evidence trust boundary', () => {
  it('validates productId as a UUID before passing it through — never an arbitrary client string', () => {
    const idx = eligibleRouteSource.indexOf('const productId =');
    expect(idx).toBeGreaterThan(-1);
    expect(eligibleRouteSource.slice(idx, idx + 100)).toMatch(/UUID_RE\.test/);
  });

  it('caps queryText length before it ever reaches sanitizeModelSearchTerm downstream', () => {
    expect(eligibleRouteSource).toMatch(/\.slice\(0, 200\)/);
  });
});
