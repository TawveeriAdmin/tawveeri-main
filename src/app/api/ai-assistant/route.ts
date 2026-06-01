import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ARABIC_TO_SEARCH: Record<string, string> = {
  'ايفون': 'iphone', 'آيفون': 'iphone', 'سامسونج': 'samsung',
  'لابتوب': 'laptop', 'حاسوب': 'laptop', 'كمبيوتر': 'computer',
  'تلفزيون': 'tv', 'شاشة': 'monitor', 'سماعات': 'headphones',
  'مكيف': 'air conditioner', 'ثلاجة': 'refrigerator',
  'غسالة': 'washing machine', 'مكنسة': 'vacuum', 'طابعة': 'printer',
  'جوال': 'smartphone', 'هاتف': 'smartphone', 'تابلت': 'tablet',
  'ساعة': 'smartwatch', 'كاميرا': 'camera', 'راوتر': 'router',
};

function extractSearchIntent(message: string): {
  query: string;
  maxPrice?: number;
  minPrice?: number;
  category?: string;
} {
  let query = message;
  let maxPrice: number | undefined;
  let minPrice: number | undefined;

  // Extract price constraints
  const maxPriceMatch = message.match(/(?:بأقل من|أقل من|تحت|ما يتجاوز|لا يتجاوز|بحدود|حتى)\s*(\d+)/);
  const minPriceMatch = message.match(/(?:أكثر من|فوق|من)\s*(\d+)/);
  const exactPriceMatch = message.match(/(\d+)\s*(?:ريال|SAR|سعر)/);

  if (maxPriceMatch) maxPrice = parseInt(maxPriceMatch[1]);
  else if (exactPriceMatch) maxPrice = parseInt(exactPriceMatch[1]) * 1.1;
  if (minPriceMatch) minPrice = parseInt(minPriceMatch[1]);

  // Normalize Arabic to English for search
  let searchQuery = message;
  for (const [arabic, english] of Object.entries(ARABIC_TO_SEARCH)) {
    searchQuery = searchQuery.replace(new RegExp(arabic, 'g'), english);
  }

  // Clean up query — remove price mentions and common filler words
  query = searchQuery
    .replace(/(?:ابي|أبي|بغيت|أبغى|ابغى|بدي|عندي ميزانية|ميزانيتي)/g, '')
    .replace(/(?:بأقل من|أقل من|تحت|ما يتجاوز|لا يتجاوز)\s*\d+/g, '')
    .replace(/\d+\s*(?:ريال|SAR)/g, '')
    .replace(/(?:رخيص|غالي|جيد|كويس|ممتاز|عالي|منخفض)/g, '')
    .trim();

  if (!query || query.length < 2) query = message.split(' ').slice(0, 3).join(' ');

  return { query, maxPrice, minPrice };
}

async function searchProducts(intent: ReturnType<typeof extractSearchIntent>, baseUrl: string) {
  try {
    const body: Record<string, unknown> = {
      query: intent.query,
      pageSize: 6,
      sort: 'price_low',
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
    const bestStore = p.stores?.sort((a: any, b: any) => a.current_price - b.current_price)[0];
    const discount = bestStore?.original_price && bestStore.original_price > bestStore.current_price
      ? Math.round(((bestStore.original_price - bestStore.current_price) / bestStore.original_price) * 100)
      : 0;

    return `
المنتج ${i + 1}:
- الاسم: ${p.name_ar || p.name_en}
- أفضل سعر: ${Math.round(p.best_price)} ريال${discount > 0 ? ` (خصم ${discount}%)` : ''}
- السعر الأصلي: ${bestStore?.original_price ? Math.round(bestStore.original_price) + ' ريال' : 'غير متوفر'}
- المتجر: ${bestStore?.store_name || bestStore?.store}
- الرابط المباشر: ${bestStore?.product_url || ''}
- التوفر: ${bestStore?.availability === 'in_stock' ? 'متوفر' : 'غير متوفر'}
- عدد المتاجر: ${p.store_count}
- الكوبون: ${bestStore?.coupon_code || 'لا يوجد'}
`.trim();
  }).join('\n\n---\n\n');
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

    // Extract intent and search real products
    const intent = extractSearchIntent(message);
    const products = await searchProducts(intent, baseUrl);
    const productsContext = products ? formatProductsForAI(products) : '';

    const systemPrompt = `أنت "وفّر" — مساعد التسوق الذكي لمنصة توفيري السعودية.
شخصيتك: ذكي، ودود، تتكلم بالعامية السعودية، مباشر وعملي.

${productsContext ? `نتائج البحث الحقيقية من قاعدة بيانات توفيري (استخدمها فقط):
${productsContext}

قواعد مهمة:
- استخدم فقط المنتجات والأسعار الموجودة أعلاه — لا تخترع أسعاراً
- الروابط الموجودة هي روابط مباشرة للمنتج في المتجر — استخدمها كما هي
- إذا ما في نتائج مناسبة قل للمستخدم بصراحة` :
`لم يتم العثور على نتائج في قاعدة البيانات. أخبر المستخدم بأدب أنك ما لقيت نتائج وأقترح عليه:
1. البحث مباشرة في الموقع
2. تغيير كلمات البحث
3. توسيع الميزانية`}

قواعد التنسيق:
1. استخدم هذا الشكل لكل منتج:

**[اسم المنتج]** ${productsContext ? '← الأنسب لك' : ''}
💰 السعر: X ريال
🏪 المتجر: [اسم المتجر]
✅ المميزات: [نقطتان مختصرتان]
🔗 [عرض المنتج مباشرة](الرابط)

---

2. رتّب من الأرخص للأغلى
3. في النهاية: "تبي أقارن أكثر أو عندك سؤال؟ 😊"
4. إذا في كوبون — اذكره بوضوح`;

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
