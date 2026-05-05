import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification, sendPasswordChangedEmail } from '@/lib/auth/notifications';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, language } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // In-app notification
    await createNotification({
      user_id: userId,
      type: 'system',
      title_ar: 'تم تغيير كلمة المرور',
      title_en: 'Password Changed',
      message_ar: 'تم تغيير كلمة المرور الخاصة بحسابك بنجاح. إذا لم تقم بهذا التغيير، يرجى الاتصال بنا فوراً.',
      message_en: 'Your account password has been changed successfully. If you didn\'t make this change, please contact us immediately.',
    });

    // Email notification
    if (email) {
      await sendPasswordChangedEmail(email, language || 'ar');
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'password_changed',
      entity_type: 'user',
      entity_id: userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password changed notify error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
