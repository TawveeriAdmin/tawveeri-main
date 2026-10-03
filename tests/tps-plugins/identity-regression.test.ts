// Phase 3B (2026-10-03) — PERMANENT REGRESSION SUITE for product identity.
// Fixture: the Phase-3A ground truth (459 cross-store pairs, reviewer-1 labels adjudicated after
// a blind reviewer-2 pass; docs/evidence/amazon-diagnostic-2026-10-03/phase3a/). With the v2 rules
// ON, the production plugins + verifier must assert ZERO labelled DIFFERENT / FAMILY-DIFFERENT
// pairs as the same purchasable item, and must still recover the named production failures.
// Any future rule change runs against this suite.
import * as fs from 'fs';
import * as path from 'path';

const FIX = path.join(__dirname, '..', 'fixtures', 'identity');
const pairs = JSON.parse(fs.readFileSync(path.join(FIX, 'pairs-2026-10-03.json'), 'utf8')) as any[];
const labels = JSON.parse(fs.readFileSync(path.join(FIX, 'labels-2026-10-03.json'), 'utf8')) as Record<string, string>;

const ORIGINAL_FLAG = process.env.TPS_IDENTITY_V2;
beforeAll(() => { process.env.TPS_IDENTITY_V2 = '1'; });
afterAll(() => { if (ORIGINAL_FLAG === undefined) delete process.env.TPS_IDENTITY_V2; else process.env.TPS_IDENTITY_V2 = ORIGINAL_FLAG; });

// Imports after the flag is set are not required (the flag is read at call time), but keep the
// requires inside the tests so module load order can never mask a flag-off/flag-on difference.
const load = () => ({
  mobile: require('../../scripts/tps-plugins/mobile/parser') as typeof import('../../scripts/tps-plugins/mobile/parser'),
  mobileDetect: require('../../scripts/tps-plugins/mobile/detector') as typeof import('../../scripts/tps-plugins/mobile/detector'),
  mobileId: require('../../scripts/tps-plugins/mobile/identity') as typeof import('../../scripts/tps-plugins/mobile/identity'),
  tvDetect: require('../../scripts/tps-plugins/tv/detector') as typeof import('../../scripts/tps-plugins/tv/detector'),
  verifier: require('../../scripts/tps-core/identity-verifier') as typeof import('../../scripts/tps-core/identity-verifier'),
  brandMap: require('../../scripts/tps-core/brand-map') as typeof import('../../scripts/tps-core/brand-map'),
});

const PLATFORM = new Set(['google', 'apple tv', 'android', 'amazon', 'vision', 'unknown']);
function phoneKey(m: ReturnType<typeof load>, title: string, brand: string | null): { key: string | null; status: string | null; detected: boolean } {
  if (!m.mobileDetect.detect(title, title)) return { key: null, status: null, detected: false };
  let b = brand && brand !== 'Unknown' && brand !== 'null' ? brand : null;
  if (!b) { const t = m.brandMap.detectBrandFromText(title); b = t && !PLATFORM.has(t.toLowerCase()) ? t : null; }
  const n = m.mobile.normalize(title, title, b, {});
  const id = m.mobileId.buildIdentityKey(b, n.payload, { model_number: n.model_number });
  return { key: id.key, status: id.status, detected: true };
}

