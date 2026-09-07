// Synonym system closure (2026-09-07): the "products" index publish must carry every
// approved group EXCEPT the two live-proven-unsafe bare words (see
// scripts/sync-products-synonyms.ts's own doc comment for the live evidence), and must
// never silently drop a whole group or corrupt an unrelated one while doing so.
import { getSafeProductsSynonymGroups } from '../../scripts/sync-products-synonyms';
import { SAUDI_SEARCH_SYNONYMS } from '../../src/lib/search/query-normalize';

describe('getSafeProductsSynonymGroups', () => {
  const safe = getSafeProductsSynonymGroups();

  it('keeps every approved group — none dropped entirely', () => {
    expect(safe.length).toBe(SAUDI_SEARCH_SYNONYMS.length);
  });

  it('removes bare "screen" from the TV group (live-proven cross-category leak: smartwatch, kids tablets, air fryer, zero real TVs)', () => {
    const tvGroup = safe.find((g) => g.includes('تلفزيون'));
    expect(tvGroup).toBeDefined();
    expect(tvGroup).not.toContain('screen');
    // the rest of the group must survive untouched
    expect(tvGroup).toEqual(expect.arrayContaining(['شاشة', 'شاشات', 'تلفزيون', 'تلفاز', 'تي في', 'television', 'tv']));
  });

  it('removes singular "عرض" from the deal group (live-proven width-spec collision: kettle, projector, fryer, monitor)', () => {
    const dealGroup = safe.find((g) => g.includes('خصم'));
    expect(dealGroup).toBeDefined();
    expect(dealGroup).not.toContain('عرض');
    // plural "عروض" carries no such ambiguity in retail Arabic — kept
    expect(dealGroup).toContain('عروض');
    expect(dealGroup).toEqual(expect.arrayContaining(['رخيص', 'ارخص', 'خصم', 'تخفيض', 'cheap', 'offer', 'deal', 'discount']));
  });

  it('leaves every other group byte-identical to SAUDI_SEARCH_SYNONYMS', () => {
    const untouched = safe.filter((g) => !g.includes('تلفزيون') && !g.includes('خصم'));
    const untouchedSource = SAUDI_SEARCH_SYNONYMS.filter((g) => !g.includes('تلفزيون') && !g.includes('خصم'));
    expect(untouched).toEqual(untouchedSource);
  });

  it('proven-necessary terms survive the filter (Honor, تلفون, قلاكسي, تكييف — the live-proven zero/wrong-result cases)', () => {
    const flat = safe.flat();
    expect(flat).toEqual(expect.arrayContaining(['هونر', 'هورنر', 'هونور', 'honer', 'horno', 'تلفون', 'قلاكسي', 'تكييف']));
  });

  it('every group still has at least 2 interchangeable terms after filtering', () => {
    safe.forEach((g) => expect(g.length).toBeGreaterThanOrEqual(2));
  });
});
