import { NextRequest } from 'next/server';
import { POST } from '@/app/api/check/route';
import { checkProduct } from '@/lib/check/check-product';
jest.mock('@/lib/check/check-product', () => ({ checkProduct: jest.fn() }));
const check = jest.mocked(checkProduct);
const request = (body: string) => new NextRequest('http://localhost/api/check', { method: 'POST', body });
describe('Check endpoint boundary', () => {
  beforeEach(() => check.mockReset());
  it.each(['invalid JSON', '{}', 'null', JSON.stringify({ url: 42 }), 'x'.repeat(4097)])('rejects malformed input before lookup', async body => {
    expect((await POST(request(body))).status).toBe(400); expect(check).not.toHaveBeenCalled();
  });
  it('returns no-store honest unknown instead of a substitute product', async () => {
    check.mockResolvedValue({ state: 'unknown' });
    const response = await POST(request(JSON.stringify({ url: 'https://www.extra.com/en-sa/p/999999999', locale: 'en' })));
    expect(await response.json()).toEqual({ state: 'unknown' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('does not expose database errors or classify an outage as no coverage', async () => {
    check.mockRejectedValue(new Error('private database diagnostic'));
    const response = await POST(request(JSON.stringify({ url: 'https://www.extra.com/en-sa/p/100376379' })));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'temporarily_unavailable' });
  });
});
