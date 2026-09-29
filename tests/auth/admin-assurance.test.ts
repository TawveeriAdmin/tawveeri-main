import type { SupabaseClient } from '@supabase/supabase-js';
import { assertAdminAssurance } from '@/lib/auth/admin-assurance';

describe('administrator verified session assurance', () => {
  const prior = process.env.ADMIN_MFA_REQUIRED;
  const getClaims = jest.fn();
  const client = { auth: { getClaims } } as unknown as SupabaseClient;
  beforeEach(() => { process.env.ADMIN_MFA_REQUIRED = '1'; getClaims.mockReset(); });
  afterAll(() => { if (prior === undefined) delete process.env.ADMIN_MFA_REQUIRED; else process.env.ADMIN_MFA_REQUIRED = prior; });

  it('keeps enrollment accessible while owner activation is pending', async () => {
    delete process.env.ADMIN_MFA_REQUIRED;
    await expect(assertAdminAssurance(client, 'admin')).resolves.toBeUndefined();
    expect(getClaims).not.toHaveBeenCalled();
  });
  it('accepts only a verified AAL2 token for the same subject', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'admin', aal: 'aal2' } }, error: null });
    await expect(assertAdminAssurance(client, 'admin', 'fixture-token')).resolves.toBeUndefined();
    expect(getClaims).toHaveBeenCalledWith('fixture-token');
  });
  it.each([
    { data: { claims: { sub: 'admin', aal: 'aal1' }, nextLevel: 'aal2' }, error: null },
    { data: { claims: { sub: 'other', aal: 'aal2' } }, error: null },
    { data: { claims: { sub: 'admin', aal: 'aal2' } }, error: { message: 'invalid signature' } },
    { data: null, error: null },
    { data: { claims: { sub: 'admin' } }, error: null },
  ])('rejects unverified, absent, mismatched or insufficient assurance %#', async result => {
    getClaims.mockResolvedValue(result);
    await expect(assertAdminAssurance(client, 'admin')).rejects.toThrow('Admin access required');
  });
});
