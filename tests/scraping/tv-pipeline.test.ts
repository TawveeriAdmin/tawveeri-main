/**
 * TV TPS Plugin — identity-contract invariants (TV Identity Contract v1).
 * Pure-logic unit tests (no DB): detection vs accessory/monitor rejection,
 * primary/fallback identity, and the audit-proven precision guards — refresh
 * rate distinguishes sibling models (Q61Q@60Hz ≠ Q71Q@144Hz), panel is an
 * identity axis, and different size/resolution never merge.
 */
import { canonicalizeBrand } from '../../scripts/tps-core/brand-map';
import { tvPlugin, normalize } from '../../scripts/tps-plugins/tv';

const idOf = (en: string, brand: string | null, payload: Record<string, unknown> = {}) => {
  const n = normalize('', en, brand, payload);
  return tvPlugin.buildIdentityKey(brand, n.payload, { model_number: n.model_number });
};

describe('TV detection (accessory + monitor hard-reject)', () => {
  it('detects real TVs (AR + EN)', () => {
    expect(tvPlugin.detect('', 'Samsung 65" Smart TV, 4K Neo QLED')).toBe(true);
    expect(tvPlugin.detect('تلفزيون سامسونج 55 بوصة', '')).toBe(true);
    expect(tvPlugin.detect('', 'LG 65 inch 4K QNED Smart TV')).toBe(true);
  });
  it('rejects TV accessories and monitors', () => {
    expect(tvPlugin.detect('', 'TV Wall Mount Bracket for 65" TV')).toBe(false);
    expect(tvPlugin.detect('', 'Samsung TV Remote Control')).toBe(false);
    expect(tvPlugin.detect('', 'JBL Soundbar for TV')).toBe(false);
    expect(tvPlugin.detect('', 'Samsung 27" Gaming Monitor 4K')).toBe(false);
    expect(tvPlugin.detect('ريموت تلفزيون', '')).toBe(false);
  });
});

describe('TV brand canonicalization (bilingual)', () => {
  it('maps AR/EN TV brands to one canonical form', () => {
    expect(canonicalizeBrand('Samsung')).toBe('samsung');
    expect(canonicalizeBrand('سامسونج')).toBe('samsung');
    expect(canonicalizeBrand('سوني')).toBe('sony');
    expect(canonicalizeBrand('هايسنس')).toBe('hisense');
    expect(canonicalizeBrand('سكاي ورث')).toBe('skyworth');
  });
});

describe('TV fallback identity (precision guards)', () => {
  it('builds a full fallback key brand|size|res|panel|refresh (valid)', () => {
    const r = idOf('Hisense 65" Smart TV, 4K QLED, 144 Hz, Black, Q71Q', 'Hisense');
    expect(r.status).toBe('valid');
    expect(r.key).toBe('hisense|65|4k|qled|144');
  });
  it('REFRESH RATE distinguishes sibling models (Q61Q@60Hz ≠ Q71Q@144Hz)', () => {
    const q61 = idOf('Hisense 65" Smart TV, 4K QLED, 60 Hz, Black, Q61Q', 'Hisense').key;
    const q71 = idOf('Hisense 65" Smart TV, 4K QLED, 144 Hz, Black, Q71Q', 'Hisense').key;
    expect(q61).not.toBe(q71);
  });
  it('PANEL is an identity axis (OLED ≠ QLED ≠ Neo QLED)', () => {
    const oled = idOf('Samsung 65" 4K OLED 120 Hz', 'Samsung').key;
    const qled = idOf('Samsung 65" 4K QLED 120 Hz', 'Samsung').key;
    const neo = idOf('Samsung 65" 4K Neo QLED 120 Hz', 'Samsung').key;
    expect(new Set([oled, qled, neo]).size).toBe(3);
  });
  it('different SIZE and RESOLUTION never merge', () => {
    const a = idOf('LG 55" 4K QNED 120 Hz', 'LG').key;
    const b = idOf('LG 65" 4K QNED 120 Hz', 'LG').key;
    const c = idOf('LG 65" 8K QNED 120 Hz', 'LG').key;
    expect(new Set([a, b, c]).size).toBe(3);
  });
  it('missing refresh → low_confidence (NO_HZ), not a valid corroboration', () => {
    const r = idOf('Samsung 65" 4K Neo QLED Smart TV', 'Samsung');
    expect(r.status).toBe('low_confidence_candidate');
    expect(r.key).toContain('NO_HZ');
  });
  it('invalid when size missing, or neither resolution nor panel present', () => {
    expect(idOf('Samsung Smart TV 4K QLED 120 Hz', 'Samsung').status).toBe('invalid'); // no size
    expect(idOf('Samsung 65" Smart TV', 'Samsung').status).toBe('invalid'); // no res, no panel
    expect(idOf('65" 4K QLED 120 Hz TV', null).status).toBe('invalid'); // no brand
  });
});

describe('TV primary identity (manufacturer model)', () => {
  it('accepts a manufacturer model; rejects Amazon ASIN', () => {
    const good = idOf('Samsung 65 Inch Neo QLED TV, 4K', 'Samsung', { model: 'QN65QN90D' });
    expect(good.key).toBe('samsung|MODEL:QN65QN90D');
    const asin = idOf('Samsung 65 Inch Neo QLED TV, 4K, 120 Hz', 'Samsung', { model: 'B0DXYZ1234' });
    expect(asin.key).not.toContain('MODEL:');
  });
});

describe('TV category isolation', () => {
  it('plugin declares the tv category and a version', () => {
    expect(tvPlugin.category).toBe('tv');
    expect(tvPlugin.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
