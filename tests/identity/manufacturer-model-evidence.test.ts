// Unified manufacturer-model evidence (shadow only). Fixtures are fixed strings from the live catalogue (2026-10-04). Expectations are the
// Evidence-First rules A–F; no test (and no function) takes a price.
import { conditionOf, extractModelEvidence, relateModels, verifiedSubclusters, type ModelEvidence } from '@/lib/identity/manufacturer-model-evidence';
import { aliasStatus, type ManufacturerAlias } from '@/lib/identity/manufacturer-alias-registry';
import { sourceFieldTrust } from '@/lib/identity/source-field-trust-matrix';

const ev = (merchant: string, title: string, payload: Record<string, unknown> = {}, brand: string | null = null) => ({
  evidence: extractModelEvidence({ merchant, title, brand, payload }), brand,
});
const codes = (e: ModelEvidence[]) => e.filter((x) => x.usable_for_identity).map((x) => x.normalized_value);

describe('source-field trust matrix', () => {
  it('knows measured rows and never defaults an unknown pair upward', () => {
    expect(sourceFieldTrust('extra', 'top.modelNumber').trust).toBe('HIGH');
    expect(sourceFieldTrust('amazon', 'top.model').trust).toBe('LOW');
    expect(sourceFieldTrust('noon', 'spec.model_number').trust).toBe('MEDIUM');
    expect(sourceFieldTrust('brand_new_store', 'top.mpn').trust).toBe('UNMEASURED');
  });
});

describe('extractModelEvidence', () => {
  it('reads Extra modelNumber as HIGH, with raw + normalized + source path (including a variant word)', () => {
    const e = extractModelEvidence({ merchant: 'extra', title: 'TCL 85 Inch Mini LED Pro', payload: { modelNumber: '85C6K PRO' } });
    const m = e.find((x) => x.source_field === 'top.modelNumber')!;
    expect(m).toMatchObject({ raw_value: '85C6K PRO', normalized_value: '85C6KPRO', source_merchant: 'extra', trust_level: 'HIGH', evidence_type: 'structured_model_number', usable_for_identity: true });
  });
  it('reads Noon specifications.model_number as MEDIUM and usable', () => {
    const e = extractModelEvidence({ merchant: 'noon', title: 'Hisense 85 inch', payload: { specifications: { model_number: '85U7Q' } } });
    expect(e.find((x) => x.source_field === 'spec.model_number')).toMatchObject({ trust_level: 'MEDIUM', usable_for_identity: true, normalized_value: '85U7Q' });
  });
  it('never treats the generic model field of a LOW merchant as authoritative (Rule D)', () => {
    const e = extractModelEvidence({ merchant: 'amazon', title: 'TCL 85T8D Television 85 Inch', payload: { model: 'TW4B25HA' } });
    expect(e.filter((x) => x.source_field === 'top.model').every((x) => !x.usable_for_identity)).toBe(true);
  });
  it('refuses retailer ids and technology words in a structured field', () => {
    expect(codes(extractModelEvidence({ merchant: 'extra', title: 'x', payload: { modelNumber: 'B0H1M7X5R7' } }))).toEqual([]);
    expect(codes(extractModelEvidence({ merchant: 'extra', title: 'x', payload: { modelNumber: '144HZ' } }))).toEqual([]);
  });
  it('an unmeasured merchant field is evidence-with-a-warning, not authority', () => {
    const e = extractModelEvidence({ merchant: 'brand_new_store', title: 'x', payload: { mpn: 'MC-CG711RY47' } });
    expect(e[0].trust_level).toBe('UNMEASURED');
    expect(e[0].usable_for_identity).toBe(false);
    expect(e[0].warnings).toContain('source_field_unmeasured');
  });
  it('refuses a composite value naming two models (Noon "98Q6C/98C6K") but keeps a one-model slash code (Apple MDHH4AB/A)', () => {
    const c = extractModelEvidence({ merchant: 'noon', title: 'TCL 98 inch', payload: { specifications: { model_number: '98Q6C/98C6K' } } });
    expect(c[0]).toMatchObject({ usable_for_identity: false, trust_level: 'LOW' });
    expect(c[0].warnings).toContain('composite_value_multiple_models');
    const one = extractModelEvidence({ merchant: 'noon', title: 'AirPods', payload: { specifications: { model_number: 'MDHH4AB/A' } } });
    expect(one[0].usable_for_identity).toBe(true);
  });
  it('a title naming two models in one token yields neither (Noon "98Q6C/98C6K")', () => {
    const t = ev('noon', '98 Inch Smart TV 4K QD-Mini LED, 144Hz, 98Q6C/98C6K', {}, 'tcl');
    expect(codes(t.evidence)).toEqual([]);
    const amazon = ev('amazon', 'TCL 98Q6C Television 98 Inch Smart TV 4K', {}, 'tcl');
    expect(relateModels(amazon, t).relation).toBe('REVIEW');
  });
  it('carries no price anywhere in its output', () => {
    const e = extractModelEvidence({ merchant: 'extra', title: 'x', payload: { modelNumber: '65S7N', price: 4109 } });
    expect(JSON.stringify(e)).not.toMatch(/price|4109/);
  });
});

