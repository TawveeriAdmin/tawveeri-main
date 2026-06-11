import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Probe v2: اكتشاف اسم baseSite الصحيح لبوابة Hybris OCC
export async function GET() {
  const results: Record<string, any> = {};

  // 1) basesites endpoint يكشف الأسماء المسجلة رسمياً
  const discovery = [
    'https://www.extra.com/extracommercewebservices/v2/basesites',
    'https://www.extra.com/occ/v2/basesites',
  ];

  // 2) تخمينات شائعة لاسم الموقع
  const guesses = ['extra-sa', 'extrasa', 'extraSA', 'sa', 'extra-b2c', 'extraB2C', 'extra_sa', 'ksa'];

  for (const url of discovery) {
    results[`discovery: ${url.split('.com')[1]}`] = await probe(url);
  }

  for (const g of guesses) {
    const url = `https://www.extra.com/extracommercewebservices/v2/${g}/products/search?query=&pageSize=2&lang=ar`;
    results[`guess: ${g}`] = await probe(url);
  }

  return NextResponse.json({ probe: 'extra-v2', results }, { headers: { 'Cache-Control': 'no-store' } });
}

async function probe(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.extra.com/ar-sa/',
      },
    });
    const text = await res.text();
    const isJson = (res.headers.get('content-type') || '').includes('json');
    return {
      status: res.status,
      json: isJson,
      sample: text.slice(0, 250),
    };
  } catch (e: any) {
    return { error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}
