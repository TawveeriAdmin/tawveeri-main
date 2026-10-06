import fs from 'fs';
import path from 'path';
import { acTypeIntent, acTypeOfProduct, filterByAcTypeIntent } from '@/lib/search/ac-type-intent';

describe('AC type intent (2026-10-06): a type named in the query is a requirement', () => {
  it('reads exactly one type from the query, in both scripts, and none when ambiguous or absent', () => {
    expect(acTypeIntent('مكيف سبليت')).toBe('split');
    expect(acTypeIntent('سبليت')).toBe('split');
    expect(acTypeIntent('split ac')).toBe('split');
    expect(acTypeIntent('مكيف شباك')).toBe('window');
    expect(acTypeIntent('window ac 18000')).toBe('window');
    expect(acTypeIntent('مكيف كاسيت')).toBe('cassette');
    expect(acTypeIntent('مكيف')).toBeNull();
    expect(acTypeIntent('مكيف 18000 وحدة')).toBeNull();
    expect(acTypeIntent('مكيف سبليت او شباك')).toBeNull();
  });

  it('reads a product type from the identity key first, then from the title incl. merchant typos', () => {
    expect(acTypeOfProduct({ tps_identity_key: 'gree|window|NO_SERIES|18000|Inverter|cool_only' })).toBe('window');
    expect(acTypeOfProduct({ tps_identity_key: 'lg|split|FreshDV|18000|Inverter|cool_only' })).toBe('split');
    expect(acTypeOfProduct({ name_ar: 'LG Spilt AC 18 000 BTU Cool' })).toBe('split');
    expect(acTypeOfProduct({ name_en: 'Zamil Winow AC Cool only 17 600 BTU' })).toBe('window');
    expect(acTypeOfProduct({ name_ar: 'مكيف شباك جري، 18000 وحدة' })).toBe('window');
    expect(acTypeOfProduct({ name_ar: 'مكيف TCL فريون 19000 وحدة ابيض' })).toBeNull();
    expect(acTypeOfProduct({ tps_identity_key: 'samsung|MODEL:AR18TSECCWK/MG', name_ar: 'مكيف سامسونج' })).toBeNull();
  });

  it('«مكيف سبليت» drops window / cassette / cabinet and keeps split plus unknown-type listings', () => {
    const items = [
      { id: 1, tps_identity_key: 'lg|split|FreshDV|18000|Inverter|cool_only', name_ar: 'مكيف سبليت FreshDV إل جي' },
      { id: 2, tps_identity_key: 'gree|window|NO_SERIES|18000|Inverter|cool_only', name_ar: 'مكيف شباك جري، 18000 وحدة' },
      { id: 3, tps_identity_key: 'haam|cassette|NO_SERIES|34000|Inverter|hot_cold', name_ar: 'مكيف كاسيت هام' },
      { id: 4, tps_identity_key: 'midea|cabinet|NO_SERIES|42000|Inverter|cool_only', name_ar: 'مكيف دولابي ميديا' },
      { id: 5, name_en: 'LG Spilt AC 18 000 BTU Cool Win Dual Inverter Compressor' },
      { id: 6, name_ar: 'مكيف TCL فريون 19000 وحدة ابيض' },          // type unknown → kept (unknown ≠ wrong)
    ];
    expect(filterByAcTypeIntent(items, 'مكيف سبليت').map((p) => p.id)).toEqual([1, 5, 6]);
    expect(filterByAcTypeIntent(items, 'مكيف شباك').map((p) => p.id)).toEqual([2, 6]);
  });

  it('is a no-op for a query that names no single type', () => {
    const items = [{ name_ar: 'مكيف شباك' }, { name_ar: 'مكيف سبليت' }];
    expect(filterByAcTypeIntent(items, 'مكيف 18000')).toEqual(items);
    expect(filterByAcTypeIntent(items, 'مكيف سبليت شباك')).toEqual(items);
  });

  it('is wired into the search route for AC queries', () => {
    const routeSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'api', 'search', 'route.ts'), 'utf8');
    expect(routeSrc).toMatch(/if \(rawQuery && isAcQuery\) \{[\s\S]{0,200}filterByAcTypeIntent\(products, rawQuery\)/);
  });
});
