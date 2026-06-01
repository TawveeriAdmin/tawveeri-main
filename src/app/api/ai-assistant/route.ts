import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ARABIC_TO_SEARCH: Record<string, string> = {
  'مكيف': 'air conditioner split ac',
  'مكيف سبليت': 'split air conditioner',
  'مكيف شباك': 'window air conditioner',
  'تكييف': 'air conditioner ac',
  'ايفون': 'iphone',
  'آيفون': 'iphone',
  'سامسونج': 'samsung',
  'هواوي': 'huawei',
  'شاومي': 'xiaomi',
  'لابتوب': 'laptop',
  'حاسوب': 'laptop computer',
  'كمبيوتر': 'computer desktop',
  'تلفزيون': 'tv television',
  'شاشة': 'monitor screen',
  'سماعات': 'headphones earbuds',
  'سماعه': 'headphones',
  'ثلاجة': 'refrigerator fridge',
  'غسالة': 'washing machine',
  'مكنسة': 'vacuum cleaner',
  'طابعة': 'printer',
  'جوال': 'smartphone mobile',
  'هاتف': 'smartphone phone',
  'تابلت': 'tablet',
  'ساعة ذكية': 'smartwatch',
  'ساعه': 'smartwatch watch',
  'كاميرا': 'camera',
  'راوتر': 'router wifi',
  'بلايستيشن': 'playstation ps5',
  'اكس بوكس': 'xbox',
  'برو': 'pro',
  'ماكس': 'max',
  'بلس': 'plus',
  'الترا': 'ultra',
  'ميني': 'mini',
  'لايت': 'lite',
};

function extractSearchIntent(message: string): {
  query: string;
  maxPrice?: number;
  minPrice?: number;
} {
  let maxPrice: number | undefined;
  let minPrice: number | undefined;

  const maxMatch = message.match(/(?:بأقل من|أقل من|تحت|ما يتجاوز|لا يتجاوز|بحدود|حتى)\s*(\d+)/);
  const minMatch = message.match(/(?:أكثر من|فوق)\s*(\d+)/);

  if (maxMatch) maxPrice = parseInt(maxMatch[1]);
  if (minMatch) minPrice = parseInt(minMatch[1]);

  let searchQuery = message.toLowerCase();

  // Apply Arabic to English mapping
  for (const [arabic, english] of Object.entries(ARABIC_TO_SEARCH)) {
    searchQuery = searchQuery.replace(new RegExp(arabic, 'gi'), english);
  }

  // Clean filler words
  const query = searchQuery
    .replace(/(?:ابي|أبي|بغيت|أبغى|ابغى|بدي|عندي|اريد|أريد)/g, '')
    .replace(/(?:بأقل من|أقل من|تحت|ما يتجاوز|لا يتجاوز)\s*\d+/g, '')
    .replace(/\d+\s*(?:ريال|sar)/gi, '')
    .replace(/(?:رخيص|غالي|جيد|كويس|ممتاز|عالي|منخفض|لغرفه|لغرفة|متر)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { query: query || message.slice(0, 30), maxPrice, minPrice };
}

async function searchProducts(intent: ReturnType<typeof extractSearchIntent>, baseUrl: string) {
  try {
    const body: Record<string, unknown> = {
      query: intent.query,
      pageSize: 5,
      sort: 'price_low',
      in_stock_only: true,
    };
    if (intent.maxPrice) body.max_price = intent.maxPrice;
    if (intent.minPrice) body.min_price = intent.minPrice;

    const res = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.products?.slice(0, 4) || null;
  } catch {
    return null;
  }
}

function formatProductsForAI(products: any[]): string {
  if (!products || products.length === 0) return '';
  return products.map((p, i) => {
    const stores = p.stores?.sort((a: any, b: any) => a.current_price - b.current_price) || [];
    const best = stores[0];
    const discount = best?.original_price && best.original_price > best.current_price
      ? Math.round(((best.original_price - best.current_price) / best.original_price) * 100)
      : 0;
    const allStores = stores.slice(0, 3).map((s: any) =>
      `${s.store_name || s.store}: ${Math.round(s.current_price)} ريال → ${s.product_url}`
    ).join('\n  ');

    return `منتج ${i + 1}: ${p.name_ar || p.name_en}
  أفضل سعر: ${Math.round(p.best_price)} ريال${discount > 0 ? ` (خصم ${discount}%)` : ''}
  متوفر في ${p.store_count} متجر
  المتاجر والأسعار والروابط:
  ${allStores}
  كوبون: ${best?.coupon_code || 'لا يوجد'}`;
  }).join('\n\n');
}
export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';
    const intent = extractSearchIntent(message);
    const products = await searchProducts(intent, baseUrl);
    const productsContext = products?.length ? formatProductsForAI(products) : '';

    const systemPrompt = `أنت "وفّر" — مساعد التسوق الذكي لمنصة توفيري السعودية.
شخصيتك: ذكي، ودود، عامية سعودية، مباشر.

${productsContext ? `✅ نتائج حقيقية من توفيري — استخدمها فقط ولا تخترع أسعاراً:

${productsContext}

قواعد:
- استخدم الأسعار والروابط أعلاه كما هي بدون تعديل
- رتّب من الأرخص للأغلى
- اذكر الكوبون إذا موجود` :
`❌ ما لقيت نتائج في توفيري لهذا الطلب.
أخبر المستخدم بلطف وأقترح:
1. البحث مباشرة: https://tawveeri.com/ar/search
2. تغيير كلمات البحث
3. توسيع الميزانية`}

شكل الرد:
**[اسم المنتج]**
💰 [السعر] ريال
🏪 [المتجر]
🔗 [عرض المنتج](الرابط المباشر)
---
في النهاية: "تبي أعرف أكثر عن أي منتج؟ 😊"`;

    const messages = [
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return NextResponse.json({ error: 'AI service error' }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.content[0]?.text || 'عذراً، ما قدرت أساعدك. حاول مرة ثانية.';

    return NextResponse.json({
      reply,
      updatedHistory: [
        ...conversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: reply }
      ]
    });

  } catch (error) {
    console.error('AI Assistant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
