import { checkProduct } from '@/lib/check/check-product';
import { createServerClient } from '@/lib/database';
jest.mock('@/lib/database', () => ({ createServerClient: jest.fn(), fetchAllPaginated: jest.fn() }));
const url = 'https://www.extra.com/en-sa/phone/p/100376379';
const source = { identity_key: 'phone|256', store_id: 4, url, status: 'valid', price: 4599 };
const setup = (rows: unknown[], count: number | null, error: unknown = null) => {
  const from = jest.fn((table: string) => {
    const value = table === 'tps_current_offers' ? { data: rows, count, error } : { data: null, error: null };
    const chain: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => Promise.resolve(value).then(resolve) };
    for (const key of ['select', 'eq', 'ilike', 'limit', 'abortSignal', 'maybeSingle']) chain[key] = () => chain;
    return chain;
  });
  jest.mocked(createServerClient).mockReturnValue({ from } as unknown as ReturnType<typeof createServerClient>);
  return from;
};
describe('Check resolves only a complete unambiguous source identity', () => {
  it('does not query any source for an unsupported link', async () => {
    const from = setup([], 0);
    expect(await checkProduct('https://localhost/private', 'ar')).toEqual({ state: 'unsupported' });
    expect(from).not.toHaveBeenCalled();
  });
  it('does not promote truncated lookup results to an identity', async () => {
    setup([source], 21);
    expect(await checkProduct(url, 'ar')).toEqual({ state: 'ambiguous' });
  });
  it('does not choose between two canonical identities for one URL', async () => {
    const from = setup([source, { ...source, identity_key: 'phone|128' }], 2);
    expect(await checkProduct(url, 'ar')).toEqual({ state: 'ambiguous' });
    expect(from).toHaveBeenCalledTimes(1);
  });
  it('does not match a code that happens to occur in another product slug', async () => {
    setup([{ ...source, url: 'https://www.extra.com/en-sa/100376379/p/999999999' }], 1);
    expect(await checkProduct(url, 'ar')).toEqual({ state: 'unknown' });
  });
  it('does not admit an invalid current offer', async () => {
    setup([{ ...source, status: 'rejected' }], 1);
    expect(await checkProduct(url, 'ar')).toEqual({ state: 'unknown' });
  });
  it('needs an active canonical, not just a raw URL', async () => {
    setup([source], 1);
    expect(await checkProduct(url, 'ar')).toEqual({ state: 'unknown' });
  });
  it('keeps source outages distinct from lack of coverage', async () => {
    setup([], null, { message: 'database offline' });
    await expect(checkProduct(url, 'ar')).rejects.toThrow('check unavailable');
  });
});
