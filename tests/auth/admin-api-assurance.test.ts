import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createClient as createCookieClient } from '@/lib/auth/server';
import { createClient } from '@supabase/supabase-js';

jest.mock('@/lib/auth/server', () => ({ createClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/database', () => ({ createServerClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'admin', role: 'admin' } }) }) }) }) }) }));

describe('admin API cookie and bearer assurance', () => {
  const prior = process.env.ADMIN_MFA_REQUIRED;
  const cookieClaims = jest.fn();
  const bearerClaims = jest.fn();
  beforeEach(() => {
    process.env.ADMIN_MFA_REQUIRED = '1';
    cookieClaims.mockResolvedValue({ data: { claims: { sub: 'admin', aal: 'aal1' } }, error: null });
    bearerClaims.mockResolvedValue({ data: { claims: { sub: 'admin', aal: 'aal2' } }, error: null });
    (createCookieClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }), getClaims: cookieClaims } });
    (createClient as jest.Mock).mockReturnValue({ auth: { getClaims: bearerClaims } });
  });
  afterAll(() => { if (prior === undefined) delete process.env.ADMIN_MFA_REQUIRED; else process.env.ADMIN_MFA_REQUIRED = prior; });
  it('rejects an admin role with an AAL1 cookie', async () => {
    await expect(requireRequestAdmin(new Request('https://example.test'))).rejects.toThrow('Admin access required');
  });
  it('accepts a verified AAL2 cookie', async () => {
    cookieClaims.mockResolvedValue({ data: { claims: { sub: 'admin', aal: 'aal2' } } });
    await expect(requireRequestAdmin(new Request('https://example.test'))).resolves.toMatchObject({ role: 'admin' });
  });
  it('accepts the same subject with a verified bearer factor', async () => {
    await expect(requireRequestAdmin(new Request('https://example.test', { headers: { Authorization: 'Bearer fixture' } }))).resolves.toMatchObject({ role: 'admin' });
    expect(bearerClaims).toHaveBeenCalledWith('fixture');
  });
  it('does not combine one user cookie with another user elevated token', async () => {
    bearerClaims.mockResolvedValue({ data: { claims: { sub: 'other', aal: 'aal2' } } });
    await expect(requireRequestAdmin(new Request('https://example.test', { headers: { Authorization: 'Bearer fixture' } }))).rejects.toThrow('Admin access required');
  });
});
