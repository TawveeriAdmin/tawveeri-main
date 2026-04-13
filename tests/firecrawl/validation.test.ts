import {
  isAllowedProductUrl,
  isUrlLikeTitle,
  isValidFirecrawlProduct,
  isValidHttpsImageUrl,
} from '@/lib/firecrawl/validation';

describe('firecrawl validation', () => {
  it('isUrlLikeTitle detects URLs and domain-like junk', () => {
    expect(isUrlLikeTitle('https://example.com/p/1')).toBe(true);
    expect(isUrlLikeTitle('www.foo.com/bar')).toBe(true);
    expect(isUrlLikeTitle('Samsung Galaxy S24')).toBe(false);
    expect(isUrlLikeTitle('  ')).toBe(true);
  });

  it('isAllowedProductUrl restricts to same host as listing', () => {
    const base = 'https://shop.example.com/list';
    expect(isAllowedProductUrl('https://shop.example.com/product/x', base)).toBe(true);
    expect(isAllowedProductUrl('https://evil.com/product/x', base)).toBe(false);
  });

  it('isValidHttpsImageUrl allows missing, requires https when set', () => {
    expect(isValidHttpsImageUrl(undefined)).toBe(true);
    expect(isValidHttpsImageUrl('https://cdn.test/img.jpg')).toBe(true);
    expect(isValidHttpsImageUrl('http://cdn.test/img.jpg')).toBe(false);
  });

  it('isValidFirecrawlProduct enforces title, price, url, image rules', () => {
    const base = 'https://store.test/';
    expect(
      isValidFirecrawlProduct(
        {
          title: 'Good Product Name',
          priceText: '999 SAR',
          productUrl: 'https://store.test/p/1',
          imageUrl: 'https://store.test/i.jpg',
        },
        base,
      ),
    ).toBe(true);

    expect(
      isValidFirecrawlProduct(
        {
          title: 'https://store.test/',
          priceText: '999 SAR',
          productUrl: 'https://store.test/p/1',
        },
        base,
      ),
    ).toBe(false);

    expect(
      isValidFirecrawlProduct(
        {
          title: 'Name',
          priceText: 'N/A',
          productUrl: 'https://store.test/p/1',
        },
        base,
      ),
    ).toBe(false);
  });
});
