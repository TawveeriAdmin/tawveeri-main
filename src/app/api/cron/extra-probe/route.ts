import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Probe نهائي: جلب صفحة فئة حقيقية + استخراج بنية بطاقة المنتج
export async function GET() {
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

    // ابحث عن JSON-LD المنتجات (Hybris غالباً يحقنه — أنظف من CSS)
    const ldMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    const ldSamples = ldMatches.slice(0, 3).map(m => m.replace(/<[^>]+>/g, '').slice(0, 400));

    // ابحث عن أنماط بطاقة المنتج الشائعة في Hybris
    const hasProductTile = /class="[^"]*product[^"]*tile/i.test(html);
    const hasItemCode = /data-product-code|data-code|data-sku/i.test(html);
    const priceClasses = (html.match(/class="[^"]*price[^"]*"/gi) || []).slice(0, 5);

    return NextResponse.json({
      probe: 'extra-final',
      status: res.status,
      htmlLength: html.length,
      jsonLdFound: ldMatches.length,
      jsonLdSamples: ldSamples,
      hasProductTile,
      hasItemCode,
      priceClassSamples: priceClasses,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e) });
  } finally {
    clearTimeout(timer);
  }
}
