/**
 * Database Query Tests
 * Tests common query patterns and operations
 */

import { supabase } from '@/lib/database';
import type { ProductCategory } from '@/lib/database/types';

describe('Product Queries', () => {
  it('should search products by brand', async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('brand', 'Apple')
      .eq('is_active', true);

    expect(error).toBeNull();
    if (data) {
      expect(data.every((p) => p.brand === 'Apple')).toBe(true);
    }
  });

  it('should filter products by category', async () => {
    const category: ProductCategory = 'laptop';
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', category);

    expect(error).toBeNull();
    if (data) {
      expect(data.every((p) => p.category === category)).toBe(true);
    }
  });

  it('should get product with all store prices', async () => {
    const { data, error } = await supabase
      .from('products')
      .select(
        `
        *,
        product_stores(
          *,
          stores(*)
        )
      `
      )
      .limit(1)
      .single();

    expect(error).toBeNull();
    if (data) {
      expect(data.product_stores).toBeDefined();
      expect(Array.isArray(data.product_stores)).toBe(true);
    }
  });

  it('should sort products by popularity (view count)', async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('view_count', { ascending: false })
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Price Comparison Queries', () => {
  it('should get lowest price for a product', async () => {
    // Get a product first
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .limit(1)
      .single();

    if (product) {
      const { data, error } = await supabase
        .from('product_stores')
        .select('current_price, stores(name_en)')
        .eq('product_id', product.id)
        .order('current_price', { ascending: true })
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (data) {
        expect(typeof data.current_price).toBe('number');
      }
    }
  });

  it('should get all prices for a product sorted by price', async () => {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .limit(1)
      .single();

    if (product) {
      const { data, error } = await supabase
        .from('product_stores')
        .select(
          `
          current_price,
          original_price,
          availability,
          stores(name_en, name_ar)
        `
        )
        .eq('product_id', product.id)
        .order('current_price', { ascending: true });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  it('should filter by availability', async () => {
    const { data, error } = await supabase
      .from('product_stores')
      .select('*, products(*), stores(*)')
      .eq('availability', 'in_stock')
      .limit(10);

    expect(error).toBeNull();
    if (data) {
      expect(data.every((ps) => ps.availability === 'in_stock')).toBe(true);
    }
  });

  it('should find products with deals', async () => {
    const { data, error } = await supabase
      .from('product_stores')
      .select('*, products(*), stores(*)')
      .eq('is_deal', true)
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Store Queries', () => {
  it('should get featured stores', async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('is_featured', true)
      .eq('status', 'active');

    expect(error).toBeNull();
    if (data) {
      expect(data.every((s) => s.is_featured === true)).toBe(true);
    }
  });

  it('should get stores with ratings', async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('name_en, average_rating, total_reviews')
      .eq('status', 'active')
      .order('average_rating', { ascending: false })
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should get store with all products', async () => {
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (store) {
      const { data, error } = await supabase
        .from('product_stores')
        .select(
          `
          *,
          products(*)
        `
        )
        .eq('store_id', store.id)
        .limit(10);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    }
  });
});

describe('Search and Filter Queries', () => {
  it('should perform text search on product names', async () => {
    const searchTerm = 'iPhone';
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .or(`name_en.ilike.%${searchTerm}%,name_ar.ilike.%${searchTerm}%`)
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should filter by multiple criteria', async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', 'smartphone')
      .eq('brand', 'Apple')
      .eq('is_active', true);

    expect(error).toBeNull();
    if (data) {
      expect(
        data.every(
          (p) =>
            p.category === 'smartphone' && p.brand === 'Apple' && p.is_active
        )
      ).toBe(true);
    }
  });

  it('should filter products by specification', async () => {
    // Example: Find smartphones with 256GB storage
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', 'smartphone')
      .contains('specifications', { storage: '256GB' });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Pagination Queries', () => {
  it('should paginate products', async () => {
    const pageSize = 10;
    const page = 1;

    const { data, error, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(typeof count).toBe('number');
    if (data) {
      expect(data.length).toBeLessThanOrEqual(pageSize);
    }
  });

  it('should get total count without data', async () => {
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    expect(error).toBeNull();
    expect(typeof count).toBe('number');
  });
});
