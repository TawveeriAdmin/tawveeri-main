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
  // MEASURED DEFECT (2026-08-22): 8 production canonical_products rows in category
  // 'laptop' were accessories reachable live via decide()/Waffar/search (same failure
  // class as the earlier TV Funko/mobile-case defects) — none matched the accessory
  // list above, since each carries a plain accessory word this list never covered.
  it('rejects the 6 measured production accessory titles (2026-08-22 audit)', () => {
    expect(laptopPlugin.detect('', '2B Gaming Laptop Cooling, 5 Fans With Led Metal Fan, Black')).toBe(false);
    expect(laptopPlugin.detect('', 'BASEUS Papery Notebook Holder, Dark gray')).toBe(false);
    expect(laptopPlugin.detect('', 'Golden Wheat Foldable Laptop Table 60x40x26 Cm Beech')).toBe(false);
    expect(laptopPlugin.detect('', 'Golden Wheat Foldable Laptop Table 40x60x28 Cm Blue')).toBe(false);
    expect(laptopPlugin.detect('', 'PingCool, Password Type Laptop Lock Anti-theft Desk Fixed Lock, 1.8m')).toBe(false);
    // Note: "لينوفو GX41K08218" and "2b LF-01-6" (the other 2 of the original 8) had
    // no raw title distinct from the two cases above at audit time (same store
    // batch); this pins the 6 verified DISTINCT accessory titles found.
  });
  // 2 of the original 8 flagged rows are Chromebooks with a broken model_number
  // extraction (identity-key bug: "DDR3"/"SSD/256MB" text from a RAM/storage spec
  // was captured as the model number), NOT accessories — they are genuine laptops
  // and must keep detecting as laptops. A different bug class, deliberately not
  // touched by this fix.
  it('does NOT regress genuine (if oddly-keyed) Chromebook laptops', () => {
    expect(laptopPlugin.detect('', 'Dell Chromebook 3180 Renewed Business Laptop | Intel Celeron N3060 Dual Core CPU | 4GB DDR3 RAM | 16GB SATA HDD |11.6 inch Display | CHROME OS | 15 Days of IT-Sizer Golden Warranty (Renewed)')).toBe(true);
    expect(laptopPlugin.detect('', 'HP Refurbished - Chromebook G4 (2015) Laptop With 14-Inch Display, Intel Celeron Processor/2nd Gen/4GB RAM/16GB SSD/256MB Intel HD Graphics English Black (Renewed)')).toBe(true);
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
    // ADR-058: the size-class digit ("Victus 15") is NOT carried in the family
    // token, because the screen size is already a separate key field. Victus 15
    // and Victus 16 stay distinct via 15.6 vs 16.1, so dropping the redundant
    // digit costs no discrimination — and it buys cross-store stability, since
    // stores disagree on whether to print it (see the stability test below).
    expect(r.key).toBe('hp|victus|i7-13|16|512|15.6|rtx3050');
  });
  it('ADR-058: family is STABLE when one store prints the size-class digit and another does not', () => {
    // Real production divergence that produced laptop 0% corroboration:
    // Jarir printed "Aspire Lite 15", Extra printed "aspire lite" — same product,
    // previously `aspire 15` vs `aspire`, so they could never match.
    const jarir = idOf('', 'Acer Aspire Lite 15 Laptop, Intel Core i5-1235U, 16 GB RAM, 512 GB SSD, 15.6"', 'Acer');
    const extra = idOf('', 'Acer aspire lite laptop with 15.6" fhd display, Intel Core i5-1235U, 16gb ram, 512gb ssd', 'Acer');
    expect(jarir.key).toBe(extra.key);
  });
  it('ADR-058: keeps a genuine series digit that is NOT the screen size', () => {
    // "Slim 3" is a product tier, not a size class — it must survive.
    const r = idOf('', 'Lenovo IdeaPad Slim 3 Laptop, Intel Core i5-1335U, 8 GB RAM, 512 GB SSD, 15.6"', 'Lenovo');
    expect(r.key).toContain('ideapad 3');
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