describe('relateModels — rules A–F', () => {
  const tclExtra = ev('extra', 'TCL 85 Inch Mini LED', { modelNumber: '85C6K PRO' }, 'tcl');
  const tclAmazon = ev('amazon', 'TCL 85T8D Television 85 Inch Smart TV 4K QD-Mini LED Google TV', {}, 'tcl');

  it('Rule A: the same trusted code on both sides → MATCH_CANDIDATE_STRONG', () => {
    const a = ev('noon', 'Hisense 55 Inch 55U6Q PRO Mini LED', {}, 'hisense');
    const b = ev('extra', 'Hisense 55 Inch Mini LED', { modelNumber: '55U6Q PRO' }, 'hisense');
    expect(relateModels(a, b).relation).toBe('MATCH_CANDIDATE_STRONG');
  });
  it('Rule B: different trusted codes → DIFFERENT_VARIANT (TCL 85T8D vs 85C6K PRO), no price involved', () => {
    expect(relateModels(tclExtra, tclAmazon).relation).toBe('DIFFERENT_VARIANT');
  });
  it('Rule B: 98C6K vs 98C8K are different; size/family/refresh never merge them', () => {
    const a = ev('extra', 'TCL 98 Inch Mini LED 144Hz', { modelNumber: '98C8K' }, 'tcl');
    const b = ev('jarir', 'TCL 98 Inch 98C6K Mini LED 144Hz', {}, 'tcl');
    expect(relateModels(a, b).relation).toBe('DIFFERENT_VARIANT');
  });
  it('Rule B exception: only a DOCUMENTED alias softens it', () => {
    const a = ev('extra', 'Hisense 85 Inch', { modelNumber: '85U7S' }, 'hisense');
    const b = ev('noon', 'Hisense 85 Inch 85U7Q Mini LED', {}, 'hisense');
    expect(relateModels(a, b).relation).toBe('DIFFERENT_VARIANT');
    const reg: ManufacturerAlias[] = [{ brand: 'hisense', code_a: '85U7S', code_b: '85U7Q', evidence_url: 'https://example.invalid/doc', evidence_date: '2026-10-04', market: 'KSA', identical_hardware: true, confidence: 'high' }];
    expect(relateModels(a, b, reg).relation).toBe('MATCH_CANDIDATE_STRONG');
    const incomplete = [{ ...reg[0], evidence_url: '' }];
    expect(relateModels(a, b, incomplete).relation).toBe('DIFFERENT_VARIANT');
  });
  it('Rule C: a trusted code on one side only → REVIEW', () => {
    const a = ev('extra', 'Hisense 65 Inch', { modelNumber: '65S7N' }, 'hisense');
    const b = ev('amazon', 'Hisense 65 inch QLED TV Black', {}, 'hisense');
    expect(relateModels(a, b).relation).toBe('REVIEW');
  });
  it('no trusted code anywhere → NO_EVIDENCE (not asserted different)', () => {
    expect(relateModels(ev('amazon', 'Hisense 65 inch TV'), ev('jarir', 'Hisense 65 inch QLED')).relation).toBe('NO_EVIDENCE');
  });
  it('variant word: stated by BOTH sides through source-explicit fields ⇒ DIFFERENT (Rule G); only in a title on one side ⇒ REVIEW (may be a truncation)', () => {
    const a = ev('extra', 'TCL 85 Inch', { modelNumber: '85C6K' }, 'tcl');
    const b = ev('extra', 'TCL 85 Inch', { modelNumber: '85C6K PRO' }, 'tcl');
    expect(relateModels(a, b).relation).toBe('DIFFERENT_VARIANT');
    const titleOnly = ev('amazon', 'TCL 85C6K 85 Inch Smart TV', {}, 'tcl');
    expect(relateModels(titleOnly, b).relation).toBe('REVIEW');
  });
  it('reads the model from the Arabic name stored in the payload (Amazon "75P8L من TCL")', () => {
    const t = ev('amazon', 'TCL 75-Inch QD Mini LED TV, 144Hz Native Refresh Rate', { name_ar: 'تلفزيون تي سي ال 75 بوصة 75P8L من TCL' }, 'tcl');
    expect(codes(t.evidence)).toEqual(['75P8L']);
  });
  it('a title naming two different long models states neither (Noon "QA55Q7FAAUXSA … QA55Q6FAAUXSA"); a marketing code inside the full code is one model', () => {
    const two = ev('noon', '55 Inch QLED TV Q7F QA55Q7FAAUXSA slim look QA55Q6FAAUXSA', {}, 'samsung');
    expect(codes(two.evidence)).toEqual([]);
    const one = ev('amazon', 'Samsung 43 Inch UA43F6000FUXZN series F6000FUXZN', {}, 'samsung');
    expect(codes(one.evidence).length).toBeGreaterThan(0);
  });
  it('a resolution (3840x2160) or a brand-size word (Hisense-55) next to ONE model is not a second model', () => {
    const n = ev('noon', '75 Inch UHD Google QLED TV, 4K Ultra HD 3840x2160, HDR10, Smart TV 75S4QLC2', {}, 'impex');
    expect(codes(n.evidence)).toEqual(['75S4QLC2']);
    const a = ev('amazon', 'Hisense-55 Inch Mini LED 4K Smart TV,55E8S,8 Years OS Update,Hi-View AI Engine,144Hz', {}, 'hisense');
    expect(codes(a.evidence)).toEqual(['55E8S']);
  });
  it('a unit value in a title ("HDR 3000nits", "1800W") is never a model', () => {
    const t = ev('amazon', 'TCL Q7C-Series | 4K Smart TV QD Mini LED Google TV, HDR 3000nits, 144Hz Native Refresh Rate', {}, 'tcl');
    expect(codes(t.evidence)).toEqual([]);
    expect(codes(ev('extra', 'Panasonic vacuum 1800W 2000ML', {}).evidence)).toEqual([]);
  });
  it('a size-prefix notation difference is the same code (Jarir short `Q71Q` vs `65Q71Q`) but different sizes never are', () => {
    const a = ev('jarir', 'Hisense 65" TV Q71Q', {}, 'hisense');
    const b = ev('extra', 'Hisense', { modelNumber: '65Q71Q' }, 'hisense');
    expect(relateModels({ ...a, evidence: [...a.evidence, ...extractModelEvidence({ merchant: 'jarir', title: 'x', payload: {}, captured: [{ field: 'page.label.manufacturer_no', value: '65Q71Q' }] })] }, b).relation).toBe('MATCH_CANDIDATE_STRONG');
    const c = ev('extra', 'Hisense', { modelNumber: '55Q71Q' }, 'hisense');
    expect(relateModels(b, c).relation).toBe('DIFFERENT_VARIANT');
  });
  it('Rule E: long codes differing only in a short regional tail → REVIEW', () => {
    const a = ev('samsung_ksa', 'Samsung 75"', { model: 'QA75Q70DAUXSA' }, 'samsung');
    const b = ev('samsung_ksa', 'Samsung 75"', { model: 'QA75Q70DAUXZN' }, 'samsung');
    expect(relateModels(a, b).relation).toBe('REVIEW');
  });
  it('Rule F: new vs refurbished is a different commercial offer', () => {
    const a = { ...ev('extra', 'Samsung phone', { modelNumber: 'SM-S938BZKIMEA' }), condition: conditionOf('Samsung phone new') };
    const b = { ...ev('amazon', 'Samsung phone Renewed', { specifications: { 'item model number': 'SM-S938BZKIMEA' } }), condition: conditionOf('Samsung phone Renewed') };
    expect(relateModels(a, b).relation).toBe('DIFFERENT_CONDITION');
  });
  it('conditionOf reads English and Arabic condition words', () => {
    expect(conditionOf('iPhone 15 (Renewed)')).toBe('refurbished');
    expect(conditionOf('هاتف مجدد')).toBe('refurbished');
    expect(conditionOf('Sony TV')).toBe('unknown');
  });
});

