// tests/intelligence/home-verified-deals.test.ts — Affiliate Opportunity Recovery
// mission (2026-09-09). Regression coverage for the defects this mission found and
// fixed in src/lib/intelligence/home-verified-deals.ts: pool starvation, category
// misclassification, freshness, and Amazon ASIN destination-resolution fallback.
//
// Targets rankVerifiedDropRows/isMiscategorizedPrimaryProduct/extractAmazonAsin —
// pure functions extracted specifically so these rules are testable without mocking
// a Supabase client (same precedent as deriveCampaignStatus/isCampaignEligible).
import {
  rankVerifiedDropRows,
  isMiscategorizedPrimaryProduct,
  extractAmazonAsin,
  type VerifiedDropRow,
} from '@/lib/intelligence/home-verified-deals';

const NOW = new Date('2026-09-09T12:00:00Z');
const HOUR = 3_600_000;

function row(overrides: Partial<VerifiedDropRow> = {}): VerifiedDropRow {
  return {
    name: 'Generic Product 55 Inch',
    url: 'https://www.example.com/p/1',
    store_name: '2', // amazon
    current_price: 500,
    observed_max: 700,
    real_saving_pct: 28,
    distinct_days: 5,
    category: 'tv',
    last_seen: new Date(NOW.getTime() - 1 * HOUR).toISOString(), // fresh by default
    ...overrides,
  };
}

describe('rankVerifiedDropRows — §16A/B: merchant scoping does not starve a slower-refreshing merchant', () => {
  it('a fresh Noon row survives even when Amazon rows are far more recent', () => {
    const rows: VerifiedDropRow[] = [
      row({ store_name: '2', last_seen: new Date(NOW.getTime() - 5 * 60_000).toISOString(), name: 'Amazon fresh TV' }), // 5 min ago
      row({ store_name: '3', last_seen: new Date(NOW.getTime() - 20 * HOUR).toISOString(), name: 'Noon less-fresh but still valid drop' }), // 20h ago, still < 168h
    ];
    jest.useFakeTimers().setSystemTime(NOW);
    const noonResult = rankVerifiedDropRows(rows, 'noon');
    jest.useRealTimers();
    expect(noonResult).toHaveLength(1);
    expect(noonResult[0].name).toBe('Noon less-fresh but still valid drop');
  });

  it('merchant-scoped call only returns that merchant\'s own rows, never another merchant\'s, regardless of pool order', () => {
    const rows: VerifiedDropRow[] = [
      row({ store_name: '2', name: 'Amazon item' }),
      row({ store_name: '3', name: 'Noon item' }),
      row({ store_name: '4', name: 'Extra item' }),
    ];
    jest.useFakeTimers().setSystemTime(NOW);
    const amazonOnly = rankVerifiedDropRows(rows, 'amazon');
    jest.useRealTimers();
    expect(amazonOnly.map((r) => r.name)).toEqual(['Amazon item']);
  });

  it('unscoped (homepage) call returns every merchant\'s qualifying rows — unchanged neutral behavior', () => {
    const rows: VerifiedDropRow[] = [
      row({ store_name: '2', name: 'Amazon item' }),
      row({ store_name: '3', name: 'Noon item' }),
    ];
    jest.useFakeTimers().setSystemTime(NOW);
    const all = rankVerifiedDropRows(rows, null);
    jest.useRealTimers();
    expect(all.map((r) => r.name).sort()).toEqual(['Amazon item', 'Noon item']);
  });
});

describe('rankVerifiedDropRows — §16D: freshness — historical rows never become "current" without it', () => {
  it('a verified_drop row older than the 168h freshness standard is excluded, even with a real saving', () => {
    const rows: VerifiedDropRow[] = [
      row({ last_seen: new Date(NOW.getTime() - 200 * HOUR).toISOString() }), // >168h stale
    ];
    jest.useFakeTimers().setSystemTime(NOW);
    const result = rankVerifiedDropRows(rows, null);
    jest.useRealTimers();
    expect(result).toHaveLength(0);
  });

  it('a row exactly within the 168h window is included (all else valid)', () => {
    const rows: VerifiedDropRow[] = [
      row({ last_seen: new Date(NOW.getTime() - 167 * HOUR).toISOString() }),
    ];
    jest.useFakeTimers().setSystemTime(NOW);
    const result = rankVerifiedDropRows(rows, null);
    jest.useRealTimers();
    expect(result).toHaveLength(1);
  });

  it('MEASURED regression case: Noon\'s real production distribution (3,024 historical, ~2 fresh) — only the fresh ones surface', () => {
    const rows: VerifiedDropRow[] = [
      row({ store_name: '3', name: 'stale noon drop 1', last_seen: new Date(NOW.getTime() - 30 * 24 * HOUR).toISOString() }),
      row({ store_name: '3', name: 'stale noon drop 2', last_seen: new Date(NOW.getTime() - 10 * 24 * HOUR).toISOString() }),
      row({ store_name: '3', name: 'the one fresh noon drop', last_seen: new Date(NOW.getTime() - 5 * HOUR).toISOString() }),
    ];
    jest.useFakeTimers().setSystemTime(NOW);
    const result = rankVerifiedDropRows(rows, 'noon');
    jest.useRealTimers();
    expect(result.map((r) => r.name)).toEqual(['the one fresh noon drop']);
  });
});

