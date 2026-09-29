import { NextRequest } from 'next/server';
import { createServerClient as createAdminClient } from '@/lib/database';
import { createServerClient } from '@supabase/ssr';
import { generateBoundPhoneLink } from '@/lib/auth/phone-session-link';
import { POST } from '@/app/api/auth/verify-phone-otp/route';

jest.mock('@/lib/database', () => ({ createServerClient: jest.fn() }));
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/auth/phone-session-link', () => ({ generateBoundPhoneLink: jest.fn() }));
jest.mock('@/lib/auth/notifications', () => ({ createNotification: jest.fn(async () => ({})), sendWelcomeEmail: jest.fn(async () => ({})), sendNewDeviceLoginEmail: jest.fn(async () => ({})) }));
jest.mock('@/lib/auth/audit', () => ({ createAuditLog: jest.fn(async () => ({})) }));

describe('phone OTP signup and login contract', () => {
  const id = 'phone-owner';
  let rpc: jest.Mock;
  let createUser: jest.Mock;
  let verifyOtp: jest.Mock;
  let profile: Record<string, unknown> | null;
  let profileError: object | null;
  const request = (details = false) => new NextRequest('http://localhost/api/auth/verify-phone-otp', {
    method: 'POST', body: JSON.stringify({ phone: '0501234567', otp: '123456', platform: 'mobile', ...(details ? { fullName: 'Fixture', email: 'claimed@example.test' } : {}) }),
  });
  beforeEach(() => {
    jest.clearAllMocks();
    profile = null; profileError = null;
    rpc = jest.fn(async () => ({ data: true, error: null }));
    createUser = jest.fn(async () => ({ data: { user: { id } }, error: null }));
    verifyOtp = jest.fn(async () => ({ data: { user: { id }, session: { access_token: 'fixture', refresh_token: 'fixture' } }, error: null }));
    (generateBoundPhoneLink as jest.Mock).mockResolvedValue({ user: { id }, properties: { action_link: 'https://fixture.invalid/auth', hashed_token: 'fixture' } });
    (createServerClient as jest.Mock).mockReturnValue({ auth: { verifyOtp } });
    (createAdminClient as jest.Mock).mockReturnValue({
      rpc, auth: { admin: { createUser, getUserById: async () => ({ data: { user: { id } } }), updateUserById: jest.fn(async () => ({ error: null })) } },
      from: (table: string) => {
        const chain = {
          select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
          maybeSingle: async () => ({ data: table === 'users' ? profile : { id: 'known-device' }, error: profileError }),
          insert: jest.fn(async () => ({ error: null })),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
        return chain;
      },
    });
  });
  it('validates an incomplete signup without consuming or issuing a session', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).isNewUser).toBe(true);
    expect(rpc).toHaveBeenCalledWith('consume_phone_otp', expect.objectContaining({ p_purpose: 'phone_signin', p_account_id: null, p_consume: false }));
    expect(createUser).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
  it('completes signup using a synthetic Auth email and an account-bound session', async () => {
    const response = await POST(request(true));
    expect(response.status).toBe(200);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'phone_966501234567@tawveeri.local' }));
    expect(rpc).toHaveBeenCalledWith('consume_phone_otp', expect.objectContaining({ p_consume: true }));
    expect(generateBoundPhoneLink).toHaveBeenCalledWith(expect.anything(), id, '+966501234567');
    expect((await response.json()).user.id).toBe(id);
  });
  it('does not create an account or session when consumption is rejected', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(request(true))).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
  it('fails closed on a profile dependency error instead of treating it as signup', async () => {
    profileError = { code: 'fixture-unavailable' };
    expect((await POST(request(true))).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not return a session for a different account', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    verifyOtp.mockResolvedValue({ data: { user: { id: 'wrong-account' }, session: { access_token: 'fixture' } }, error: null });
    const response = await POST(request(true));
    expect(response.status).toBe(500);
    expect((await response.json()).session).toBeUndefined();
    log.mockRestore();
  });
});
