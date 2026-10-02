// tests/review/adr400-consumer-journey.test.ts — ADR-400 (consumer-journey review, 2026-10-02).
// Pins the pure rules behind the reviewer's rejections: price «٠», a lowest-badge on a
// NO_SERIES key, a merchant-claimed discount under «لا خصومات مزعومة», an unmeasured
// priority ranked by proxy, and an implausible "verified drop" headlining a trust surface.
import {
  identityKeyHasSentinel, compareUrlHasSentinel, identityBasis, identityBasisLine, lowestOfferBadge,
} from '@/lib/compare/identity-confidence';
import { effectivePrice, comparisonBadge, type AdvisorRecommendation } from '@/lib/agent/advisor-api';
import { unmeasuredPriorityNote } from '@/lib/agent/unmeasured-priority';
import { rankVerifiedDropRows, VERIFIED_DROP_MAX_RATIO, type VerifiedDropRow } from '@/lib/intelligence/home-verified-deals';
import { observedSavingPct } from '@/lib/intelligence/observed-saving';
import { brandDisplayName } from '@/lib/compare/brand-display';
import { routeQuery } from '@/lib/agent/route-query';
import { distinctStoreCount } from '@/lib/compare/offer-eligibility';

describe('identity basis — a specification tuple is never sold as a model-number match', () => {
  it('detects unknown-spec sentinels in a raw key and in an encoded compare URL', () => {
    expect(identityKeyHasSentinel('lg|split|NO_SERIES|18000|Inverter|cool_only')).toBe(true);
    expect(identityKeyHasSentinel('samsung|front_load|25|washer')).toBe(false);
    expect(compareUrlHasSentinel('/ar/compare/lg%7Csplit%7CNO_SERIES%7C18000%7CInverter%7Ccool_only')).toBe(true);
    expect(compareUrlHasSentinel('/ar/compare/samsung%7Cfront_load%7C25%7Cwasher')).toBe(false);
    expect(compareUrlHasSentinel(null)).toBe(false);
  });

  it('a held model code earns «أقل سعر مرصود»; a sentinel key earns the reviewer\'s accepted sentence', () => {
    expect(identityBasis('lg|split|NO_SERIES|18000|Inverter|cool_only', 'S4-W18JLRXA')).toBe('model_code');
    expect(identityBasis('lg|split|NO_SERIES|18000|Inverter|cool_only', null)).toBe('specs_incomplete');
    expect(identityBasis('samsung|front_load|25|washer', null)).toBe('specs');
    expect(identityBasis('x|NO_SERIES|y', 'NO_MODEL')).toBe('specs_incomplete');
    expect(lowestOfferBadge('model_code', true)).toBe('أقل سعر مرصود');
    expect(lowestOfferBadge('specs_incomplete', true)).toBe('الأقل بين عروض بنفس المواصفات');
    expect(lowestOfferBadge('specs', false)).toBe('Lowest among same-spec offers');
    expect(identityBasisLine('specs_incomplete', true).text).toBe('هذه مقارنة مواصفات لا رقم موديل. فرق السعر قد يكون جهازًا آخر.');
    expect(identityBasisLine('specs_incomplete', true).tone).toBe('warn');
    expect(identityBasisLine('model_code', true).tone).toBe('ok');
  });

  it('comparisonBadge never says «موثّقة» on a sentinel key', () => {
    const base = { canonical_id: 'c', title_ar: null, title_en: null, brand: null, unit_price: 1, total_cost_estimate: null,
      cost_breakdown: { unit: 1, installation: null, annual_electricity: null }, suitability_score: 0.8, confidence: 50,
      is_smart_pick: true, reasons_ar: [], dna: {}, go_offer_hint: 'x', go_url: null } as unknown as AdvisorRecommendation;
    const sentinel = comparisonBadge({ ...base, tps_identity_key: 'lg|split|NO_SERIES|18000|Inverter|cool_only', store_count: 2, comparison_available: true }, 'ar');
    expect(sentinel.verified).toBe(false);
    expect(sentinel.text).toContain('الموديل غير مؤكد');
    const clean = comparisonBadge({ ...base, tps_identity_key: 'samsung|front_load|25|washer', store_count: 3, comparison_available: true }, 'ar');
    expect(clean.verified).toBe(true);
  });
});

describe('English need-sentences reach the decision engine like their Arabic twins (reviewer Q6)', () => {
  it('«30m2» is an area unit, not a model token — the sentence routes to advisory with room + budget', () => {
    const r = routeQuery('quiet AC for 30m2 under 4000');
    expect(r.mode).toBe('advisory');
    expect(r.task?.room_size_m2).toBe(30);
    expect(r.task?.budget_total).toBe(4000);
    expect(routeQuery('AC for 30 m2 room under 4000').mode).toBe('advisory');
    expect(routeQuery('iphone 15 pro').mode).toBe('retrieval');
  });
});

