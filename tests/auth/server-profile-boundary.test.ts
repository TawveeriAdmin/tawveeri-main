import { createServerClient } from '@supabase/ssr';
import { getUserProfile } from '@/lib/auth/server';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn(async () => ({ get: jest.fn() })) }));
jest.mock('react', () => ({ cache: (fn: unknown) => fn }));

describe('profile creation privilege boundary', () => {
  const originalEnv = { ...process.env };
  const user = { id: 'validated-user', email: 'owner@example.test', user_metadata: { role: 'admin', full_name: 'Owner' } };
  let row: Record<string, unknown> | null;
  let insert: jest.Mock;

  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAIL;
    delete process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    row = null;
    insert = jest.fn(value => {
      row = value;
      return { select: () => ({ maybeSingle: async () => ({ data: row }) }) };
    });
    (createServerClient as jest.Mock).mockReturnValue({
      auth: { getUser: async () => ({ data: { user } }) },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
        insert,
      }),
    });
  });
  afterAll(() => { process.env = originalEnv; });

  it('creates a customer even when untrusted metadata requests admin', async () => {
    expect((await getUserProfile())?.role).toBe('customer');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: user.id, role: 'customer', full_name: 'Owner' }));
  });

  it('keeps bootstrap access ephemeral for a newly created profile', async () => {
    process.env.ADMIN_EMAILS = user.email;
    expect((await getUserProfile())?.role).toBe('admin');
    expect(row?.role).toBe('customer');
    delete process.env.ADMIN_EMAILS;
    expect((await getUserProfile())?.role).toBe('customer');
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('preserves a legitimately promoted database role', async () => {
    row = { id: user.id, role: 'admin' };
    expect((await getUserProfile())?.role).toBe('admin');
    expect(insert).not.toHaveBeenCalled();
  });

  it('does not create a profile without a validated user', async () => {
    (createServerClient as jest.Mock).mockReturnValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
    expect(await getUserProfile()).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });
});
