/**
 * Tablet TPS Plugin — identity-contract invariants (Tablet Identity Contract v1).
 * Pure-logic unit tests (no DB): detection with bundle nuance, accessory/phone
 * rejection, and the audit-proven precision guards — A11 ≠ A11 Plus, Wi-Fi ≠
 * cellular, base ≠ Kids, storage/generation/line separation, ASIN rejection.
 */
import { canonicalizeBrand } from '../../scripts/tps-core/brand-map';
import { tabletPlugin, normalize } from '../../scripts/tps-plugins/tablet';

const idOf = (en: string, brand: string | null, payload: Record<string, unknown> = {}) => {
  const n = normalize('', en, brand, payload);
  return tabletPlugin.buildIdentityKey(brand, n.payload, { model_number: n.model_number });
};

describe('Tablet detection (accessory nuance + wrong-device reject)', () => {
  it('detects real tablets, incl. bundled with case/pen (has storage)', () => {
    expect(tabletPlugin.detect('', 'Apple iPad Air 11 M4 128 GB Wi-Fi')).toBe(true);
    expect(tabletPlugin.detect('', 'Lenovo Idea Tab Tablet - Wi-Fi with Folio Case and Pen, 11", 128 GB')).toBe(true);
    expect(tabletPlugin.detect('تابلت سامسونج جالكسي تاب A11 128 جيجا', '')).toBe(true);
  });
  it('rejects tablet accessories and wrong devices', () => {
    expect(tabletPlugin.detect('', 'Promate Laptop/Tablet Shoulder Bag')).toBe(false);
    expect(tabletPlugin.detect('', 'Folio Case Cover for iPad Air')).toBe(false);
    expect(tabletPlugin.detect('', 'Apple Pencil Pro for iPad')).toBe(false);
    expect(tabletPlugin.detect('', 'Samsung Galaxy Tab S9 Keyboard Cover')).toBe(false);
    expect(tabletPlugin.detect('', 'Samsung Galaxy S24 Smartphone 256GB')).toBe(false);
  });
});

describe('Tablet brand canonicalization', () => {
  it('maps AR/EN tablet brands; iPad implies Apple', () => {
    expect(canonicalizeBrand('لينوفو')).toBe('lenovo');
    const r = idOf('iPad Air 11 M4 256 GB Wi-Fi', null); // no brand token, iPad ⇒ apple
    expect(r.key?.startsWith('apple|')).toBe(true);
  });
});

describe('Tablet fallback identity (precision guards)', () => {
  it('builds a full fallback key brand|line|gen|storage|connectivity|size', () => {
    const r = idOf('Apple iPad Air 11 M4 Tablet - Wi-Fi, 128 GB', 'Apple');
    expect(r.status).toBe('valid');
    expect(r.key).toBe('apple|ipad air|m4|128|wifi|11');
  });
  it('A11 (base) ≠ A11 Plus never merge', () => {
    const a11 = idOf('Samsung Galaxy Tab A11, WiFi, 8.7 Inch, 128GB', 'Samsung').key;
    const a11p = idOf('Samsung Galaxy Tab A11 Plus, WiFi, 11 Inch, 128GB', 'Samsung').key;
    expect(a11).not.toBe(a11p);
    expect(a11p).toContain('a11 plus');
  });
  it('Wi-Fi ≠ cellular/4G/5G never merge', () => {
    const wifi = idOf('Samsung Galaxy Tab A11, WiFi, 8.7 Inch, 64GB', 'Samsung').key;
    const lte = idOf('Samsung Galaxy Tab A11, 4G, 8.7 Inch, 64GB', 'Samsung').key;
    const g5 = idOf('Samsung Galaxy Tab A11, 5G, 8.7 Inch, 64GB', 'Samsung').key;
    expect(new Set([wifi, lte, g5]).size).toBe(3);
  });
  it('base ≠ Kids Edition, and different storage never merge', () => {
    const base = idOf('Huawei MatePad SE 11, Wi-Fi, 128GB', 'Huawei').key;
    const kids = idOf('Huawei MatePad SE Kids Edition, Wi-Fi, 128GB, 11 inch', 'Huawei').key;
    const s256 = idOf('Huawei MatePad SE 11, Wi-Fi, 256GB', 'Huawei').key;
    expect(base).not.toBe(kids);
    expect(kids).toContain('kids');
    expect(base).not.toBe(s256);
  });
  it('iPad Air ≠ iPad Pro ≠ iPad mini; M2 ≠ M4', () => {
    const air = idOf('iPad Air 11 M4 128GB Wi-Fi', 'Apple').key;
    const pro = idOf('iPad Pro 11 M4 128GB Wi-Fi', 'Apple').key;
    const mini = idOf('iPad mini 128GB Wi-Fi 8.3 inch', 'Apple').key;
    const airM2 = idOf('iPad Air 11 M2 128GB Wi-Fi', 'Apple').key;
    expect(new Set([air, pro, mini, airM2]).size).toBe(4);
  });
  it('invalid when line or storage missing; missing connectivity → low_confidence', () => {
    expect(idOf('Apple 128GB Wi-Fi', 'Apple').status).toBe('invalid'); // no line
    expect(idOf('iPad Air 11 M4 Wi-Fi', 'Apple').status).toBe('invalid'); // no storage
    expect(idOf('Apple iPad Air 11 M4, 128GB', 'Apple').status).toBe('low_confidence_candidate'); // no connectivity
  });
});

describe('Tablet primary identity (manufacturer model)', () => {
  it('rejects ASIN and Jarir title-string model', () => {
    const asin = idOf('Samsung Galaxy Tab A11, WiFi, 8.7 Inch, 128GB', 'Samsung', { model: 'B0DXYZ1234' });
    expect(asin.key).not.toContain('MODEL:');
    const titleModel = idOf('Apple iPad A16, 128GB, Wi-Fi', 'Apple', { model: 'iPad A16 Tablet - Wi-Fi' });
    expect(titleModel.key).not.toContain('MODEL:');
  });
});

describe('Tablet category isolation', () => {
  it('plugin declares the tablet category and a version', () => {
    expect(tabletPlugin.category).toBe('tablet');
    expect(tabletPlugin.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
