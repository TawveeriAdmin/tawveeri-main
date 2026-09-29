import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/database';
import { POST } from '@/app/api/auth/reset-password-phone/route';

jest.mock('@/lib/database', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/auth/notifications', () => ({ createNotification: jest.fn(), sendPasswordChangedEmail: jest.fn() }));
jest.mock('@/lib/auth/audit', () => ({ createAuditLog: jest.fn(), AUDIT_ACTIONS: { PASSWORD_CHANGED: 'password_changed' } }));

describe('password reset consumes the account-bound challenge before side effects', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  let consumed: boolean;
  let rpc: jest.Mock;
  let update: jest.Mock;
  const request = () => new NextRequest('http://localhost/api/auth/reset-password-phone', {
    method: 'POST', body: JSON.stringify({ phone: '0501234567', otp: '123456', newPassword: 'fixture-password', account_id: 'attacker-selected-id', purpose: 'phone_signin' }),
  });
  beforeEach(() => {
    consumed = false;
    rpc = jest.fn(async () => {
      const accepted = !consumed;
      consumed = true;
      return { data: accepted, error: null };
    });
    update = jest.fn(async () => ({ error: null }));
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: async () => ({ data: { id, email: null }, error: null }) };
    (createServerClient as jest.Mock).mockReturnValue({ from: () => query, rpc, auth: { admin: { updateUserById: update } } });
  });

  it('allows only one password change for two concurrently submitted requests', async () => {
    const responses = await Promise.all([POST(request()), POST(request())]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('consume_phone_otp', expect.objectContaining({ p_account_id: id, p_purpose: 'password_reset', p_consume: true }));
    expect((await POST(request())).status).toBe(400);
  });

  it('never changes a password on a rejected/expired/exhausted challenge', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(request())).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('fails closed when consumption cannot be confirmed', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: 'fixture dependency failure' } });
    expect((await POST(request())).status).toBe(500);
    expect(update).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
