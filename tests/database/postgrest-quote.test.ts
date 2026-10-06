// tests/database/postgrest-quote.test.ts — a title containing a double quote must not corrupt a PostgREST `or`/`in` list (2026-10-06: the storefront-row lookup
// for identity-less cards silently returned nothing for every chunk holding a `14"` laptop title).
import { postgrestQuote } from '@/lib/database/postgrest-quote';

const BS = String.fromCharCode(92);

describe('postgrestQuote', () => {
  it('wraps a plain value in double quotes', () => {
    expect(postgrestQuote('Apple MacBook Air')).toBe('"Apple MacBook Air"');
  });
  it('escapes an inner double quote and a backslash, so one odd title cannot break the list', () => {
    expect(postgrestQuote('HP Elitebook 14" FHD')).toBe('"HP Elitebook 14' + BS + '" FHD"');
    expect(postgrestQuote('a' + BS + 'b')).toBe('"a' + BS + BS + 'b"');
  });
  it('keeps commas, parentheses and colons inside the quotes (they are list/syntax characters otherwise)', () => {
    expect(postgrestQuote('Laptop, 16GB (512GB): Silver')).toBe('"Laptop, 16GB (512GB): Silver"');
  });
  it('builds an or-list whose terms stay separate however odd the titles are', () => {
    const titles = ['ASUS 15.6" FHD, 16GB', 'plain'];
    expect(titles.map((n) => `name_ar.eq.${postgrestQuote(n)}`).join(',')).toBe('name_ar.eq."ASUS 15.6' + BS + '" FHD, 16GB",name_ar.eq."plain"');
  });
});
