import { NextRequest, NextResponse } from 'next/server';
import { trackConversion } from '@/lib/transactions/tracking';

export async function POST(request: NextRequest) {
  try {
    const { click_id, amount, metadata } = await request.json();

    if (!click_id) {
      return NextResponse.json(
        { error: 'click_id is required' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'amount must be a positive number' },
        { status: 400 }
      );
    }

    // Track conversion
    const result = await trackConversion(click_id, amount, metadata);

    if (result.error) {
      console.error('Error tracking conversion:', result.error);
      return NextResponse.json(
        { error: result.error.message || 'Failed to track conversion' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in conversion tracking API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

