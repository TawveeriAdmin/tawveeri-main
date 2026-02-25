import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth/api-auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/auth/audit';

const VALID_ACTIONS = new Set(Object.values(AUDIT_ACTIONS));

/**
 * POST /api/audit
 * Client-side audit logging endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { action, entity_type, entity_id, details } = await request.json();

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Invalid or missing action' }, { status: 400 });
    }

    await createAuditLog({
      user_id: user.id,
      action,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      details: details || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in audit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
