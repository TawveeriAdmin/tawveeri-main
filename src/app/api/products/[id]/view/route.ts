import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { getSession } from '@/lib/auth/server';

/**
 * POST /api/products/[id]/view
 * Track product view count + per-user view for recommendations
 * Dedup: one per-user view per product per hour
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    // Get current view_count
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('view_count')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const newCount = (product?.view_count || 0) + 1;

    // Increment global view_count
    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update({ view_count: newCount })
      .eq('id', id)
      .select('view_count')
      .single();

    if (updateError) throw updateError;

    // Track per-user view for AI recommendations (non-blocking)
    try {
      const session = await getSession();
      if (session?.user?.id) {
        const userId = session.user.id;
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        // Check if user already viewed this product in the last hour
        const { data: recentView } = await supabase
          .from('product_views')
          .select('id')
          .eq('user_id', userId)
          .eq('product_id', id)
          .gte('viewed_at', oneHourAgo)
          .limit(1)
          .single();

        // Only insert if no recent view exists
        if (!recentView) {
          await supabase
            .from('product_views')
            .insert({ user_id: userId, product_id: id });
        }
      }
    } catch {
      // Per-user tracking is non-blocking — never fail the main request
    }

    return NextResponse.json({ view_count: updated.view_count });
  } catch (error) {
    console.error('Error tracking product view:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to track view' },
      { status: 500 }
    );
  }
}

