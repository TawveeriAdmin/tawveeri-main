// Intent Router follow-up (ADR-270 consolidated list, 2026-08-23): the screen-size regex
// inside extractSpecsFromTitle() is the SAME extraction task-parser.ts reuses for
// `screen_size_requested` (ADR-270 §5/B1) — a gap here silently breaks both product-title
// spec filtering AND the TV size routing/mismatch-disclosure signal at once.
import { extractSpecsFromTitle } from '@/lib/scraping/config/spec-configs';

describe('extractSpecsFromTitle — screen_size dialect spelling ("انش")', () => {
  it('accepts the dialect spelling "انش" alongside the formal "بوصة"', () => {
    expect(extractSpecsFromTitle('تلفزيون سامسونج 55 انش').screen_size).toBe('55');
    expect(extractSpecsFromTitle('تلفزيون 55 إنش سمارت').screen_size).toBe('55');
  });

  it('does not regress the existing spellings', () => {
    expect(extractSpecsFromTitle('تلفزيون 55 بوصة').screen_size).toBe('55');
    expect(extractSpecsFromTitle('55-inch Smart TV').screen_size).toBe('55');
    expect(extractSpecsFromTitle('TV 55"').screen_size).toBe('55');
    expect(extractSpecsFromTitle('15.6 inch laptop').screen_size).toBe('16'); // rounds
  });

  it('a bare number with no unit word is never read as a screen size', () => {
    expect(extractSpecsFromTitle('تلفزيون سامسونج 55').screen_size).toBeUndefined();
  });
});
