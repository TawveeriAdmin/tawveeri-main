import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

/**
 * POST /api/products/[id]/comparison
 * Track product comparison count
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    // Get current comparison_count
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('comparison_count')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const newCount = (product?.comparison_count || 0) + 1;

    // Increment comparison_count atomically
    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update({ comparison_count: newCount })
      .eq('id', id)
      .select('comparison_count')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ comparison_count: updated.comparison_count });
  } catch (error) {
    console.error('Error tracking product comparison:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to track comparison' },
      { status: 500 }
    );
  }
}

