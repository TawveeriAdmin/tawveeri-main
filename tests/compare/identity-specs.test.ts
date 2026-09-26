// tests/compare/identity-specs.test.ts — ADR-388.
// Specification rows derived from the approved TPS identity key (deterministic parser output),
// never guessed. Fixtures = the two live LG canonicals of the founder's journey.
import { identitySpecRows, mergeIdentitySpecTable } from '@/lib/compare/identity-specs';
import { brandDisplayName } from '@/lib/compare/brand-display';

const FRESHDV = 'lg|split|FreshDV|18000|Inverter|cool_only';
const ARTCOOL = 'lg|split|ArtCool|18000|Inverter|cool_only';
const SAMSUNG = 'samsung|split|NO_SERIES|18000|Standard|NO_MODE';

describe('identitySpecRows — air conditioner', () => {
  it('renders the six-part key as Arabic decision rows', () => {
    const rows = identitySpecRows(FRESHDV, 'air_conditioner', 'ar');
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(byKey.ac_type).toBe('سبليت');
    expect(byKey.series).toBe('FreshDV');
    expect(byKey.capacity_btu).toMatch(/18,000/);
    expect(byKey.technology).toBe('انفرتر');
    expect(byKey.cooling_mode).toBe('بارد فقط');
  });

  it('sentinels become null (rendered «غير متاح»), never a value', () => {
    const rows = identitySpecRows(SAMSUNG, 'air_conditioner', 'ar');
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(byKey.series).toBeNull();
    expect(byKey.cooling_mode).toBeNull();
    expect(byKey.technology).toMatch(/عادي/);
  });

  it('accepts the TPS short category code and the English locale', () => {
    const rows = identitySpecRows(ARTCOOL, 'ac', 'en');
    expect(rows.find((r) => r.key === 'technology')?.value).toBe('Inverter');
  });

  it('no key, unknown category or malformed key → no rows (no guessing)', () => {
    expect(identitySpecRows(null, 'air_conditioner', 'ar')).toEqual([]);
    expect(identitySpecRows(FRESHDV, 'smartphone', 'ar')).toEqual([]);
    expect(identitySpecRows('lg|split', 'air_conditioner', 'ar')).toEqual([]);
  });
});

describe('mergeIdentitySpecTable', () => {
  it('unions rows across products, marks differences, drops all-unknown rows', () => {
    const table = mergeIdentitySpecTable([
      identitySpecRows(FRESHDV, 'air_conditioner', 'ar'),
      identitySpecRows(ARTCOOL, 'air_conditioner', 'ar'),
    ]);
    const series = table.find((r) => r.key === 'series');
    expect(series?.values).toEqual(['FreshDV', 'ArtCool']);
    expect(series?.differs).toBe(true);
    const cap = table.find((r) => r.key === 'capacity_btu');
    expect(cap?.differs).toBe(false);
  });

  it('a product without a key yields null cells while the other product keeps its values', () => {
    const table = mergeIdentitySpecTable([identitySpecRows(FRESHDV, 'air_conditioner', 'ar'), []]);
    const series = table.find((r) => r.key === 'series');
    expect(series?.values).toEqual(['FreshDV', null]);
  });

  it('two Samsung-like keys with only sentinels in a column drop that row entirely', () => {
    const table = mergeIdentitySpecTable([identitySpecRows(SAMSUNG, 'air_conditioner', 'ar'), identitySpecRows(SAMSUNG, 'air_conditioner', 'ar')]);
    expect(table.find((r) => r.key === 'series')).toBeUndefined();
    expect(table.find((r) => r.key === 'capacity_btu')).toBeDefined();
  });
});

describe('brandDisplayName', () => {
  it('maps internal lowercase tokens to the reader-facing name', () => {
    expect(brandDisplayName('lg', 'ar')).toBe('إل جي');
    expect(brandDisplayName('samsung', 'ar')).toBe('سامسونج');
    expect(brandDisplayName('lg', 'en')).toBe('LG');
  });
  it('keeps Arabic input and capitalises unknown Latin tokens', () => {
    expect(brandDisplayName('النخيل', 'ar')).toBe('النخيل');
    expect(brandDisplayName('zzbrand', 'en')).toBe('Zzbrand');
    expect(brandDisplayName('', 'en')).toBe('');
  });
});
