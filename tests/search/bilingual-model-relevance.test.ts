/**
 * ADR-141 — a generic MODIFIER must not make a bilingual query unmatchable.
 *
 * Canonical products are named in Latin ("apple iPhone 16 Pro Max 256GB"). GENERIC used
 * to be applied per expansion TERM, so برو → ['برو','pro'] lost 'pro' and could then match
 * only the Arabic spelling — and the relevance gate dropped the very product asked for.
 * Measured on production: `ايفون 16 256` → 3 stores; `ايفون 16 برو` → 1 store.
 */
const GENERIC = new Set(['machine', 'electric', 'smart', 'digital', 'pro', 'max',
  'plus', 'mini', 'air', 'ultra', 'كهربائيه', 'كهربائي', 'ذكي', 'ذكيه', 'رقمي', 'هوائيه', 'hd', '4k']);

// Mirror of the route's expansion for the words under test.
const EXPAND: Record<string, string[]> = {
  'ايفون': ['ايفون', 'iphone', 'apple'],
  'برو': ['برو', 'pro'],
  'ماكس': ['ماكس', 'max'],
  '16': ['16'],
  '256': ['256'],
  'غساله': ['غساله', 'washing', 'machine', 'washer'],
};

const groupsFor = (words: string[]) => words
  .map((w) => (EXPAND[w] ?? [w]).filter((t) => t.length >= 2))
  .filter((g) => g.length > 0 && !g.every((t) => GENERIC.has(t)));

const matches = (name: string, groups: string[][]) => {
  const hay = name.toLowerCase();
  return groups.every((g) => g.some((t) => hay.includes(t)));
};

describe('bilingual model relevance (ADR-141)', () => {
  const CANONICAL = 'apple iPhone 16 Pro Max 256GB'.toLowerCase();

  it('an Arabic model query still reaches a Latin-named canonical', () => {
    const groups = groupsFor(['ايفون', '16', 'برو', 'ماكس', '256']);
    expect(matches(CANONICAL, groups)).toBe(true);
  });

  it('keeps every spelling of a word, so either language reaches the catalogue', () => {
    // برو survives as a group AND retains 'pro' — which is right: "iPhone 16 Pro" and
    // "iPhone 16" are different products, so Pro must be allowed to discriminate. What
    // changed is that it can now do so against a Latin-named canonical.
    expect(groupsFor(['برو'])).toEqual([['برو', 'pro']]);
    expect(matches(CANONICAL, groupsFor(['برو']))).toBe(true);
    expect(matches('apple iPhone 16 128GB', groupsFor(['برو']))).toBe(false);
    expect(groupsFor(['ايفون'])).toEqual([['ايفون', 'iphone', 'apple']]);
  });

  it('drops a group only when every spelling is generic', () => {
    // A word with no meaningful spelling in any script contributes nothing.
    expect(groupsFor(['smart'])).toEqual([]);
    expect(groupsFor(['4k'])).toEqual([]);
  });

  it('keeps a generic term when its word is NOT generic overall', () => {
    // غسالة expands to include the generic 'machine', but the word itself is meaningful,
    // so the whole group survives and "Washing Machine" stays reachable.
    const groups = groupsFor(['غساله']);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toContain('machine');
    expect(matches('Samsung Washing Machine 8kg', groups)).toBe(true);
  });

  it('the old per-term filter would have failed the Arabic query (regression guard)', () => {
    const oldGroups = ['ايفون', '16', 'برو', 'ماكس', '256']
      .map((w) => (EXPAND[w] ?? [w]).filter((t) => t.length >= 2 && !GENERIC.has(t)))
      .filter((g) => g.length > 0);
    expect(matches(CANONICAL, oldGroups)).toBe(false);
  });
});
