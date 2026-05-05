/**
 * Product Reviews Utility Functions
 * Functions for managing product reviews
 */

import { getSupabaseBrowserClient, createServerClient } from '@/lib/database';
import type { ProductReview } from '@/lib/database/types';

const getSupabase = () =>
  typeof window === 'undefined' ? createServerClient() : getSupabaseBrowserClient();

export interface ProductReviewWithUser extends ProductReview {
  users?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface CreateProductReviewParams {
  productId: string;
  userId: string;
  rating: number;
  reviewText: string;
  isVerified: boolean;
}

export interface UpdateProductReviewParams {
  reviewId: string;
  userId: string;
  rating?: number;
  reviewText?: string;
}

/**
 * Create a product review
 */
export async function createProductReview(
  params: CreateProductReviewParams
): Promise<{ data: ProductReview | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Check if user already reviewed this product
    const { data: existingReview } = await supabase
      .from('product_reviews')
      .select('id')
      .eq('product_id', params.productId)
      .eq('user_id', params.userId)
      .single();

    if (existingReview) {
      return { data: null, error: new Error('User has already reviewed this product') };
    }

    const { data, error } = await supabase
      .from('product_reviews')
      .insert({
        product_id: params.productId,
        user_id: params.userId,
        rating: params.rating,
        review_text: params.reviewText,
        is_verified_purchase: params.isVerified,
      })
      .select()
      .single();

    if (error) throw error;
    return { data: data as ProductReview, error: null };
  } catch (error) {
    console.error('Error creating product review:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get product reviews with pagination
 */
export async function getProductReviews(
  productId: string,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'newest' | 'oldest' | 'rating';
  }
): Promise<{ data: ProductReviewWithUser[] | null; count: number | null; error: Error | null }> {
  try {
    const supabase = getSupabase();
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;

    // Build query
    let query = supabase
      .from('product_reviews')
      .select(
        `
        *,
        users (
          id,
          full_name,
          avatar_url
        )
      `,
        { count: 'exact' }
      )
      .eq('product_id', productId)
      .range(offset, offset + limit - 1);

    // Apply sorting
    switch (options?.sortBy) {
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'rating':
        query = query.order('rating', { ascending: false }); // Highest rating first
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { data: data as ProductReviewWithUser[], count: count || null, error: null };
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    return { data: null, count: null, error: error as Error };
  }
}

/**
 * Update a product review
 */
export async function updateProductReview(
  params: UpdateProductReviewParams
): Promise<{ data: ProductReview | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Verify user owns the review
    const { data: review } = await supabase
      .from('product_reviews')
      .select('user_id')
      .eq('id', params.reviewId)
      .single();

    if (!review || review.user_id !== params.userId) {
      return { data: null, error: new Error('User does not own this review') };
    }

    const updates: { rating?: number; review_text?: string } = {};
    if (params.rating !== undefined) updates.rating = params.rating;
    if (params.reviewText !== undefined) updates.review_text = params.reviewText;

    const { data, error } = await supabase
      .from('product_reviews')
      .update(updates)
      .eq('id', params.reviewId)
      .select()
      .single();

    if (error) throw error;
    return { data: data as ProductReview, error: null };
  } catch (error) {
    console.error('Error updating product review:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Delete a product review
 */
export async function deleteProductReview(
  reviewId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Verify user owns the review
    const { data: review } = await supabase
      .from('product_reviews')
      .select('user_id')
      .eq('id', reviewId)
      .single();

    if (!review || review.user_id !== userId) {
      return { error: new Error('User does not own this review') };
    }

    const { error } = await supabase.from('product_reviews').delete().eq('id', reviewId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting product review:', error);
    return { error: error as Error };
  }
}

/**
 * Mark a review as helpful
 */
export async function markReviewHelpful(
  reviewId: string,
  userId: string
): Promise<{ data: ProductReview | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Get current helpful count
    const { data: review, error: fetchError } = await supabase
      .from('product_reviews')
      .select('helpful_count')
      .eq('id', reviewId)
      .single();

    if (fetchError) throw fetchError;
    if (!review) throw new Error('Review not found');

    // Increment helpful count
    const { data: updated, error: updateError } = await supabase
      .from('product_reviews')
      .update({ helpful_count: (review.helpful_count || 0) + 1 })
      .eq('id', reviewId)
      .select()
      .single();

    if (updateError) throw updateError;
    return { data: updated as ProductReview, error: null };
  } catch (error) {
    console.error('Error marking review as helpful:', error);
    return { data: null, error: error as Error };
  }
}

