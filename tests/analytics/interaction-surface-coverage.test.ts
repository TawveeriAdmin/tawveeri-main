// tests/analytics/interaction-surface-coverage.test.ts — ADR-286 regression gate.
// Lightweight guard against accidental removal: every surface wired into the explicit-
// interaction contract this session must keep importing and calling recordFirstPartyInteraction.
// Not a behavioral test (that's interaction.test.ts / decision-grade-queries.test.ts) — a
// tripwire so a future edit that strips the call out of one of these files fails CI instead of
// silently reintroducing an unmeasured surface.
import fs from 'fs';
import path from 'path';

function read(p: string): string {
  return fs.readFileSync(path.join(process.cwd(), p), 'utf8');
}

function usesContract(file: string) {
  const src = read(file);
  expect(src).toMatch(/from ['"]@\/lib\/analytics\/interaction['"]/);
  expect(src).toMatch(/recordFirstPartyInteraction\(/);
}

describe('/go-routed surfaces — full contract (token + interaction_id + navigation)', () => {
  it('advisor recommendation exit', () => usesContract('src/components/agent/advisor-answer.tsx'));
  it('product detail page', () => usesContract('src/app/[locale]/(product)/products/[slug]/product-detail-client.tsx'));
  it('checkout', () => usesContract('src/app/[locale]/(public)/checkout/page.tsx'));
  it('Home Mission (all 3 CTAs share one onGoExit handler)', () => usesContract('src/app/[locale]/home-mission/home-mission-client.tsx'));
  it('compare page — offer exit links', () => usesContract('src/components/catalog/exit-link.tsx'));
  it('category-attributed compare exit', () => usesContract('src/components/catalog/category-exit-link.tsx'));
  it('homepage verified deals rail', () => usesContract('src/components/public/unified-home.tsx'));
});

describe('direct-merchant surfaces — Option A (interaction evidence only, no /go correlation)', () => {
  it('search result card, external offer', () => usesContract('src/components/products/product-card.tsx'));
  it('comparison panel store link', () => usesContract('src/components/search/store-comparison-panel.tsx'));
  it('Smart Pick CTA', () => usesContract('src/components/search/smart-pick-card.tsx'));
  it('closest-options fallback', () => usesContract('src/components/search/closest-options.tsx'));
  it('product detail sheet (modal)', () => usesContract('src/components/products/product-detail-sheet.tsx'));
  it('compare list page', () => usesContract('src/app/[locale]/(public)/compare/page.tsx'));
});

describe('deliberately-excluded surfaces — confirm they stay out of this contract for a stated reason', () => {
  it('Campaign V1 uses its OWN token+POST contract (click-token.ts, campaign_clicks) — must never import the general interaction module', () => {
    const src = read('src/components/campaigns/campaign-card.tsx');
    expect(src).not.toMatch(/from ['"]@\/lib\/analytics\/interaction['"]/);
    expect(src).toMatch(/sendClickBeacon/); // its own, separate mechanism
  });
});

describe('compare[key] page wires the offer-link components rather than a bare <a>', () => {
  it('uses ExitLink for the plain (non-category-attributed) exit path', () => {
    const src = read('src/app/[locale]/(public)/compare/[key]/page.tsx');
    expect(src).toMatch(/from ['"]@\/components\/catalog\/exit-link['"]/);
    expect(src).toMatch(/<ExitLink/);
  });
});
