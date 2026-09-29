/**
 * F-005 constraint gates. Every fixture below is a REAL title taken from the live
 * production responses to Q09/Q10/Q11 on 2026-09-29 against `59b3a53c` (recorded in the
 * task's before-baseline), not invented text — so a regression here means the exact
 * live defect came back.
 */
import {
  normalizeAlnum,
  hasConflictingMonitorSignal,
  extractStrongModelToken,
  titleCarriesModelToken,
  phoneTierOf,
  requestedPhoneTier,
  conflictsWithRequestedTier,
} from '@/lib/search/constraint-gates';

describe('F-005 · Q09 — a computer monitor must not answer a TV query', () => {
  it('excludes the exact live offender (rank 4 of Q09)', () => {
    expect(hasConflictingMonitorSignal('شاشة samsung 55 بوصة 4K 144Hz', 'Samsung 55" 4K 144Hz Monitor')).toBe(true);
  });

  it('keeps every genuine TV that Q09 returned, including the one that names NO TV noun', () => {
    const genuineTvs: Array<[string, string]> = [
      ['شاشة تلفزيون، سامسونج، 55 بوصة، 4K UHD، سمارت، Mini LED', 'Samsung TV, 55 Inch, 4K UHD, Smart, Mini LED- UA55M70HAUXSA'],
      ['تلفزيون ذكي من الفئة "كريستال يو اتش دي" طراز يو 8000 اف مقاس 55 بوصة', 'Samsung Crystal UHD U8000F 55 inch'],
      ['تلفزيون كريستال UHD مقاس 55 بوصة، U8000H', 'Samsung 50 Inch Crystal UHD TV, U8000H, 4K'],
      // The decisive one: only «شاشة» + a Samsung TV model code, no TV noun at all.
      ['سامسونج شاشة UHD 55 بوصة – سلسلة DU7000 – معالج Crystal بدقة 4K – أسود – UA55DU7000UXSA', ''],
    ];
    for (const [ar, en] of genuineTvs) {
      expect(hasConflictingMonitorSignal(ar, en)).toBe(false);
    }
  });

  it('keeps a hybrid that names BOTH — an unambiguous conflict is required', () => {
    expect(hasConflictingMonitorSignal('', 'Samsung Smart Monitor M7, Smart TV apps built in')).toBe(false);
  });

  it('never treats the bare Arabic word «شاشة» as a monitor signal', () => {
    expect(hasConflictingMonitorSignal('شاشة سامسونج 65 بوصة', '')).toBe(false);
  });

  it('catches the explicit Arabic computer/gaming screen phrasings', () => {
    expect(hasConflictingMonitorSignal('شاشة كمبيوتر 27 بوصة', '')).toBe(true);
    expect(hasConflictingMonitorSignal('شاشة العاب منحنية 165Hz', '')).toBe(true);
  });
});

describe('F-005 · Q10 — a model-number query is exact or honestly empty', () => {
  it('extracts the washing-machine model the live query used', () => {
    expect(extractStrongModelToken('Samsung WW90T554DAN')).toBe('WW90T554DAN');
  });

  it('extracts a TV model code too', () => {
    expect(extractStrongModelToken('UA55U8000FUXSA')).toBe('UA55U8000FUXSA');
  });

  it('does NOT treat ordinary shopping words, years, sizes or capacities as model codes', () => {
    for (const q of ['ايفون 17 برو 256', 'laptop', 'تلفزيون سامسونج ٥٥ بوصة', 'iphone 2025', '4K 55 inch', 'ثلاجة 500 لتر']) {
      expect(extractStrongModelToken(q)).toBeNull();
    }
  });

  it('matches a carrying title regardless of separators or suffixes', () => {
    const token = extractStrongModelToken('Samsung WW90T554DAN')!;
    expect(titleCarriesModelToken('', 'Samsung Washer WW90T554DAN/YL 9kg', token)).toBe(true);
    expect(titleCarriesModelToken('', 'Samsung Washer ww90-t554 dan', token)).toBe(true);
  });

  it('does not match the DIFFERENT model that production actually carries', () => {
    // Live fact (2026-09-29): WW90T554DAN is absent from the catalog; WW90T754DB exists.
    // A near-miss model must NOT be passed off as the requested one.
    const token = extractStrongModelToken('Samsung WW90T554DAN')!;
    expect(titleCarriesModelToken('', 'Samsung 9 kg Quick Drive Front Load Washing Machine | Model No WW90T754DB', token)).toBe(false);
  });

  it('does not match the unrelated accessories Q10 actually returned', () => {
    const token = extractStrongModelToken('Samsung WW90T554DAN')!;
    for (const title of [
      'Samsung Galaxy Buds Core Earbuds, Active Noise Cancelling',
      'SAMSUNG Galaxy Flip 6 Protection Film, Clear',
      'Samsung Microwave 23L, Black, Tact & Dial Control',
    ]) {
      expect(titleCarriesModelToken('', title, token)).toBe(false);
    }
  });
});

describe('F-005 · Q11 — Pro, Pro Max and base are different Commercial Variants', () => {
  it('reads Pro Max before Pro (order matters, or the leak survives)', () => {
    expect(phoneTierOf('Apple iPhone 17 Pro Max 256GB')).toBe('pro_max');
    expect(phoneTierOf('Apple iPhone 17 Pro 256GB')).toBe('pro');
    expect(phoneTierOf('Apple iPhone 17 256 GB')).toBe('base');
  });

  it('reads the Arabic request «برو» as Pro and «ماكس» as Pro Max', () => {
    expect(requestedPhoneTier('ايفون 17 برو 256')).toBe('pro');
    expect(requestedPhoneTier('ايفون 17 برو ماكس 256')).toBe('pro_max');
  });

  it('gates nothing when the shopper named no tier', () => {
    expect(requestedPhoneTier('ايفون 17 256')).toBeNull();
    expect(conflictsWithRequestedTier(null, '', 'Apple iPhone 17 Pro Max 256GB')).toBe(false);
  });

  it('excludes exactly the two leaks Q11 showed live, and keeps the two correct cards', () => {
    const requested = requestedPhoneTier('ايفون 17 برو 256');
    // leaked live at rank 1 and ranks 3-4
    expect(conflictsWithRequestedTier(requested, 'جوال آبل iPhone 17 Pro Max 256 جيجابايت', 'Apple iPhone 17 Pro Max 256GB')).toBe(true);
    expect(conflictsWithRequestedTier(requested, 'ايفون 17 سعة 256 جيجابايت', 'Apple iPhone 17 256 GB: 6.3-inch Display')).toBe(true);
    // correct live cards at ranks 2 and 5
    expect(conflictsWithRequestedTier(requested, 'جوال آبل iPhone 17 Pro 256 جيجابايت', 'Apple iPhone 17 Pro 256GB')).toBe(false);
    expect(conflictsWithRequestedTier(requested, 'جوال ابل ايفون 17 برو 256 جيجابايت', 'Apple iPhone 17 Pro 256 GB: 6.3-inch Display')).toBe(false);
  });
});

describe('normalizeAlnum', () => {
  it('strips separators and uppercases while preserving Arabic letters', () => {
    expect(normalizeAlnum('ww90-t554 dan/YL')).toBe('WW90T554DANYL');
    expect(normalizeAlnum('شاشة 55 بوصة')).toBe('شاشة55بوصة');
  });
});
