import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { getRequestUser } from '@/lib/auth/api-auth';
import { createNotification, sendNewDeviceLoginEmail } from '@/lib/auth/notifications';
import { createAuditLog } from '@/lib/auth/audit';
import { createHash } from 'crypto';

/**
 * POST /api/auth/check-device
 * Checks if a login is from a new device and sends notifications if so
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userAgent = request.headers.get('user-agent') || 'unknown';
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '0.0.0.0';

    // Generate device fingerprint from user agent + partial IP
    const ipParts = ip.split('.').slice(0, 3).join('.');
    const fingerprint = createHash('sha256').update(`${userAgent}:${ipParts}`).digest('hex');

    const supabase = createServerClient();

    // Try to upsert into login_sessions
    const { data: existing } = await supabase
      .from('login_sessions')
      .select('id, is_known_device')
      .eq('user_id', user.id)
      .eq('device_fingerprint', fingerprint)
      .maybeSingle();

    if (existing) {
      // Known device - just update last_seen_at
      await supabase
        .from('login_sessions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', existing.id);

      return NextResponse.json({ is_new_device: false });
    }

    // New device - insert and notify
    await supabase.from('login_sessions').insert({
      user_id: user.id,
      device_fingerprint: fingerprint,
      user_agent: userAgent,
      ip_address: ip,
      is_known_device: true,
    });

    // Parse user agent for a friendlier device name
    const deviceInfo = parseDeviceInfo(userAgent);
    const loginTime = new Date().toLocaleString('en-US');

    // In-app notification
    await createNotification({
      user_id: user.id,
      type: 'system',
      title_ar: 'تسجيل دخول من جهاز جديد',
      title_en: 'Login from New Device',
      message_ar: `تم تسجيل دخول إلى حسابك من جهاز جديد: ${deviceInfo}`,
      message_en: `Your account was accessed from a new device: ${deviceInfo}`,
    });

    // Email notification
    const { data: profile } = await supabase
      .from('users')
      .select('email, preferred_language')
      .eq('id', user.id)
      .single();

    if (profile?.email) {
      sendNewDeviceLoginEmail(
        profile.email,
        { device_info: deviceInfo, login_time: loginTime },
        (profile.preferred_language as 'ar' | 'en') || 'ar',
      ).catch(() => {});
    }

    // Audit log
    createAuditLog({
      user_id: user.id,
      action: 'new_device_login',
      entity_type: 'user',
      entity_id: user.id,
      details: { device_info: deviceInfo, ip_address: ip },
      user_agent: userAgent,
      ip_address: ip,
    }).catch(() => {});

    return NextResponse.json({ is_new_device: true });
  } catch (error) {
    console.error('Error in device check:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseDeviceInfo(ua: string): string {
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Windows')) return 'Windows PC';
  if (ua.includes('Macintosh')) return 'Mac';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown Device';
}
