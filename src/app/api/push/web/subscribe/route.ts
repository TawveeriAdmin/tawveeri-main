import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAuth } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';

/**
 * POST /api/push/web/subscribe — Save web push subscription
 * DELETE /api/push/web/subscribe — Remove web push subscription
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestAuth(request);
    const { endpoint, keys } = await request.json();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid subscription: endpoint and keys required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Read existing preferences
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('notification_preferences')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentPrefs = (existing?.notification_preferences as Record<string, unknown>) || {};

    const updatedPrefs = {
      ...currentPrefs,
      web_push_subscription: { endpoint, keys },
      web_push_enabled: true,
      web_push_registered_at: new Date().toISOString(),
    };

    // Upsert user_preferences
    await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          notification_preferences: updatedPrefs,
        },
        { onConflict: 'user_id' }
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Authentication required' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRequestAuth(request);
    const supabase = createServerClient();

    // Read existing preferences
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('notification_preferences')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ success: true });
    }

    const currentPrefs = (existing.notification_preferences as Record<string, unknown>) || {};
    delete currentPrefs.web_push_subscription;
    currentPrefs.web_push_enabled = false;

    await supabase
      .from('user_preferences')
      .update({ notification_preferences: currentPrefs })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Authentication required' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
