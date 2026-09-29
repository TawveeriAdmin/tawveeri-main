import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/types';
import { generateBoundPhoneLink } from '@/lib/auth/phone-session-link';

describe('phone session identity binding', () => {
  const phone = '+966501234567';
  const user = { id: 'verified-phone-owner', phone: '966501234567', email: 'authoritative@example.test' };
  let admin: { getUserById: jest.Mock; generateLink: jest.Mock; updateUserById: jest.Mock };
  let client: SupabaseClient<Database>;
  beforeEach(() => {
    admin = {
      getUserById: jest.fn(async () => ({ data: { user }, error: null })),
      generateLink: jest.fn(async () => ({ data: { user, properties: {} }, error: null })),
      updateUserById: jest.fn(async () => ({ error: null })),
    };
    client = { auth: { admin } } as unknown as SupabaseClient<Database>;
  });
  it('mints using the authoritative Auth email of the phone owner', async () => {
    await generateBoundPhoneLink(client, user.id, phone);
    expect(admin.generateLink).toHaveBeenCalledWith(expect.objectContaining({ email: user.email }));
    expect(admin.updateUserById).not.toHaveBeenCalled();
  });
  it('rejects a phone/profile mismatch before minting any token', async () => {
    await expect(generateBoundPhoneLink(client, user.id, '+966599999999')).rejects.toThrow('could not be verified');
    expect(admin.generateLink).not.toHaveBeenCalled();
  });
  it('rejects a link issued for any other account', async () => {
    admin.generateLink.mockResolvedValue({ data: { user: { id: 'other-account' }, properties: {} }, error: null });
    await expect(generateBoundPhoneLink(client, user.id, phone)).rejects.toThrow('identity mismatch');
  });
  it('fails closed on an Auth lookup failure', async () => {
    admin.getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'unavailable' } });
    await expect(generateBoundPhoneLink(client, user.id, phone)).rejects.toThrow();
    expect(admin.generateLink).not.toHaveBeenCalled();
  });
  it('uses only a deterministic synthetic address when the account has no email', async () => {
    admin.getUserById.mockResolvedValue({ data: { user: { ...user, email: null } }, error: null });
    await generateBoundPhoneLink(client, user.id, phone);
    expect(admin.generateLink).toHaveBeenCalledWith(expect.objectContaining({ email: 'phone_966501234567@tawveeri.local' }));
  });
});
