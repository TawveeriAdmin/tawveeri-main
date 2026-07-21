/**
 * Laptop TPS Plugin — identity-contract invariants (Laptop Identity Contract v1).
 * Pure-logic unit tests (no DB): detection vs accessory rejection, retailer-SKU
 * rejection, brand canonicalization, primary/fallback identity, and — critically —
 * the audit-proven NON-merges (the plugin must NOT merge different laptop models
 * that share coarse specs). Precision over recall; unknown beats incorrect.
 */
import { canonicalizeBrand } from '../../scripts/tps-core/brand-map';
import { laptopPlugin, normalize } from '../../scripts/tps-plugins/laptop';

const idOf = (ar: string, en: string, brand: string | null, payload: Record<string, unknown> = {}) => {
  const n = normalize(ar, en, brand, payload);
  return laptopPlugin.buildIdentityKey(brand, n.payload, { model_number: n.model_number });
};

describe('Laptop detection (accessory hard-reject)', () => {
  it('detects real laptops (AR + EN)', () => {
    expect(laptopPlugin.detect('', 'Lenovo IdeaPad Slim 3 Laptop, Intel Core 7')).toBe(true);
    expect(laptopPlugin.detect('لابتوب لينوفو', '')).toBe(true);
    expect(laptopPlugin.detect('', 'Apple MacBook Air M3')).toBe(true);
  });
  it('rejects accessories even when "laptop" appears', () => {
    expect(laptopPlugin.detect('', 'Promate HDMI Cable for Laptop')).toBe(false);
    expect(laptopPlugin.detect('', 'Anker Power Bank for Dual Laptops')).toBe(false);
    expect(laptopPlugin.detect('', 'UPERFECT Portable Monitor 16" Laptop Screen')).toBe(false);
    expect(laptopPlugin.detect('حقيبة لابتوب', '')).toBe(false);
    expect(laptopPlugin.detect('', 'Laptop Docking Station USB-C')).toBe(false);
  });
});

describe('Laptop brand canonicalization (bilingual)', () => {
  it('maps AR/EN laptop brands to one canonical form', () => {
    expect(canonicalizeBrand('Lenovo')).toBe('lenovo');
    expect(canonicalizeBrand('لينوفو')).toBe('lenovo');
    expect(canonicalizeBrand('اتش بي')).toBe('hp');
    expect(canonicalizeBrand('أسوس')).toBe('asus');
    expect(canonicalizeBrand('ابل')).toBe('apple');
  });
});

describe('Laptop retailer-SKU rejection (primary key integrity)', () => {
  it('rejects Amazon ASIN and Jarir numeric SKU as model_number (they poison corroboration)', () => {
    // ASIN -> must fall through to fallback spec identity (not MODEL:B0...)
    const asin = idOf('', 'HP Victus 15 Gaming Laptop, Intel Core i7-13620H, 16 GB RAM, 512 GB SSD, 15.6"', 'HP', { model: 'B0DB5B5WWS' });
    expect(asin.key).not.toContain('MODEL:');
    expect(asin.key).toContain('victus');
    // Jarir 6-digit numeric SKU -> rejected
    const jarir = idOf('', 'HP Pavilion 15 Laptop, Intel Core i5-1335U, 8 GB RAM, 512 GB SSD, 15.6"', 'HP', { model: '674123' });
    expect(jarir.key).not.toContain('MODEL:');
  });
  it('accepts a genuine manufacturer model number (primary tier)', () => {
    const r = idOf('لابتوب لينوفو IPS3 15IRH10', '', 'لينوفو', { model: '83K100EPAD', ram: '16', storage: '512' });
    expect(r.status).toBe('valid');
    expect(r.key).toBe('lenovo|MODEL:83K100EPAD');
  });
});

describe('Laptop fallback identity (precision guards)', () => {
  it('builds a full fallback key from family+cpu+ram+storage+screen+gpu', () => {
    const r = idOf('', 'HP Victus 15 Gaming Laptop, Intel Core i7-13620H, 16 GB RAM, 512 GB SSD, 15.6", RTX 3050', 'HP');
    expect(r.status).toBe('valid');
    expect(r.key).toBe('hp|victus 15|i7-13|16|512|15.6|rtx3050');
  });
  it('invalid when a discriminating spec (cpu/ram/storage) is missing (never guessed)', () => {
    expect(idOf('', 'HP Victus Gaming Laptop 15.6"', 'HP').status).toBe('invalid'); // no cpu/ram/storage
    expect(idOf('', 'Some Laptop, Intel Core i7, 16 GB RAM, 512 GB SSD', null).status).toBe('invalid'); // no brand
  });
  it('invalid when neither family nor screen present (identity too weak)', () => {
    const r = idOf('', 'Lenovo Laptop, Intel Core i7, 16 GB RAM, 512 GB SSD', 'Lenovo'); // no family, no screen, bare cpu
    expect(r.status).toBe('invalid');
  });
});

describe('Laptop NON-merge guards (audit-proven different models)', () => {
  it('MSI Vector 16 vs Vector 17 (same cpu/ram/storage) stay DISTINCT', () => {
    const a = idOf('', 'MSI Vector 16 HX AI Gaming Laptop, 16", Intel Core Ultra 9, 32 GB RAM, 1 TB', 'MSI').key;
    const b = idOf('', 'MSI Vector 17 HX AI Gaming Laptop, 17", Intel Core Ultra 9, 32 GB RAM, 1 TB', 'MSI').key;
    expect(a).not.toBe(b);
  });
  it('MSI Raider 18 vs MSI Vector 16 (same ultra9/32/2TB) stay DISTINCT', () => {
    const a = idOf('', 'MSI Raider 18 Gaming Laptop, 18", Intel Core Ultra 9, 32 GB RAM, 2 TB', 'MSI').key;
    const b = idOf('', 'MSI Vector 16 HX Gaming Laptop, 16", Intel Core Ultra 9, 32 GB RAM, 2 TB', 'MSI').key;
    expect(a).not.toBe(b);
  });
  it('HP Victus i7-13620H (gaming, H) vs HP 15-fd i7-1355U (ultrabook, U) stay DISTINCT', () => {
    const a = idOf('', 'HP Victus 15 Gaming Laptop, Intel Core i7-13620H, 16 GB RAM, 512 GB SSD, 15.6"', 'HP').key;
    const b = idOf('', 'HP 15-fd Laptop, Intel Core i7-1355U, 16 GB RAM, 512 GB SSD, 15.6"', 'HP').key;
    expect(a).not.toBe(b);
  });
  it('different RAM/storage of same model never merge', () => {
    const a = idOf('', 'Lenovo IdeaPad Slim 3, Intel Core 7, 8 GB RAM, 512 GB SSD, 15.3"', 'Lenovo').key;
    const b = idOf('', 'Lenovo IdeaPad Slim 3, Intel Core 7, 16 GB RAM, 1 TB SSD, 15.3"', 'Lenovo').key;
    expect(a).not.toBe(b);
  });
});

describe('Laptop category isolation', () => {
  it('plugin declares the laptop category and a version', () => {
    expect(laptopPlugin.category).toBe('laptop');
    expect(laptopPlugin.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
