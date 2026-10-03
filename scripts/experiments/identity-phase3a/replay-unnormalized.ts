// Phase 3A: replay production vs candidate detectors on the Amazon PDP observations that never
// reached normalized_product_observations in the last 7 days (unnormalized-7d.json, read-only pull).
import * as fs from 'fs';
import * as path from 'path';
import { CATEGORY_DEFS } from '../../tps-core/category-registry';
import { detect as mobileDetectV2 } from './mobile-detector-v2';
import { normalize as mobileNormalizeV2 } from './mobile-parser-v2';
import { buildIdentityKey as mobileKey } from '../../tps-plugins/mobile/identity';
import { detect as tvDetectV2 } from './tv-detector-v2';
import { detectBrandFromText } from '../../tps-core/brand-map';
const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'unnormalized-7d.json'), 'utf8')) as any[];
const defs = Object.values(CATEGORY_DEFS) as any[];
const byCat = (c: string) => defs.find(d => d.category === c);
const PLATFORM = new Set(['google', 'apple tv', 'android', 'amazon', 'vision', 'unknown']);
const resolveBrand = (r: any) => { if (r.brand && r.brand !== 'Unknown') return r.brand; const t = detectBrandFromText(r.raw_name); return t && !PLATFORM.has(t.toLowerCase()) ? t : null; };
const out = { n: rows.length, v1: { detected: 0, valid: 0, byCat: {} as any }, v2: { detected: 0, valid: 0, byCat: {} as any, reasons: {} as any }, examples: [] as any[] };
const bump = (o: any, cat: string, k: string) => { o.byCat[cat] = o.byCat[cat] || {}; o.byCat[cat][k] = (o.byCat[cat][k] || 0) + 1; };
for (const r of rows) {
  const name = r.raw_name; const brand = r.brand && r.brand !== 'Unknown' ? r.brand : null; const brand2 = resolveBrand(r);
  // v1: production plugins exactly
  let v1cat: string | null = null, v1valid = false;
  for (const d of defs) { if (d.plugin.detect(name, name)) { v1cat = d.category; try { const n = d.normalize(name, name, brand, {}); const id = d.plugin.buildIdentityKey(brand, n.payload, { model_number: n.model_number }); v1valid = id.status === 'valid'; } catch { } break; } }
  if (v1cat) { out.v1.detected++; bump(out.v1, v1cat, v1valid ? 'valid' : 'detected_not_valid'); if (v1valid) out.v1.valid++; } else bump(out.v1, 'none', 'rejected');
  // v2: candidate detectors for mobile/tv, production for the rest; brand resolved; parser v2 for mobile
  let v2cat: string | null = null, v2valid = false, v2status = '', v2key: string | null = null;
  for (const d of defs) {
    const det = d.category === 'mobile' ? mobileDetectV2(name, name) : d.category === 'tv' ? tvDetectV2(name, name) : d.plugin.detect(name, name);
    if (!det) continue; v2cat = d.category;
    try { if (d.category === 'mobile') { const n = mobileNormalizeV2(name, name, brand2, {}); const id = mobileKey(brand2, n.payload, { model_number: n.model_number }); v2valid = id.status === 'valid'; v2status = id.status; v2key = id.key; } else { const n = d.normalize(name, name, brand2, {}); const id = d.plugin.buildIdentityKey(brand2, n.payload, { model_number: n.model_number }); v2valid = id.status === 'valid'; v2status = id.status + (id.reason ? ':' + id.reason : ''); v2key = id.key; } } catch (e) { v2status = 'error'; }
    break;
  }
  if (v2cat) { out.v2.detected++; bump(out.v2, v2cat, v2valid ? 'valid' : 'detected_not_valid'); if (v2valid) out.v2.valid++; else out.v2.reasons[v2cat + ':' + v2status.slice(0, 60)] = (out.v2.reasons[v2cat + ':' + v2status.slice(0, 60)] || 0) + 1; } else bump(out.v2, 'none', 'rejected');
  if (out.examples.length < 40 && v2valid) out.examples.push({ cat: v2cat, key: v2key, name: name.slice(0, 90), price: r.price });
}
fs.writeFileSync(path.join(DIR, 'replay-unnormalized-results.json'), JSON.stringify(out, null, 1));
console.log('unnormalized rows', out.n, '| v1 detected', out.v1.detected, 'valid', out.v1.valid, '| v2 detected', out.v2.detected, 'valid', out.v2.valid);
console.log('v1 byCat', JSON.stringify(out.v1.byCat)); console.log('v2 byCat', JSON.stringify(out.v2.byCat));
console.log('v2 not-valid reasons', JSON.stringify(Object.entries(out.v2.reasons).sort((a: any, b: any) => b[1] - a[1]).slice(0, 12)));
for (const e of out.examples.slice(0, 25)) console.log('  ', e.cat, e.key, '|', e.name.slice(0, 70), '|', e.price);