describe('rankVerifiedDropRows / isMiscategorizedPrimaryProduct — §16H: category', () => {
  it('a real, confirmed-pattern TV mislabeled "accessories" is promoted (matches the live Samsung H5000F / Nikai 65" cases)', () => {
    expect(isMiscategorizedPrimaryProduct('Samsung 32 Inch HD TV, H5000F, Free contents by Samsung TV Plus', 'accessories')).toBe(true);
    expect(isMiscategorizedPrimaryProduct('Nikai 65" Inch QLED WebOS 4K Smart UHD TV, Hands-Free Voice Control', 'accessories')).toBe(true);
    expect(isMiscategorizedPrimaryProduct('Haier TV 65 Inch 4K Smart Google TV | Gaming@120 Hz', 'accessories')).toBe(true);
  });

  it('a genuine accessory (screen protector, TV stand) is NEVER promoted even though "TV" appears in the title', () => {
    expect(isMiscategorizedPrimaryProduct('Tempered Glass Screen Protector Compatible for Huawei MatePad', 'accessories')).toBe(false);
    expect(isMiscategorizedPrimaryProduct('Bentifar Mobile TV Stand Rolling Cart for 32-75 Inch TVs, Height Adjustable', 'accessories')).toBe(false);
  });

  it('an uncertain title (no strong TV signal) stays quarantined as accessory — never extrapolated', () => {
    expect(isMiscategorizedPrimaryProduct('Salange P60Pro Smart Mini Projector Native 1080P, Android 14', 'accessories')).toBe(false);
    expect(isMiscategorizedPrimaryProduct('JBL TUNE 310C USB-C Wired Hi-Res In-Ear Headphones', 'accessories')).toBe(false);
  });

  it('a row already correctly categorized (not "accessories") is untouched by the override', () => {
    expect(isMiscategorizedPrimaryProduct('Some TV 55 Inch', 'tv')).toBe(false);
  });

  it('end-to-end: a miscategorized TV row survives rankVerifiedDropRows; a true accessory does not', () => {
    const rows: VerifiedDropRow[] = [
      row({ name: 'Samsung 32 Inch HD TV, H5000F, Free contents by Samsung TV Plus', category: 'accessories' }),
      row({ name: 'Tempered Glass Screen Protector for MatePad', category: 'accessories', url: 'https://www.example.com/p/2' }),
    ];
    jest.useFakeTimers().setSystemTime(NOW);
    const result = rankVerifiedDropRows(rows, null);
    jest.useRealTimers();
    expect(result.map((r) => r.name)).toEqual(['Samsung 32 Inch HD TV, H5000F, Free contents by Samsung TV Plus']);
  });
});

describe('extractAmazonAsin — §16E/F: Amazon destination resolution fallback', () => {
  it('extracts a real ASIN from a genuine, volatile Amazon search-result URL', () => {
    const url = 'https://www.amazon.sa/-/en/Hisense-Inch-QLED-Smart-Built/dp/B0F1MRPC4B/ref=sr_1_60?dib=eyJ2IjoiMSJ9.xyz&qid=1785218851&sr=8-60';
    expect(extractAmazonAsin(url)).toBe('B0F1MRPC4B');
  });

  it('extracts an ASIN regardless of surrounding query-string volatility (same ASIN, different qid/sr)', () => {
    const urlA = 'https://www.amazon.sa/-/en/Hisense/dp/B0F1MRPC4B/ref=sr_1_22?qid=1786259743&sr=1-22';
    const urlB = 'https://www.amazon.sa/-/en/Hisense/dp/B0F1MRPC4B/ref=sr_1_47?qid=1786120060&sr=1-47';
    expect(extractAmazonAsin(urlA)).toBe(extractAmazonAsin(urlB));
  });

  it('§16F — fails closed (null) for a URL with no /dp/ segment (category/search-listing page)', () => {
    expect(extractAmazonAsin('https://www.amazon.sa/s?k=tv&rh=n%3A16966461031')).toBeNull();
  });

  it('§16F — fails closed (null) for a non-Amazon URL', () => {
    expect(extractAmazonAsin('https://www.noon.com/saudi-en/some-product/N70130858V/p/')).toBeNull();
  });

  it('§16F — fails closed (null) for a malformed/ambiguous ASIN (wrong length)', () => {
    expect(extractAmazonAsin('https://www.amazon.sa/dp/B0F1MR/ref=sr_1_1')).toBeNull();
  });

  it('is case-insensitive on input but always returns an upper-cased ASIN (matching Amazon\'s own convention)', () => {
    expect(extractAmazonAsin('https://www.amazon.sa/dp/b0f1mrpc4b/ref=sr_1_1')).toBe('B0F1MRPC4B');
  });
});
