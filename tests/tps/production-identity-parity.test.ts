// tests/tps/production-identity-parity.test.ts
// Samsung KSA official-gateway repair mission (2026-09-13). The founder's own
// framing: "LIVE OFFICIAL SAMSUNG PDP → production capture → production
// identity → audit ledger, NOT ledger → force production identity." Every
// assertion here runs the REAL, unmodified production pipeline (the actual
// scraper's extractVariantSuffix, the actual adaptRow spec-table injection,
// the actual category plugin detect/normalize/buildIdentityKey) against
// fixtures shaped exactly like real captured evidence — no audit-only
// URL-path hints, no bypassed detect() gates.
import { extractVariantSuffix } from '../../src/lib/scraping/stores/samsung-ksa-scraper';
import { adaptRow } from '../../scripts/tps-core/progressive-engine';
import { detect as mobileDetect, normalize as mobileNormalize } from '../../scripts/tps-plugins/mobile';
import { buildIdentityKey as mobileIdentity } from '../../scripts/tps-plugins/mobile/identity';
import { detect as monitorDetect, normalize as monitorNormalize } from '../../scripts/tps-plugins/monitor';
import { buildIdentityKey as monitorIdentity } from '../../scripts/tps-plugins/monitor/identity';

/** Mirrors samsung-ksa-scraper.ts's own `name` composition exactly. */
function composeSamsungName(url: string, baseLdName: string, sku: string): string {
  const variantSuffix = extractVariantSuffix(url, baseLdName);
  const withVariant = variantSuffix ? `${baseLdName} ${variantSuffix}` : baseLdName;
  return `${withVariant} (${sku})`;
}

