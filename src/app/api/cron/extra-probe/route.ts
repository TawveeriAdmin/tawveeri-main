import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Probe: هل إكسترا يرد على Railway؟ وما شكل بياناته؟
export async function GET() {
  const results: Record<string, any> = {};
  const targets = {
    html_listing: 'https://www.extra.com/ar-sa/white-goods/air-conditioner/cp/4-402',
    occ_api: 'https://www.extra.com/occ/v2/extra-sa/products/search?query=&pageSize=5&lang=ar&curr=SAR',
    occ_api_alt: 'https://www.extra.com/extracommercewebservices/v2/extra/products/search?query=&pageSize=5&lang=ar',
  };

  for (const [name, url] of Object.entries(targets)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'text/html,application/json,*/*',
          'Accept-Language': 'ar-SA,ar;q=0.9',
          'Referer': 'https://www.extra.com/ar-sa/',
        },
      });
      const text = await res.text();
      results[name] = {
        status: res.status,
        contentType: res.headers.get('content-type'),
        length: text.length,
        hasProducts: /product|منتج|price|ريال|SAR/i.test(text),
        sample: text.slice(0, 300),
      };
    } catch (e: any) {
      results[name] = { error: e?.name === 'AbortError' ? 'timeout-20s' : String(e?.message || e) };
    } finally {
      clearTimeout(timer);
    }
  }

  return NextResponse.json({ probe: 'extra', results }, { headers: { 'Cache-Control': 'no-store' } });
}
