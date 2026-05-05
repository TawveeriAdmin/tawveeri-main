/**
 * Wishlist Utility Functions
 * Functions for managing wishlist and tracking save_count
 */

import { getSupabaseBrowserClient, createServerClient } from '@/lib/database';

const getSupabase = () =>
  typeof window === 'undefined' ? createServerClient() : getSupabaseBrowserClient();

/**
 * Increment product save_count when item added to wishlist
 */
export async function incrementSaveCount(productId: string): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data: product } = await supabase
      .from('products')
      .select('save_count')
      .eq('id', productId)
      .single();

    if (product) {
      await supabase
        .from('products')
        .update({ save_count: (product.save_count || 0) + 1 })
        .eq('id', productId);
    }
  } catch (error) {
    console.error('Error incrementing save_count:', error);
    // Non-blocking - don't fail wishlist operation if tracking fails
  }
}

/**
 * Decrement product save_count when item removed from wishlist
 */
export async function decrementSaveCount(productId: string): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data: product } = await supabase
      .from('products')
      .select('save_count')
      .eq('id', productId)
      .single();

    if (product && (product.save_count || 0) > 0) {
      await supabase
        .from('products')
        .update({ save_count: Math.max(0, (product.save_count || 0) - 1) })
        .eq('id', productId);
    }
  } catch (error) {
    console.error('Error decrementing save_count:', error);
    // Non-blocking - don't fail wishlist operation if tracking fails
  }
}

