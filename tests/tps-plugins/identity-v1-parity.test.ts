// Phase 3B (2026-10-03) — V1 PARITY: with `TPS_IDENTITY_V2` unset the production mobile parser,
// mobile detector and TV detector produce byte-for-byte the same results as the committed
// pre-Phase-3B implementation on every title of the Phase-3A corpus (754 phone titles from
// Amazon, eXtra and Almanea; 203 Amazon TV titles). The snapshot was generated once from the
// HEAD copies and lives in tests/fixtures/identity/v1-snapshot-2026-10-03.json. A diff here means
// the flag-off path changed — which the rollback guarantee forbids.
import * as fs from 'fs';
import * as path from 'path';

const FIX = path.join(__dirname, '..', 'fixtures', 'identity');
const corpus = JSON.parse(fs.readFileSync(path.join(FIX, 'corpus-2026-10-03.json'), 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(path.join(FIX, 'v1-snapshot-2026-10-03.json'), 'utf8')) as { phones: Record<string, string | null>; tv: Record<string, boolean> };

const ORIGINAL_FLAG = process.env.TPS_IDENTITY_V2;
beforeAll(() => { delete process.env.TPS_IDENTITY_V2; });
afterAll(() => { if (ORIGINAL_FLAG !== undefined) process.env.TPS_IDENTITY_V2 = ORIGINAL_FLAG; });

const titles = (): Array<{ name: string; brand: string | null }> => [
  ...corpus.amazon_phones.map((p: any) => ({ name: p.name, brand: p.brand })),
  ...corpus.control_offers.filter((o: any) => o.category === 'mobile').map((o: any) => ({ name: o.name, brand: o.brand || (o.key || '').split('|')[0] })),
];

test('flag OFF: mobile keys identical to the v1 snapshot', () => {
  const parser = require('../../scripts/tps-plugins/mobile/parser'); const det = require('../../scripts/tps-plugins/mobile/detector'); const id = require('../../scripts/tps-plugins/mobile/identity');
  const diffs: string[] = [];
  for (const t of titles()) {
    const brand = t.brand && t.brand !== 'Unknown' && t.brand !== 'null' ? t.brand : null;
    let key: string | null = null;
    if (det.detect(t.name, t.name)) { const n = parser.normalize(t.name, t.name, brand, {}); const r = id.buildIdentityKey(brand, n.payload, { model_number: n.model_number }); key = r.status === 'valid' ? r.key : `__${r.status}`; } else key = '__detect_reject';
    const expected = snapshot.phones[t.name + '\u0000' + (brand ?? '')];
    if (expected !== undefined && expected !== key) diffs.push(`${t.name.slice(0, 60)} :: ${expected} → ${key}`);
  }
  expect(diffs).toEqual([]);
});

test('flag OFF: TV detection identical to the v1 snapshot', () => {
  const det = require('../../scripts/tps-plugins/tv/detector');
  const diffs: string[] = [];
  for (const o of corpus.amazon_offers.filter((o: any) => o.category === 'tv')) {
    const got = det.detect(o.name, o.name); const expected = snapshot.tv[o.name];
    if (expected !== undefined && expected !== got) diffs.push(`${o.name.slice(0, 60)} :: ${expected} → ${got}`);
  }
  expect(diffs).toEqual([]);
});
