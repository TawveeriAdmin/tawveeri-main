import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';
import { createNotification, sendAccountDeletedEmail } from '@/lib/auth/notifications';
import { createAuditLog } from '@/lib/auth/audit';

/**
 * POST /api/auth/delete-account
 * Server-side account deletion with email + audit log
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Fetch user info before deletion
    const { data: userInfo } = await supabase
      .from('users')
      .select('email, full_name, preferred_language')
      .eq('id', user.id)
      .single();

    // Send confirmation email BEFORE deletion (persists externally)
    if (userInfo?.email) {
      await sendAccountDeletedEmail(
        userInfo.email,
        { full_name: userInfo.full_name },
        (userInfo.preferred_language as 'ar' | 'en') || 'ar',
      );
    }

    // Audit log BEFORE deletion (server-side, will persist)
    await createAuditLog({
      user_id: user.id,
      action: 'account_deleted',
      entity_type: 'user',
      entity_id: user.id,
      details: { email: userInfo?.email, full_name: userInfo?.full_name },
    });

    // Delete avatar storage
    const { data: avatarData } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (avatarData?.avatar_url) {
      try {
        const url = new URL(avatarData.avatar_url);
        const filePath = url.pathname.split('/').slice(-2).join('/');
        await supabase.storage.from('user-avatars').remove([filePath]);
      } catch {
        // Non-fatal
      }
    }

    // Delete user from database (cascade handles related records)
    const { error: dbError } = await supabase.from('users').delete().eq('id', user.id);
    if (dbError) {
      console.error('Error deleting user from DB:', dbError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    // Delete from Supabase Auth
    await supabase.auth.admin.deleteUser(user.id).catch((err) =>
      console.error('Error deleting from auth:', err)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete-account API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
