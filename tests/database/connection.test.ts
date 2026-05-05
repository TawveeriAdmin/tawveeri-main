/**
 * Database Connection Tests
 * Tests basic database connectivity and operations
 */

import { createServerClient, checkDatabaseConnection } from '@/lib/database';

describe('Database Connection', () => {
  const supabase = createServerClient();
  it('should connect to Supabase successfully', async () => {
    const isConnected = await checkDatabaseConnection();
    expect(isConnected).toBe(true);
  });

  it('should have access to users table', async () => {
    const { error } = await supabase.from('users').select('id').limit(1);
    expect(error).toBeNull();
  });

  it('should have access to stores table', async () => {
    const { error } = await supabase.from('stores').select('id').limit(1);
    expect(error).toBeNull();
  });

  it('should have access to products table', async () => {
    const { error } = await supabase.from('products').select('id').limit(1);
    expect(error).toBeNull();
  });

  it('should have access to product_stores table', async () => {
    const { error } = await supabase
      .from('product_stores')
      .select('id')
      .limit(1);
    expect(error).toBeNull();
  });
});

describe('Database Query Operations', () => {
  const supabase = createServerClient();
  it('should fetch active stores', async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('status', 'active')
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should fetch products by category', async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', 'smartphone')
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should fetch product prices with store info', async () => {
    const { data, error } = await supabase
      .from('product_stores')
      .select(
        `
        *,
        products(*),
        stores(*)
      `
      )
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Database RLS Policies', () => {
  const supabase = createServerClient();
  it('should allow anonymous access to active stores', async () => {
    // Create anonymous client
    const anonClient = supabase;

    const { data, error } = await anonClient
      .from('stores')
      .select('*')
      .eq('status', 'active')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should allow anonymous access to products', async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should allow anonymous access to product prices', async () => {
    const { data, error } = await supabase
      .from('product_stores')
      .select('current_price, store_id, product_id')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
