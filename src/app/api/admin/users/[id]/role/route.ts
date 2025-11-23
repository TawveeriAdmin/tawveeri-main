import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { createClient } from '@/lib/auth/server';
import { createAuditLog } from '@/lib/auth/audit';
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

    // Update user role
    const { error: updateError } = await supabase
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

