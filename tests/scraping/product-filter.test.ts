import { filterTechProducts, isTechProduct } from '@/lib/scraping/product-filter';

describe('isTechProduct', () => {
  it('keeps clear electronics products', () => {
    expect(
      isTechProduct(
        'Apple iPhone 17 Pro Max 512GB',
        'Apple',
        'electronics'
      )
    ).toBe(true);
  });

  it('keeps electronics accessories', () => {
    expect(
      isTechProduct(
        'ArmorPro Case for iPhone 17 Pro Max',
        'ArmorPro',
        'mobile accessories'
      )
    ).toBe(true);
  });

  it('keeps USB accessories from a generic accessories category', () => {
    expect(
      isTechProduct(
        'USB C to USB A Adapter',
        'Unknown',
        'accessories'
      )
    ).toBe(true);
  });

  it('rejects non-tech products from a generic accessories category', () => {
    expect(
      isTechProduct(
        'Vintage Fridge Magnet God Bless This Home',
        'Unknown',
        'accessories'
      )
    ).toBe(false);
  });

  it('keeps e-reader accessories from a generic accessories category', () => {
    expect(
      isTechProduct(
        'Case for Kindle Paperwhite 12th Gen 2024 Released',
        'Unknown',
        'accessories'
      )
    ).toBe(true);
  });

  it('rejects produce-style apple items', () => {
    expect(
      isTechProduct(
        'Fresh Apple Royal Gala 1 KG',
        'ZOD',
        'grocery'
      )
    ).toBe(false);
  });

  it('rejects non-tech media products', () => {
    expect(
      isTechProduct(
        'Inspirational Novel Book',
        null,
        'books'
      )
    ).toBe(false);
  });
});

describe('filterTechProducts', () => {
  it('filters mixed non-tech items while keeping electronics', () => {
    const products = [
      { name_en: 'Samsung Galaxy S25 Ultra', brand: 'Samsung', category: 'smartphone' },
      { name_en: 'Fresh Apple Green 1 KG', brand: 'Local Farm', category: 'grocery' },
      { name_en: 'Laptop Backpack 15-inch', brand: 'Generic', category: 'accessories' },
      { name_en: 'Classic Novel Hardcover', brand: 'Publisher', category: 'books' },
    ];

    const filtered = filterTechProducts(products);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((p) => p.name_en)).toEqual([
      'Samsung Galaxy S25 Ultra',
      'Laptop Backpack 15-inch',
    ]);
  });
});
