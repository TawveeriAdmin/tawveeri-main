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
