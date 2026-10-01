/**
 * ADR-398 — Creators API adapter (config-only; inert until credentials exist).
 */
import { creatorsApiConfig, isCreatorsApiConfigured, CreatorsApiAuth, extractItemOffer, getItemsAsProducts, refreshPricesViaCreatorsApi, CREATORS_API_HOST } from '../../src/lib/providers/sourcing/amazon-creators-api';

const ENV = { AMAZON_CREATORS_CLIENT_ID: 'amzn1.application-oa2-client.x', AMAZON_CREATORS_CLIENT_SECRET: 's3cret', AMAZON_CREATORS_PARTNER_TAG: 'tawveeri0f-21' } as NodeJS.ProcessEnv;

function fakeFetch(items: Record<string, unknown>[], calls: Array<{ url: string; body: unknown; headers: Record<string, string> }>) {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.includes('/auth/o2/token')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
    return new Response(JSON.stringify({ itemsResult: { items } }), { status: 200 });
  }) as unknown as typeof fetch;
}

describe('configuration', () => {
  it('is inert without all three credentials', () => {
    expect(isCreatorsApiConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isCreatorsApiConfigured({ AMAZON_CREATORS_CLIENT_ID: 'a', AMAZON_CREATORS_CLIENT_SECRET: 'b' } as NodeJS.ProcessEnv)).toBe(false);
    expect(creatorsApiConfig(ENV)?.marketplace).toBe('www.amazon.sa');
  });
});

describe('auth', () => {
  it('requests a client-credentials token with the creatorsapi scope and caches it', async () => {
    const calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];
    const auth = new CreatorsApiAuth(creatorsApiConfig(ENV)!, fakeFetch([], calls));
    expect(await auth.accessToken()).toBe('tok');
    expect(await auth.accessToken()).toBe('tok');
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ grant_type: 'client_credentials', scope: 'creatorsapi::default', client_id: ENV.AMAZON_CREATORS_CLIENT_ID });
  });
});

describe('getItems', () => {
  const item = (asin: string, amount: number | null, avail = 'IN_STOCK') => ({
    asin, itemInfo: { title: { displayValue: `Samsung TV ${asin}` } }, detailPageURL: `https://www.amazon.sa/dp/${asin}?tag=t`,
    offersV2: { listings: amount == null ? [] : [{ price: { money: { amount, currency: 'SAR' }, savingBasis: { money: { amount: amount + 300 } } }, availability: { type: avail } }] },
  });

  it('reads price/availability defensively from offersV2 and marks the source as product-grade', () => {
    const o = extractItemOffer(item('B0GS29FHVB', 1699.17));
    expect(o).toMatchObject({ price: 1699.17, originalPrice: 1999.17, availability: 'in_stock' });
    expect(extractItemOffer(item('B0GS29FHVB', null)).availability).toBe('out_of_stock');
    expect(extractItemOffer({ asin: 'X' }).price).toBeNull();
  });

  it('sends the SA marketplace header, the partner tag and at most 10 ASINs; unanswered ASINs are null', async () => {
    const calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];
    const cfg = creatorsApiConfig(ENV)!;
    const f = fakeFetch([item('B0GS29FHVB', 1699.17)], calls);
    const out = await getItemsAsProducts(cfg, new CreatorsApiAuth(cfg, f), ['B0GS29FHVB', 'B0DNYR4PR9', 'not-an-asin'], f);
    const call = calls.find((c) => c.url === `${CREATORS_API_HOST}/catalog/v1/getItems`)!;
    expect(call.headers['x-marketplace']).toBe('www.amazon.sa');
    expect(call.body).toMatchObject({ itemIdType: 'ASIN', partnerTag: 'tawveeri0f-21', partnerType: 'Associates', itemIds: ['B0GS29FHVB', 'B0DNYR4PR9'] });
    expect(out.get('B0GS29FHVB')).toMatchObject({ sku: 'B0GS29FHVB', current_price: 1699.17, price_source: 'product_page', product_url: 'https://www.amazon.sa/dp/B0GS29FHVB' });
    expect(out.get('B0DNYR4PR9')).toBeNull();
  });

  it('batch refresh maps results back onto the caller URLs and returns null when unconfigured', async () => {
    expect(await refreshPricesViaCreatorsApi(['https://www.amazon.sa/dp/B0GS29FHVB'], {} as NodeJS.ProcessEnv)).toBeNull();
    const calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];
    const urls = Array.from({ length: 12 }, (_, i) => `https://www.amazon.sa/-/en/x/dp/B0000000${String(i).padStart(2, '0')}/ref=sr_1_${i}`);
    const f = fakeFetch([item('B000000003', 500)], calls);
    const out = await refreshPricesViaCreatorsApi(urls, ENV, f);
    expect(calls.filter((c) => c.url.endsWith('/getItems'))).toHaveLength(2); // 12 ASINs => 2 chunks of <= 10
    expect(out!.get(urls[3])?.current_price).toBe(500);
    expect(out!.get(urls[3])?.product_url).toBe(urls[3]); // the caller's row url is preserved
    expect(out!.get(urls[0])).toBeNull();
  });
});
