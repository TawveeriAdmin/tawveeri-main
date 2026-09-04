// tests/search/multi-category-expansion-matrix.test.ts
// Amazon multi-category expansion — final pre-launch query coverage (Sept 2026). Exercises
// the exact chain the /api/search response performs:
//   query -> parseShoppingTask().category (classifier) -> toStorefrontCategory() (mapping)
// 0 WRONG is required. A query intentionally stays NULL when its device category is
// materially ambiguous (a bare brand that spans multiple product categories, or a bare
// use-case/food term with no single device implication) — unknown beats incorrect, and this
// file pins WHY each such query is deliberately left unclassified, not silently ignored.
import { parseShoppingTask } from '@/lib/agent/task-parser';
import { toStorefrontCategory } from '@/lib/search/canonical-category';

function resolve(query: string): string | null {
  return toStorefrontCategory(parseShoppingTask(query).category || null);
}

describe('multi-category expansion — first-wave query coverage (0 WRONG required)', () => {
  const cases: Record<string, string[]> = {
    tablet: ['تابلت', 'تابلت هونر', 'هونر تابلت', 'ايباد', 'آيباد', 'ايباد للجامعة'],
    tv: ['تلفزيون', 'شاشة', 'شاشة سامسونج', 'تلفزيون 65 بوصة', 'تلفزيون TCL', 'سمارت تي في'],
    smartphone: ['جوال', 'ايفون', 'آيفون', 'ايفون 16', 'سامسونج جوال', 'جوال بميزانية 2000'],
    air_fryer: ['قلاية هوائية', 'اير فراير', 'ايرفراير'],
    coffee_machine: ['ماكينة قهوة', 'مكينة قهوة', 'آلة قهوة', 'ماكينة اسبريسو', 'نسبريسو', 'دولتشي قوستو'],
    vacuum: ['مكنسة', 'مكنسة كهربائية', 'مكنسة روبوت', 'روبوت تنظيف', 'مكنسة شاومي'],
    electric_kettle: ['غلاية', 'غلاية كهربائية', 'كاتل', 'غلاية فيليبس'],
    blender: ['خلاط', 'خلاط كهربائي', 'خلاط كينوود', 'نيوتربوليت'],
  };

  for (const [expected, queries] of Object.entries(cases)) {
    describe(expected.toUpperCase(), () => {
      it.each(queries)(`"%s" resolves to ${expected}`, (q) => {
        expect(resolve(q)).toBe(expected);
      });
    });
  }

  it('never mixes up a different approved category (0 WRONG, checked explicitly across every query above)', () => {
    const approvedValues = new Set(Object.keys(cases));
    for (const [expected, queries] of Object.entries(cases)) {
      for (const q of queries) {
        const got = resolve(q);
        if (got !== null && approvedValues.has(got)) {
          expect(got).toBe(expected); // if it resolved to an approved value, it must be the RIGHT one
        }
      }
    }
  });

  describe('INTENTIONALLY NULL — materially ambiguous, safety-justified (not a gap to fix)', () => {
    it('"جالكسي" (bare "Galaxy") stays unknown — Samsung Galaxy spans phones, tablets, watches, and buds', () => {
      expect(resolve('جالكسي')).toBeNull();
    });

    it('"قلاية"/"قلاية نينجا"/"قلاية فيليبس" stay unknown — Amazon.sa\'s own taxonomy files bare "قلاية" mainly under cookware frying PANS, not the air-fryer appliance; a brand name does not resolve that pan-vs-appliance ambiguity', () => {
      expect(resolve('قلاية')).toBeNull();
      expect(resolve('قلاية نينجا')).toBeNull();
      expect(resolve('قلاية فيليبس')).toBeNull();
    });

    it('"دايسون" (bare Dyson) stays unknown — Dyson sells vacuums, hair dryers/stylers, air purifiers, and fans; a bare brand mention cannot safely pick one device category', () => {
      expect(resolve('دايسون')).toBeNull();
    });

    it('"سموثي" (smoothie) stays unknown — names a drink/use-case, not a device; could equally mean grocery, a ready-made drink, or a cup/bottle listing, not necessarily a blender', () => {
      expect(resolve('سموثي')).toBeNull();
    });
  });
});
