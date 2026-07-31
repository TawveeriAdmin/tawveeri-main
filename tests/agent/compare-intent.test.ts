// Comparison-intent detection.
//
// The governing rule for this unit is that comparison intent must never route to a
// comparison that cannot be delivered. Detection is the first half of that: reading a
// two-product request as a one-product one would offer a comparison page for half of what
// was asked, which is a wrong answer wearing a correct-looking badge.
import { detectCompareIntent, normalizeAr } from '@/lib/agent/compare-intent';

describe('two-product requests are read as pairs', () => {
  const PAIRS: Array<[string, string, string]> = [
    ['قارن بين ايفون 16 و جالكسي s24', 'ايفون 16', 'جالكسي s24'],
    ['الفرق بين ايفون 16 وجالكسي s24 ؟', 'ايفون 16 وجالكسي s24', ''], // attached و — see below
    ['ايهما افضل ايفون 16 او جالكسي s24', 'ايفون 16', 'جالكسي s24'],
    ['iphone 16 vs galaxy s24', 'iphone 16', 'galaxy s24'],
    ['compare iphone 16 and galaxy s24', 'iphone 16', 'galaxy s24'],
    ['difference between iphone 16 and galaxy s24', 'iphone 16', 'galaxy s24'],
    ['قارن ايفون 16 مقابل جالكسي s24', 'ايفون 16', 'جالكسي s24'],
  ];

  it.each(PAIRS.filter((p) => p[2]))('%s → pair', (text, a, b) => {
    const i = detectCompareIntent(text);
    if (i.kind !== 'pair') throw new Error(`expected pair, got ${i.kind}`);
    expect(i.subjects[0]).toContain(a.split(' ')[0]);
    expect(i.subjects[1]).toContain(b.split(' ')[0]);
  });

  it('an ATTACHED «و» is not a separator — it would slice inside a word', () => {
    // «وجالكسي» is "and Galaxy" written as one token. Splitting on a bare «و» would cut
    // real words in half and put the fragments in front of the customer as product names.
    // Only a space-delimited « و » separates, so this stays a single subject rather than
    // becoming two invented ones.
    const i = detectCompareIntent('الفرق بين ايفون 16 وجالكسي s24');
    expect(i.kind).toBe('single');
  });
});

describe('one-product price-comparison requests', () => {
  const SINGLES = [
    'قارن اسعار ايفون 16',
    'مقارنه اسعار ايفون 16',
    'وين ارخص ايفون 16',
    'ارخص سعر ايفون 16',
    'compare prices for iphone 16',
    'best price iphone 16',
    'cheapest iphone 16',
  ];
  it.each(SINGLES)('%s → single', (text) => {
    const i = detectCompareIntent(text);
    if (i.kind !== 'single') throw new Error(`expected single, got ${i.kind}: ${JSON.stringify(i)}`);
    expect(i.subject.length).toBeGreaterThanOrEqual(3);
  });
});

describe('a pair marker wins over a single marker', () => {
  it('«قارن بين X و Y» is a pair, never a single — it contains «قارن»', () => {
    const i = detectCompareIntent('قارن بين ايفون 16 و جالكسي s24');
    expect(i.kind).toBe('pair');
  });
});

describe('queries that are not comparison requests', () => {
  const NONE = [
    'ايفون 16',
    'لابتوب للالعاب تحت 5000',
    'مكيف لغرفة 30 متر',
    'iphone 16 128gb',
    'washing machine',
    '',
    '   ',
  ];
  it.each(NONE)('%s → none', (text) => {
    expect(detectCompareIntent(text).kind).toBe('none');
  });

  it('the word "and" alone does not make a comparison', () => {
    // Without a comparison marker, "X and Y" is just a phrase.
    expect(detectCompareIntent('iphone 16 and case').kind).toBe('none');
  });
});

describe('Arabic normalisation', () => {
  it('folds the orthographic variants the markers are written against', () => {
    expect(normalizeAr('أيهما أفضل')).toBe('ايهما افضل');
    expect(normalizeAr('المقارنة')).toBe('المقارنه');
    expect(normalizeAr('إيفون')).toBe('ايفون');
    expect(normalizeAr('مُقارَنة')).toBe('مقارنه');
  });

  it('detects intent regardless of which variant the shopper typed', () => {
    expect(detectCompareIntent('أيهما أفضل آيفون 16 أو جالكسي s24').kind).toBe('pair');
    expect(detectCompareIntent('قارن أسعار آيفون 16').kind).toBe('single');
  });
});

describe('a subject too short to be a product is not invented', () => {
  it('refuses to split when one side is a fragment', () => {
    const i = detectCompareIntent('قارن بين ايفون و');
    expect(i.kind).not.toBe('pair');
  });
});
