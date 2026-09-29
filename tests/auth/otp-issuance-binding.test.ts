import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/database';
import { getRequestUser } from '@/lib/auth/api-auth';
import { authenticaService } from '@/lib/auth/authentica';
import { POST } from '@/app/api/auth/send-phone-otp/route';

jest.mock('@/lib/database', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/auth/api-auth', () => ({ getRequestUser: jest.fn() }));
jest.mock('@/lib/auth/authentica', () => ({ authenticaService: { sendOTP: jest.fn() } }));

describe('phone OTP issuance purpose and account binding', () => {
  let account: { id: string } | null;
  let insert: jest.Mock;
  const request = (purpose?: string) => new NextRequest('http://localhost/api/auth/send-phone-otp', {
    method: 'POST', body: JSON.stringify({ phone: '0501234567', purpose, account_id: 'untrusted-id' }),
  });
  beforeEach(() => {
    jest.clearAllMocks();
    account = { id: 'database-account' };
    insert = jest.fn(async () => ({ error: null }));
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), insert, maybeSingle: async () => ({ data: account, error: null }) };
    (createServerClient as jest.Mock).mockReturnValue({ from: () => query });
    (getRequestUser as jest.Mock).mockResolvedValue(null);
    (authenticaService.sendOTP as jest.Mock).mockResolvedValue({ success: true });
  });
  it('binds a password-reset challenge to the looked-up account', async () => {
    expect((await POST(request('password_reset'))).status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'password_reset', account_id: 'database-account' }));
  });
  it('does not send a reset challenge for a nonexistent account', async () => {
    account = null;
    expect((await POST(request('password_reset'))).status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
    expect(authenticaService.sendOTP).not.toHaveBeenCalled();
  });
  it('requires the owning session for profile verification', async () => {
    (getRequestUser as jest.Mock).mockResolvedValue({ id: 'other-account' });
    expect((await POST(request('phone_verify'))).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
    expect(authenticaService.sendOTP).not.toHaveBeenCalled();
  });
  it('keeps the default login request compatible and scoped to login', async () => {
    account = null;
    expect((await POST(request())).status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'phone_signin', account_id: null }));
  });
  it('rejects an unknown purpose before issuing or sending', async () => {
    expect((await POST(request('admin'))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
    expect(authenticaService.sendOTP).not.toHaveBeenCalled();
  });
});
