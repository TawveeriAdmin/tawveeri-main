import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Probe: استخراج مقطع HTML خام حول أول بطاقة منتج لتحديد البنية الكاملة
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = 'https://www.extra.com/ar-sa/white-goods/air-conditioner/cp/4-402?pageSize=24&pg=0';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'ar-SA,ar;q=0.9',
        'Referer': 'https://www.extra.com/ar-sa/',
      },
    });
    const html = await res.text();

    // أول ظهور لـ product-price: نقتطع 1500 حرف قبله و500 بعده
    // هذا يكشف بطاقة المنتج كاملة: الحاوية، الاسم، الرابط، الكود
    const idx = html.indexOf('product-price');
    const snippet = idx > -1
      ? html.slice(Math.max(0, idx - 1500), idx + 500)
      : 'product-price not found';

    // وأيضاً: أي data-attributes للمنتجات (Hybris يحب data-product-*)
    const dataAttrs = [...new Set(html.match(/data-[a-z-]*(?:product|code|sku|price|name)[a-z-]*/gi) || [])].slice(0, 15);

    return NextResponse.json({
      probe: 'extra-snippet',
      status: res.status,
      snippet,
      dataAttributes: dataAttrs,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e) });
  } finally {
    clearTimeout(timer);
  }
}