describe('identity regression — labelled ground truth (v2 rules ON)', () => {
  test('no labelled DIFFERENT or FAMILY-DIFFERENT pair is asserted as the same item', () => {
    const m = load();
    const falseMerges: string[] = [];
    for (const p of pairs) {
      const lab = labels[p.id];
      if (lab !== 'DIFFERENT_PRODUCT' && lab !== 'SAME_PRODUCT_FAMILY_DIFFERENT_VARIANT') continue;
      let sameKey = false;
      if (p.category === 'mobile') {
        const a = phoneKey(m, p.amazon.name, p.amazon.brand), c = phoneKey(m, p.control.name, (p.control.key || '').split('|')[0]);
        sameKey = !!(a.key && c.key && a.status === 'valid' && c.status === 'valid' && a.key === c.key);
      } else sameKey = !!(p.amazon.key && p.control.key && p.amazon.key === p.control.key);
      if (!sameKey) continue;
      const v = m.verifier.verifyPair({ title: p.amazon.name, category: p.category }, { title: p.control.name, category: p.category });
      if (v.outcome === 'match') falseMerges.push(`${p.id} [${lab}] ${p.amazon.name.slice(0, 50)} ↔ ${p.control.name.slice(0, 50)}`);
    }
    expect(falseMerges).toEqual([]);
  });

  test('labelled SAME phone pairs are still recovered at a high rate (recall on the fixture, phones only)', () => {
    const m = load();
    const same = pairs.filter((p) => p.category === 'mobile' && labels[p.id] === 'SAME_EXACT_VARIANT');
    let asserted = 0;
    for (const p of same) {
      const a = phoneKey(m, p.amazon.name, p.amazon.brand), c = phoneKey(m, p.control.name, (p.control.key || '').split('|')[0]);
      if (a.key && c.key && a.status === 'valid' && c.status === 'valid' && a.key === c.key) {
        const v = m.verifier.verifyPair({ title: p.amazon.name, category: 'mobile' }, { title: p.control.name, category: 'mobile' });
        if (v.outcome === 'match') asserted++;
      }
    }
    // Phase-3A/3B measured 153/158 on this fixture; 3 pairs are a known ASIN-row artefact in the
    // harness, not here. Floor set well below the measurement so a genuine regression fails loudly
    // while label adjudication never does.
    expect(asserted / same.length).toBeGreaterThan(0.85);
  });
});

