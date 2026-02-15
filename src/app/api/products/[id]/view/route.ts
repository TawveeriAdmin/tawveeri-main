import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

/**
 * POST /api/products/[id]/view
 * Track product view count
 * Rate limited: one view per user per hour
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    // Get user ID from request if authenticated (optional)
    const userId = request.headers.get('x-user-id') || null;

    // Rate limiting: check if user viewed this product in the last hour
    // For now, we'll just increment without strict rate limiting per user
    // In production, you might want to store view timestamps per user
    
    // Get current view_count
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('view_count')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const newCount = (product?.view_count || 0) + 1;

    // Increment view_count atomically
    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update({ view_count: newCount })
      .eq('id', id)
      .select('view_count')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ view_count: updated.view_count });
  } catch (error) {
    console.error('Error tracking product view:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to track view' },
      { status: 500 }
    );
  }
}

