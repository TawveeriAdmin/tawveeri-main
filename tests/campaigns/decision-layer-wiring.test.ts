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

  it('Noon Wave 1: a Noon campaign only reaches the resolver behind its own explicit, independent flag (never unconditionally, never coupled to Amazon\'s gate)', () => {
    // Noon Wave 1 (2026-09-05) — the exact_product/model_search resolver is now reused for
    // Noon too, but ONLY behind NOON_EXACT_PRODUCT_ENABLED, checked in the Noon branch's own
    // condition — distinct from the unconditional Amazon branch above it.
    const noonBranchIdx = fnBody.indexOf("c.merchant === 'noon' && category && process.env.NOON_EXACT_PRODUCT_ENABLED === '1'");
    expect(noonBranchIdx).toBeGreaterThan(-1);
  });

  it('the final true fallback (no category, or Noon without its flag) is textually after BOTH the amazon and the noon exact-product branches', () => {
    const fallbackComment = fnBody.indexOf('Non-amazon (Noon, without the exact-product flag) or no category context');
    const amazonResolverCallIdx = fnBody.indexOf('resolveAmazonDestination(');
    const noonResolverCallIdx = fnBody.lastIndexOf('resolveAmazonDestination(');
    expect(fallbackComment).toBeGreaterThan(amazonResolverCallIdx);
    expect(fallbackComment).toBeGreaterThan(noonResolverCallIdx);
  });

  it('the Noon branch has the SAME safety flags/out-of-stock/decision-field wiring as the Amazon branch, not a stripped-down copy', () => {
    const noonBranchIdx = fnBody.indexOf("c.merchant === 'noon' && category && process.env.NOON_EXACT_PRODUCT_ENABLED === '1'");
    const noonBranchBody = fnBody.slice(noonBranchIdx, fnBody.indexOf('Non-amazon (Noon, without the exact-product flag)', noonBranchIdx));
    for (const flag of ['accessoryLeakageRisk: false', 'conditionMismatch: false', 'storageOrModelMismatch: false', 'openQualityIncident: false']) {
      expect(noonBranchBody).toContain(flag);
    }
    expect(noonBranchBody).toMatch(/noonEvidence\.inStock \? noonEvidence\.productUrl : null/);
    expect(noonBranchBody).toMatch(/decision\.mode === 'unavailable' \|\| !decision\.destination\) continue/);
    expect(noonBranchBody).toMatch(/destinationMode: decision\.mode/);
    expect(noonBranchBody).toMatch(/canonicalProductId: decision\.canonicalProductId/);
    expect(noonBranchBody).toMatch(/reasonCode: decision\.reasonCode/);
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

  it('Amazon and Noon are matched by their established store_id constants, never a guessed slug/name match', () => {
    expect(evidenceSource).toMatch(/AMAZON_STORE_ID = '2'/);
    expect(evidenceSource).toMatch(/NOON_STORE_ID = '3'/);
  });

  // Regression (found live in production 2026-09-04): product_stores.store_id comes
  // back as a JS number from PostgREST despite database/types.ts claiming `string` — a
  // bare `r.store_id === storeId` silently matched nothing for every real product,
  // blocking EXACT_PRODUCT entirely with no error. Must always coerce with String(...)
  // before comparing. Noon Wave 1 (2026-09-05) moved this comparison into the shared
  // getExactProductEvidenceForStore() (parametrized by storeId, called by both the
  // Amazon and Noon wrappers) — the coercion rule itself is unchanged, only the constant
  // being compared against is now a parameter instead of the Amazon-only literal.
  it('compares store_id with String(...) coercion, never a bare strict-equals that assumes a JS type', () => {
    expect(evidenceSource).toMatch(/String\(r\.store_id\) === storeId/);
    expect(evidenceSource).not.toMatch(/r\.store_id === storeId(?!\))/); // no bare (uncoerced) comparison anywhere
  });

  it('never throws — wrapped in try/catch, degrading to EMPTY_EVIDENCE (shared getExactProductEvidenceForStore, used by both merchant wrappers)', () => {
    const fnStart = evidenceSource.indexOf('export async function getExactProductEvidenceForStore');
    const fnEnd = evidenceSource.indexOf('\nexport async function getAmazonExactProductEvidence', fnStart);
    const fnBody = evidenceSource.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/try \{/);
    expect(fnBody).toMatch(/catch \{\s*return EMPTY_EVIDENCE;\s*\}/);
  });

  it('both merchant wrappers (Amazon, Noon) delegate to the same shared lookup — no duplicated query logic', () => {
    expect(evidenceSource).toMatch(/getExactProductEvidenceForStore\(productId, AMAZON_STORE_ID\)/);
    expect(evidenceSource).toMatch(/getExactProductEvidenceForStore\(productId, NOON_STORE_ID\)/);
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