describe('identity regression — named production failures (v2 rules ON)', () => {
  const k = (title: string, brand: string | null) => phoneKey(load(), title, brand).key;
  test('HONOR X7e and X7c are different identities', () => {
    expect(k('HONOR X7e Smartphone, 45W HONOR SuperCharge, 120Hz Display, 50MP AI Camera, 128GB', 'HONOR')).toMatch(/\|7e\|/);
    expect(k('Honor X7c, 5G, 4GB + 256 GB, Forest Green', 'HONOR')).toMatch(/\|7c\|/);
  });
  test('HONOR X9d and X9c are different identities', () => {
    expect(k('HONOR X9d 5G Smartphone, 12GB RAM + 256GB Storage, 108MP OIS Camera', 'HONOR')).toMatch(/\|9d\|/);
    expect(k('HONOR X9c, 5G, 256GB, Sunrise Orange', 'HONOR')).toMatch(/\|9c\|/);
  });
  test('HONOR 600 Lite is generation 600, not 60', () => {
    expect(k('HONOR 600 Lite 5G Smartphone, 8GB RAM + 128GB Storage, 6.6” 120Hz AMOLED', 'HONOR')).toBe('honor|Honor|600|Lite|128');
  });
  test('Redmi Note 15C and Redmi Note 15 are different identities', () => {
    expect(k('Xiaomi Redmi Note 15C 5G Smartphone 8+256GB,Dusk Purple', 'Xiaomi')).toMatch(/\|15c\|/);
    expect(k('Xiaomi Redmi Note 15, 256GB, 12GB, 5G, Dual SIM', 'Xiaomi')).toMatch(/\|15\|/);
  });
  test('S26+ is the Plus variant; S26 is Standard', () => {
    expect(k('Samsung Galaxy S26+, 256GB, 12GB RAM, 5G, Dual SIM - Cobalt Violet', 'Samsung')).toBe('samsung|Galaxy S|S26|Plus|256');
    expect(k('Samsung Galaxy S26 Cobalt Violet, 256GB Storage, AI Phone, 12GB RAM', 'Samsung')).toBe('samsung|Galaxy S|S26|Standard|256');
  });
  test('"8+256GB" is never read as a Plus variant', () => {
    expect(k('Samsung Galaxy A26, 5G, 8+256 GB, White', 'Samsung')).toBe('samsung|Galaxy A|A26|Standard|256');
  });
  test('"128GB Expandable to 2TB" is 128 GB storage', () => {
    expect(k('Samsung Galaxy A17 LTE, Dual SIM, 128GB Expandable to 2TB, Smartphone, Android 14, 4GB RAM', 'Samsung')).toBe('samsung|Galaxy A|A17|Standard|128');
  });
  test('Arabic بلص is the Plus variant', () => {
    expect(k('هونر X5c بلص، 128 جيجابايت، 4 جيجابايت رام، 4G، شريحتين اتصال', 'HONOR')).toBe('honor|Honor X|5c|Plus|128');
  });
  test('a knock-off never inherits a brand from a bare model pattern (invens ULTRA S25)', () => {
    const r = phoneKey(load(), 'invens ULTRA S25 Android 16 Unlocked Smartphone, 4GB+64GB/1TB, 6.79" Display, 8MP+16MP Camera', 'Unknown');
    expect(r.key).toBeNull();
  });
  test('phone feature vocabulary does not reject a phone (camera / AMOLED / standby)', () => {
    const d = load().mobileDetect.detect;
    expect(d('Samsung Galaxy S25 Ultra AI Phone, 512GB Storage, 12GB RAM, Titanium Black, Android Smartphone, 200MP Camera', 'Samsung Galaxy S25 Ultra AI Phone, 512GB Storage, 12GB RAM, Titanium Black, Android Smartphone, 200MP Camera')).toBe(true);
    expect(d('Samsung Galaxy A17 5G Smartphone | 6.7" Super AMOLED 90Hz Display | 50MP OIS Triple Camera', 'Samsung Galaxy A17 5G Smartphone | 6.7" Super AMOLED 90Hz Display | 50MP OIS Triple Camera')).toBe(true);
  });
  test('wearables and trackers with a generation digit glued to the token are rejected (shadow 2026-10-03: Watch8 / Fit3 / SmartTag2)', () => {
    const d = load().mobileDetect.detect;
    for (const t of ['Galaxy Watch8 (Bluetooth 40 mm) Graphite (SM-L320NDAAMEA)', 'Galaxy Fit3 Gray (SM-R390NZAAMEA)', 'Galaxy SmartTag2 Black (EI-T5600BBEGWW)', 'Galaxy Watch9 (Bluetooth 44 mm) Silver (SM-L350NZSAMEA)', 'Samsung Galaxy Buds3 Pro Silver']) expect([t, d(t, t)]).toEqual([t, false]);
  });
  test('accessories and foreign categories are still rejected', () => {
    const d = load().mobileDetect.detect;
    expect(d('UGREEN 2 Pack for iPhone 15 Pro Max Screen Protector Tempered Glass', 'UGREEN 2 Pack for iPhone 15 Pro Max Screen Protector Tempered Glass')).toBe(false);
    expect(d('Samsung Galaxy Tab S9 5G, 8GB RAM, 128GB Storage, Graphite', 'Samsung Galaxy Tab S9 5G, 8GB RAM, 128GB Storage, Graphite')).toBe(false);
    expect(d('Canon EOS R100 Mirrorless Camera with 18-45mm lens', 'Canon EOS R100 Mirrorless Camera with 18-45mm lens')).toBe(false);
  });
  test('Samsung 43 Inch FHD TV, F6000F is a TV', () => {
    const d = load().tvDetect.detect;
    expect(d('Samsung 43 Inch FHD TV, F6000F, Free contents by Samsung TV Plus, Secured by Knox, HDR, OTS Lite, UA43F6000FUXZN', 'Samsung 43 Inch FHD TV, F6000F, Free contents by Samsung TV Plus, Secured by Knox, HDR, OTS Lite, UA43F6000FUXZN')).toBe(true);
    expect(d('Samsung 24" Odyssey G3 Gaming Monitor, FHD (1920 x 1080), 180Hz', 'Samsung 24" Odyssey G3 Gaming Monitor, FHD (1920 x 1080), 180Hz')).toBe(false);
  });
});