describe('Galaxy S26 FE — 9 SKUs, root-caused and proven AUDIT_TOOL_DEFECT not a production defect', () => {
  // The one-off Mission 2/3 classification script captured a truncated
  // "Galaxy S26 FE" title for all 9 URLs (proven live: a fresh fetch returns
  // the FULL "Galaxy S26 FE Blueberry 128 GB"), collapsing 9 real,
  // differently-priced SKUs into one audit-ledger identity. The REAL
  // production scraper never had this problem: extractVariantSuffix already
  // derives colour+storage from the URL slug and appends it, independent of
  // whatever the JSON-LD `name` field says.
  const skus: [string, string][] = [
    ['https://www.samsung.com/sa_en/smartphones/galaxy-s/galaxy-s26-fe-blueberry-128gb-sm-s741bzvumea/', 'SM-S741BZVUMEA'],
    ['https://www.samsung.com/sa_en/smartphones/galaxy-s/galaxy-s26-fe-blueberry-256gb-sm-s741bzvvmea/', 'SM-S741BZVVMEA'],
    ['https://www.samsung.com/sa_en/smartphones/galaxy-s/galaxy-s26-fe-blueberry-512gb-sm-s741bzvwmea/', 'SM-S741BZVWMEA'],
    ['https://www.samsung.com/sa_en/smartphones/galaxy-s/galaxy-s26-fe-graphite-128gb-sm-s741bzkumea/', 'SM-S741BZKUMEA'],
    ['https://www.samsung.com/sa_en/smartphones/galaxy-s/galaxy-s26-fe-graphite-256gb-sm-s741bzkvmea/', 'SM-S741BZKVMEA'],
    ['https://www.samsung.com/sa_en/smartphones/galaxy-s/galaxy-s26-fe-graphite-512gb-sm-s741bzkwmea/', 'SM-S741BZKWMEA'],
    ['https://www.samsung.com/sa_en/smartphones/galaxy-s/galaxy-s26-fe-pistachio-128gb-sm-s741blgumea/', 'SM-S741BLGUMEA'],
    ['https://www.samsung.com/sa_en/smartphones/galaxy-s/galaxy-s26-fe-pistachio-256gb-sm-s741blgvmea/', 'SM-S741BLGVMEA'],
    ['https://www.samsung.com/sa_en/smartphones/galaxy-s/galaxy-s26-fe-pistachio-512gb-sm-s741blgwmea/', 'SM-S741BLGWMEA'],
  ];
  const BASE_LD_NAME = 'Galaxy S26 FE'; // Samsung's own JSON-LD `name` — identical for every variant

  it('extractVariantSuffix correctly derives colour + storage from the URL for every SKU', () => {
    const names = skus.map(([url, sku]) => composeSamsungName(url, BASE_LD_NAME, sku));
    expect(names).toEqual([
      'Galaxy S26 FE Blueberry 128GB (SM-S741BZVUMEA)',
      'Galaxy S26 FE Blueberry 256GB (SM-S741BZVVMEA)',
      'Galaxy S26 FE Blueberry 512GB (SM-S741BZVWMEA)',
      'Galaxy S26 FE Graphite 128GB (SM-S741BZKUMEA)',
      'Galaxy S26 FE Graphite 256GB (SM-S741BZKVMEA)',
      'Galaxy S26 FE Graphite 512GB (SM-S741BZKWMEA)',
      'Galaxy S26 FE Pistachio 128GB (SM-S741BLGUMEA)',
      'Galaxy S26 FE Pistachio 256GB (SM-S741BLGVMEA)',
      'Galaxy S26 FE Pistachio 512GB (SM-S741BLGWMEA)',
    ]);
  });

  it('the REAL mobile plugin (detect/normalize/buildIdentityKey) produces exactly 3 distinct, correctly-storaged identity keys — not 1, and not 9', () => {
    const keys = skus.map(([url, sku]) => {
      const name = composeSamsungName(url, BASE_LD_NAME, sku);
      expect(mobileDetect(name, name)).toBe(true);
      const norm = mobileNormalize(name, name, 'Samsung', {});
      const identity = mobileIdentity('Samsung', norm.payload, { model_number: norm.model_number });
      expect(identity.status).toBe('valid');
      return identity.key;
    });
    expect(new Set(keys).size).toBe(3); // 128GB / 256GB / 512GB — colour is correctly NOT part of identity
    expect(keys.filter((k) => k === 'samsung|Galaxy S|S26|FE|128')).toHaveLength(3);
    expect(keys.filter((k) => k === 'samsung|Galaxy S|S26|FE|256')).toHaveLength(3);
    expect(keys.filter((k) => k === 'samsung|Galaxy S|S26|FE|512')).toHaveLength(3);
    // Explicitly NOT the stale audit-ledger key this mission is correcting:
    expect(keys).not.toContain('samsung|Galaxy S|S26|FE|NO_STORAGE');
  });
});

describe('production plugin key == expected identity from official PDP fixture (previously audit-only, spec-table-dependent)', () => {
  it('a captured spec-table observation reaches the SAME monitor identity the audit ledger recorded — via the real adaptRow + monitor plugin, no URL-path override', () => {
    // Shaped exactly like a real raw_observations.payload row after Fix 1:
    // name from JSON-LD/title (title alone says nothing about resolution),
    // specifications.raw from the newly-captured PDP spec table.
    const payload = {
      name_en: 'Samsung Smart Monitor M8 - 32 inches',
      specifications: {
        raw: {
          'Resolution': '3,840 x 2,160',
          'Panel Type': 'VA',
          'Refresh Rate': '60 Hz',
        },
      },
    };
    const { nameAr, nameEn, brand } = adaptRow(payload, null);
    expect(monitorDetect(nameAr, nameEn)).toBe(true);
    const norm = monitorNormalize(nameAr, nameEn, brand ?? 'Samsung', payload);
    const identity = monitorIdentity(brand ?? 'Samsung', norm.payload, { model_number: norm.model_number });
    expect(identity.key).toBe('samsung|32|4k|60|va');
    expect(identity.status).toBe('valid');
  });

  it('a store with NO captured specifications is completely unaffected (adaptRow is a no-op for every other merchant)', () => {
    const payload = { name_en: 'Some Other Monitor 27 inch QHD 165Hz IPS' };
    const { nameEn } = adaptRow(payload, null);
    expect(nameEn).toBe('Some Other Monitor 27 inch QHD 165Hz IPS');
  });
});
