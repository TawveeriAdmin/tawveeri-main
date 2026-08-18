import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { createClient } from '@/lib/auth/server';
import { createServerClient as createAdminClient } from '@/lib/database';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification, sendRoleChangedEmail } from '@/lib/auth/notifications';
import type { UserRole } from '@/lib/database/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    await requireAdmin();

    const { id } = await params;
    const { role } = await request.json();

    // Validate role
    const validRoles: UserRole[] = ['admin', 'customer', 'store', 'guest'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user for audit log
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    // Get user being updated
    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('role, email, full_name')
      .eq('id', id)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user role.
    //
    // ADR-259: this write runs with the SERVICE-ROLE client, not the caller's session.
    // Migration 36 revoked UPDATE on users.role from `authenticated` and added a trigger
    // that rejects any role change whose JWT role is not `service_role` — the same pair
    // of barriers that stops a normal user promoting themselves. Assigning a role is a
    // privileged server operation, so it is performed as one; authorization for it is
    // requireAdmin() above, never the database's opinion of the caller's own row.
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('users')
      .update({ role })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating user role:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      );
    }

    // Create audit log
    await createAuditLog({
      user_id: currentUser?.id || null,
      action: 'user_role_updated',
      entity_type: 'user',
      entity_id: id,
      details: {
        old_role: targetUser.role,
        new_role: role,
        target_user_email: targetUser.email,
        target_user_name: targetUser.full_name,
      },
    });

    // In-app notification to target user
    await createNotification({
      user_id: id,
      type: 'system',
      title_ar: 'تم تغيير صلاحياتك',
      title_en: 'Your Role Has Been Changed',
      message_ar: `تم تغيير دورك من "${targetUser.role}" إلى "${role}"`,
      message_en: `Your role has been changed from "${targetUser.role}" to "${role}"`,
    });

    // Email notification to target user
    if (targetUser.email) {
      sendRoleChangedEmail(
        targetUser.email,
        { old_role: targetUser.role, new_role: role },
      ).catch((err) => console.error('Failed to send role changed email:', err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in user role update API:', error);
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