describe('distinctStoreCount — a numeric store id never takes the search page down (evidence #9, live root cause)', () => {
  it('counts string and numeric keys alike', () => {
    const items = [{ k: 'extra' }, { k: 4 }, { k: 4 }, { k: 'Extra ' }, { k: null }, { k: '' }];
    expect(distinctStoreCount(items, (i) => i.k as string | number | null)).toBe(2);
  });
});

describe('brandDisplayName — a non-string brand never takes the search page down (evidence #9)', () => {
  it('coerces arrays/objects/numbers and still maps known tokens', () => {
    expect(brandDisplayName(['lg'], 'ar')).toBe('إل جي');
    expect(brandDisplayName({ name_en: 'Samsung' }, 'en')).toBe('Samsung');
    expect(brandDisplayName({ name_ar: 'سامسونج' }, 'ar')).toBe('سامسونج');
    expect(brandDisplayName(42, 'en')).toBe('42');
    expect(brandDisplayName(undefined, 'ar')).toBe('');
    expect(brandDisplayName(true, 'ar')).toBe('');
    expect(brandDisplayName('lg', 'ar')).toBe('إل جي');
  });
});

describe('effectivePrice — unknown is rendered as unknown, never as zero', () => {
  const rec = (unit: number | null, current: number | null | undefined) =>
    ({ unit_price: unit, discount_intel: current === undefined ? null : { verdict: 'stable', real_saving_pct: null, advertised_saving_pct: null, text: { ar: '', en: '' }, current_price: current } }) as Pick<AdvisorRecommendation, 'unit_price' | 'discount_intel'>;
  it('prefers the projection price, falls back to the listing facts price, and never invents one', () => {
    expect(effectivePrice(rec(3699, 3650))).toBe(3699);
    expect(effectivePrice(rec(null, 3699))).toBe(3699);
    expect(effectivePrice(rec(0, 3699))).toBe(3699);
    expect(effectivePrice(rec(null, null))).toBeNull();
    expect(effectivePrice(rec(null, undefined))).toBeNull();
    expect(effectivePrice(rec(null, 0))).toBeNull();
  });
});

describe('unmeasuredPriorityNote — «طلبت هادئًا. لا نملك ديسيبل، فلم نرتّب عليه.»', () => {
  it('discloses once when no candidate carries a noise figure, and stays silent when one does', () => {
    const rows = [{ attributes: { capacity_btu: 18000 } }, { attributes: {} }];
    const note = unmeasuredPriorityNote(['quiet', 'low_electricity'], rows);
    expect(note?.ar).toContain('طلبت الهدوء');
    expect(note?.ar).toContain('فلم نرتّب عليه');
    expect(unmeasuredPriorityNote(['quiet'], [{ attributes: { noise_db: 42 } }])).toBeNull();
    expect(unmeasuredPriorityNote(['low_electricity'], rows)).toBeNull();
    expect(unmeasuredPriorityNote(undefined, rows)).toBeNull();
  });
});

describe('verified drops — an implausible observed maximum is a data defect, not a deal', () => {
  const NOW = new Date('2026-10-02T12:00:00Z');
  const row = (o: Partial<VerifiedDropRow>): VerifiedDropRow => ({
    name: 'Samsung dishwasher 14 place DW70H73YMFR', url: 'https://www.example.com/p/1', store_name: '2',
    current_price: 2499, observed_max: 2999, real_saving_pct: 17, distinct_days: 26, category: 'dishwasher',
    last_seen: new Date(NOW.getTime() - 3_600_000).toISOString(), ...o,
  });
  beforeAll(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterAll(() => { jest.useRealTimers(); });

  it(`drops a row whose observed_max exceeds ${VERIFIED_DROP_MAX_RATIO}× the current price (production: 2,499 vs 230,000)`, () => {
    const out = rankVerifiedDropRows([row({ observed_max: 230000, real_saving_pct: 99 }), row({ url: 'https://www.example.com/p/2' })], null);
    expect(out.map((r) => r.url)).toEqual(['https://www.example.com/p/2']);
    expect(out[0].lastSeen).toBe(new Date(NOW.getTime() - 3_600_000).toISOString());
  });

  it('a saving percentage on the page is computed from the two shown prices only', () => {
    expect(observedSavingPct(2499, 2999)).toBe(17);
    expect(observedSavingPct(2499, 2499)).toBe(0);
    expect(observedSavingPct(2499, 0)).toBe(0);
  });
});