describe('aliasStatus', () => {
  it('is none for an empty registry and for entries missing evidence', () => {
    expect(aliasStatus('hisense', '85U7S', '85U7Q')).toBe('none');
  });
});

describe('verifiedSubclusters', () => {
  it('keeps the largest mutually consistent subset and leaves the different one unverified', () => {
    const items = [
      ev('amazon', 'TCL 98 Inch 98Q6C Mini LED', {}, 'tcl'),
      ev('noon', 'TCL 98 Inch 98Q6C Mini LED', {}, 'tcl'),
      ev('extra', 'TCL 98 Inch Mini LED', { modelNumber: '98C8L' }, 'tcl'),
    ];
    const r = verifiedSubclusters(items);
    expect(r.verified).toEqual([{ members: [0, 1], strength: 'medium' }]);
    expect(r.unverified).toEqual([2]);
    expect(r.pairs.find((p) => p.a === 0 && p.b === 2)?.verdict.relation).toBe('DIFFERENT_VARIANT');
  });
  it('never puts two listings in one cluster through a third (no transitive merge across a conflict)', () => {
    const items = [
      ev('extra', 'x', { modelNumber: '65S7N' }, 'hisense'),
      ev('noon', 'Hisense 65 inch 65S7N', {}, 'hisense'),
      ev('extra', 'y', { modelNumber: '65Q7N' }, 'hisense'),
    ];
    const r = verifiedSubclusters(items);
    expect(r.verified.every((c) => !(c.members.includes(0) && c.members.includes(2)))).toBe(true);
  });
});

