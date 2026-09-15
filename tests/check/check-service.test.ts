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

describe('Check resolves a known short link by redirect only, before matching', () => {
  const shortUrl = 'https://link.amazon/B0jhDmiKd';
  const destination = 'https://www.amazon.sa/dp/B0D1234567?tag=t';
  const amazonSource = { identity_key: 'phone|amazon', store_id: 2, url: 'https://www.amazon.sa/dp/B0D1234567', status: 'valid', price: 4599 };
  const mockResponse = (url: string, refresh: string | null = null) => ({
    url, headers: { get: (name: string) => (name.toLowerCase() === 'refresh' ? refresh : null) },
    body: { cancel: jest.fn().mockResolvedValue(undefined) },
  });
  afterEach(() => { jest.restoreAllMocks(); });
  it('uses GET, not HEAD — link.amazon returns 404 on HEAD regardless of User-Agent (ADR-369, live-verified)', async () => {
    const from = setup([amazonSource], 1);
    const fetchMock = jest.fn().mockResolvedValue(mockResponse(destination));
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await checkProduct(shortUrl, 'ar');
    expect(fetchMock).toHaveBeenCalledWith(shortUrl, expect.objectContaining({ method: 'GET', redirect: 'follow' }));
    expect(from).toHaveBeenCalled();
    expect(result.state).not.toBe('unsupported');
    expect(result.state).not.toBe('short_link_unresolved');
  });
  it('never reads the response body — only cancels it — for a resolved single-hop redirect', async () => {
    setup([amazonSource], 1);
    const response = mockResponse(destination);
    global.fetch = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;
    await checkProduct(shortUrl, 'ar');
    expect(response.body.cancel).toHaveBeenCalled();
  });
  it('resolves Amazon\'s real two-hop chain via the Refresh header alone, reconstructing the app-deep-link as https (ADR-369)', async () => {
    const from = setup([amazonSource], 1);
    // fetch() auto-follows the first 3xx (link.amazon -> amzlinks.in) and lands here: a
    // 200 that is not itself a supported merchant link, carrying the real destination in
    // a Refresh header as an app-deep-link, exactly as observed live 2026-09-15.
    const refresh = '0; url=com.amazon.mobile.shopping.web://www.amazon.sa/dp/B0D1234567/ref=x?tag=t';
    global.fetch = jest.fn().mockResolvedValue(mockResponse('https://amzlinks.in/B0jhDmiKd', refresh)) as unknown as typeof fetch;
    const result = await checkProduct(shortUrl, 'ar');
    expect(from).toHaveBeenCalled();
    expect(result.state).not.toBe('unsupported');
    expect(result.state).not.toBe('short_link_unresolved');
  });
  it('gives a precise tracking-failure state, not a generic or fabricated match, when resolution fails', async () => {
    const from = setup([], 0);
    global.fetch = jest.fn().mockRejectedValue(new Error('network unreachable')) as unknown as typeof fetch;
    expect(await checkProduct(shortUrl, 'ar')).toEqual({ state: 'short_link_unresolved' });
    expect(from).not.toHaveBeenCalled();
  });
  it('gives the same precise state when the short link never actually redirects', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockResponse(shortUrl)) as unknown as typeof fetch;
    expect(await checkProduct(shortUrl, 'ar')).toEqual({ state: 'short_link_unresolved' });
  });
  it('gives the same precise state for a dead-end intermediate hop with no Refresh header and no known merchant', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockResponse('https://amzlinks.in/B0jhDmiKd')) as unknown as typeof fetch;
    expect(await checkProduct(shortUrl, 'ar')).toEqual({ state: 'short_link_unresolved' });
  });
  it('never attempts resolution for a domain that is not a verified short link', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(await checkProduct('https://amzn.eu/example', 'ar')).toEqual({ state: 'unsupported' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
