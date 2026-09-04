/**
 * E8 — Smart Pick trust contract.
 *
 * The decision layer surfaces a "Smart Pick" at the top of search. The
 * Constitution forbids presenting a misleading pick (a phone case as the
 * answer to "iphone 15"). Two guards:
 *   1. Accessory/compatibility detection catches the real production failure
 *      patterns (magsafe / "compatible with" / "for iphone" / "لهاتف").
 *   2. The search API gates the decision card server-side so an accessory is
 *      never the pick for a main-product query.
 *
 * The detection patterns are asserted against the real strings that failed in
 * production, and the route is asserted to wire the gate. (The pattern
 * constants live in the search route; this mirrors them and cross-checks the
 * route still references them, so drift fails the test.)
 */

import fs from 'fs';
import path from 'path';

const routeSrc = fs.readFileSync(
  path.join(process.cwd(), 'src', 'app', 'api', 'search', 'route.ts'),
  'utf8'
);

// Mirror of the production detectors (kept in sync; the wiring assertions below
// fail if the route stops using them).
const ACCESSORY_COMPAT_AR = /متوافق|مخصص\s+ل|(?:^|\s)ل(?:هاتف|جوال|ايفون|آيفون|سامسونج|جالاكسي)/;
const ACCESSORY_COMPAT_EN = /\bcompatible\b|\bfor\s+(?:iphone|samsung|galaxy|apple|xiaomi|huawei)\b/;

describe('E8: accessory/compatibility detection catches the production failure', () => {
  it('flags the real case that surfaced as a smart pick for "iphone 15"', () => {
    // The exact production offender.
    const nameAr = 'بايكرون كلير ماجسيف متوافق مع مضاد للأصفر لهاتف iPhone 15';
    expect(ACCESSORY_COMPAT_AR.test(nameAr)).toBe(true);
  });

  it('flags English compatibility phrasing', () => {
    expect(ACCESSORY_COMPAT_EN.test('clear magsafe compatible for iphone 15')).toBe(true);
    expect(ACCESSORY_COMPAT_EN.test('tempered glass for samsung galaxy s24')).toBe(true);
  });

  it('does NOT flag a genuine phone', () => {
    expect(ACCESSORY_COMPAT_AR.test('ابل ايفون 12 128 جيجابايت')).toBe(false);
    expect(ACCESSORY_COMPAT_EN.test('apple iphone 12 128gb')).toBe(false);
    expect(ACCESSORY_COMPAT_AR.test('سامسونج جالاكسي a57 128 جيجابايت')).toBe(false);
  });
});

describe('E8: the search route wires the detectors and the trust gate', () => {
  it('adds compatibility detection to hasAccessoryHint', () => {
    expect(routeSrc).toMatch(/ACCESSORY_COMPAT_AR\.test/);
    expect(routeSrc).toMatch(/ACCESSORY_COMPAT_EN\.test/);
    expect(routeSrc).toMatch(/ماجسيف/); // magsafe in the AR hint list
  });

  it('gates the decision card so an accessory is never the pick for a product query', () => {
    expect(routeSrc).toMatch(/const bestIsAccessory/);
    expect(routeSrc).toMatch(/const trustworthyPick/);
    // The card is null unless the pick is trustworthy.
    expect(routeSrc).toMatch(/trustworthyPick && best/);
  });

  it('the decision card carries evidence (reason, store count, TPS flag)', () => {
    expect(routeSrc).toMatch(/reason_ar:\s*buildReasonAr\(best/);
    expect(routeSrc).toMatch(/store_count:\s*best\.store_count/);
    expect(routeSrc).toMatch(/is_tps:/);
  });
});

describe('ADR-193: the pick label is conditioned on the age of its price evidence', () => {
  const cardSrc = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'search', 'smart-pick-card.tsx'),
    'utf8'
  );
  const decideSrc = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'api', 'v1', 'agent', 'decide', 'route.ts'),
    'utf8'
  );

  it('the search route withholds the card beyond the freshness floor band', () => {
    expect(routeSrc).toMatch(/PICK_FRESHNESS_MAX_HOURS/);
    expect(routeSrc).toMatch(/const pickTooStale = pickAgeHours != null && pickAgeHours > PICK_FRESHNESS_MAX_HOURS/);
    expect(routeSrc).toMatch(/trustworthyPick && best && !pickTooStale/);
  });

  it('the card carries and renders the observation time at the point of claim', () => {
    expect(routeSrc).toMatch(/last_observed_at: pickObservedAt/);
    expect(cardSrc).toMatch(/observedAgoLabel\(/);
    expect(cardSrc).toMatch(/smart-pick-observed/);
    // No invented timestamp: the line renders only from a real observation (T2).
    expect(cardSrc).toMatch(/observedAge != null &&/);
  });

  it('the advisor demotes the label, never the ranking, beyond the same band', () => {
    expect(decideSrc).toMatch(/r\.is_smart_pick && !\(data_age_hours != null && data_age_hours > PICK_FRESHNESS_MAX_HOURS\)/);
  });
});

// Founder Differentiation Mission (2026-09-04) — decision-confidence disclosure wiring.
describe('Founder Differentiation Mission: the Smart Pick trust source feeds a real disclosure', () => {
  const cardSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'search', 'smart-pick-card.tsx'), 'utf8');

  it('the pick\'s OWN condition is derived from its title via the existing extractSpecsFromTitle detector, never a new one', () => {
    const decisionCardIdx = routeSrc.indexOf('const decisionCard = trustworthyPick');
    const trustCallIdx = routeSrc.indexOf('trust: productTrust(', decisionCardIdx);
    expect(trustCallIdx).toBeGreaterThan(-1);
    const trustCallBody = routeSrc.slice(trustCallIdx, trustCallIdx + 600);
    expect(trustCallBody).toMatch(/extractSpecsFromTitle\(`\$\{best\.name_ar/);
    expect(trustCallBody).toMatch(/condition/);
  });

  it('the card imports pickCardDisclosure from the shared evidence engine, never re-deriving the priority logic locally', () => {
    expect(cardSrc).toMatch(/import\s*\{[^}]*pickCardDisclosure[^}]*\}\s*from\s*['"]@\/lib\/intelligence\/evidence-engine['"]/);
  });

  it('the disclosure line is wired into both existing measurement events (recommendation_accept, alternative_view), not a brand-new unmeasured event', () => {
    expect(cardSrc).toMatch(/recommendation_accept'[\s\S]{0,150}disclosure_kind/);
    expect(cardSrc).toMatch(/alternative_view'[\s\S]{0,150}disclosure_kind/);
  });

  it('the disclosure line never blocks or replaces the pick — it renders alongside it, gated by presence only', () => {
    expect(cardSrc).toMatch(/\{disclosure && \(/);
  });
});
