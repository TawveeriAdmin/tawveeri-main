import { parseExtractedProducts } from '@/lib/firecrawl/search-enrichment';

describe('parseExtractedProducts', () => {
  const base = 'https://store.example.com/search?q=test';

  it('maps products and absolutizes relative URLs', () => {
    const rows = parseExtractedProducts(
      {
        products: [
          {
            title: 'Phone X',
            price_text: '1,299 SAR',
            product_url: '/p/phone-x',
            image_url: '//cdn.example.com/i.jpg',
          },
        ],
      },
      base,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Phone X');
    expect(rows[0].priceText).toBe('1,299 SAR');
    expect(rows[0].productUrl).toBe('https://store.example.com/p/phone-x');
    expect(rows[0].imageUrl).toBe('https://cdn.example.com/i.jpg');
  });

  it('skips rows without title or product_url', () => {
    expect(parseExtractedProducts({ products: [{ title: '', product_url: '/x' }] }, base)).toHaveLength(0);
    expect(parseExtractedProducts({ products: [{ title: 'A' }] }, base)).toHaveLength(0);
  });

  it('returns empty for non-object or missing products', () => {
    expect(parseExtractedProducts(null, base)).toEqual([]);
    expect(parseExtractedProducts({}, base)).toEqual([]);
  });
});