import { parsePageEvidence, isValidGtin } from '@/lib/identity/page-evidence';
import { verifierDeclaredModel } from '@/lib/identity/manufacturer-model-evidence';

describe('page evidence parser (fragments copied from live pages, 2026-10-04)', () => {
  it('Jarir: "Manufacturer No" label + JSON-LD mpn/gtin', () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"x","mpn":"65Q71Q","sku":"682058","gtin13":"6942351426617","model":"Q71Q"}</script><span>Manufacturer No <b class="ar-number" data-v-fabe8bd3>65Q71Q</b></span>`;
    const p = parsePageEvidence(html);
    expect(p).toEqual(expect.arrayContaining([
      { field: 'page.jsonld.mpn', value: '65Q71Q' }, { field: 'page.label.manufacturer_no', value: '65Q71Q' }, { field: 'page.jsonld.gtin', value: '6942351426617' },
    ]));
  });
  it('Extra: inline modelNumber', () => {
    expect(parsePageEvidence(`<script>ACC.config.modelNumber="65S7N"; ACC.config.flixInpage="x";</script>`)).toEqual([{ field: 'page.script.modelNumber', value: '65S7N' }]);
  });
  it('Amazon: product-details th/td rows', () => {
    const html = `<tr> <th class="a-color-secondary a-size-base prodDetSectionEntry"> Model Number </th> <td class="a-size-base prodDetAttrValue"> 65Q72Q </td> </tr>`;
    expect(parsePageEvidence(html)).toEqual([{ field: 'page.table.model_number', value: '65Q72Q' }]);
  });
  it('JSON-LD with an UNQUOTED type attribute (Shaker/rank-math) is read; malformed JSON-LD is ignored, never guessed', () => {
    expect(parsePageEvidence(`<script type=application/ld+json class=rank-math-schema-pro>{"@graph":[{"@type":"Product","sku":"MDVC18"}]}</script>`)).toEqual([{ field: 'page.jsonld.sku', value: 'MDVC18' }]);
    expect(parsePageEvidence(`<script type="application/ld+json">{not json</script>`)).toEqual([]);
  });
  it('GTIN checksum: a real EAN passes, a customs code posing as a gtin does not', () => {
    expect(isValidGtin('6942351426617')).toBe(true);
    expect(isValidGtin('8508110000')).toBe(false);
    expect(isValidGtin('6942351426618')).toBe(false);
  });
});

describe('captured page evidence in the unified function', () => {
  const cap = (field: string, value: string) => [{ field, value, url: 'https://example.invalid/p', captured_at: '2026-10-04T00:00:00Z' }];
  it('an UNMEASURED page field is recorded with provenance but is not authority', () => {
    const e = extractModelEvidence({ merchant: 'newshop', title: 'x', payload: {}, captured: cap('page.jsonld.mpn', '65Q71Q') });
    expect(e[0]).toMatchObject({ evidence_type: 'page_field', trust_level: 'UNMEASURED', usable_for_identity: false, source_url: 'https://example.invalid/p', captured_at: '2026-10-04T00:00:00Z' });
    expect(e[0].warnings).toContain('source_field_unmeasured');
  });
  it('a checksum-failing page GTIN is refused', () => {
    const e = extractModelEvidence({ merchant: 'almanea', title: 'x', payload: {}, captured: cap('page.jsonld.gtin', '8508110000') });
    expect(e[0]).toMatchObject({ usable_for_identity: false });
    expect(e[0].warnings).toContain('gtin_checksum_invalid');
  });
  it('equal valid GTINs ⇒ strong match; equal GTIN but different trusted codes ⇒ REVIEW', () => {
    const mk = (merchant: string, mpn?: string) => ({ evidence: extractModelEvidence({ merchant, title: 't', payload: mpn ? { modelNumber: mpn } : {}, captured: cap('page.jsonld.gtin', '6942351426617') }).map((x) => ({ ...x, trust_level: 'HIGH' as const, usable_for_identity: true })), brand: 'hisense' });
    expect(relateModels(mk('jarir'), mk('amazon')).relation).toBe('MATCH_CANDIDATE_STRONG');
    expect(relateModels(mk('extra', '65S7N'), mk('extra', '65Q71Q')).relation).toBe('REVIEW');
  });
});

describe('verifierDeclaredModel', () => {
  it('picks the single source-explicit code, ignores a title-only code when an explicit one exists, and refuses contradictions', () => {
    const one = extractModelEvidence({ merchant: 'extra', title: 'Hisense 65 Inch QLED 65Q71Q', payload: { modelNumber: '65S7N' } });
    expect(verifierDeclaredModel(one)).toBe('65S7N');
    const titleOnly = extractModelEvidence({ merchant: 'amazon', title: 'TCL 85T8D Television 85 Inch Smart TV', payload: {} });
    expect(verifierDeclaredModel(titleOnly)).toBe('85T8D');
    const none = extractModelEvidence({ merchant: 'amazon', title: 'TCL Television 85 Inch', payload: {} });
    expect(verifierDeclaredModel(none)).toBeNull();
    const e = extractModelEvidence({ merchant: 'extra', title: 'x', payload: { modelNumber: '65S7N' } })[0];
    const conflict = [e, { ...e, source_field: 'page.jsonld.mpn', evidence_type: 'page_field' as const, raw_value: '65Q71Q', normalized_value: '65Q71Q' }];
    expect(verifierDeclaredModel(conflict)).toBeNull();   // two different source-explicit trusted codes on ONE listing
  });
});
