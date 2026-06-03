import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function extractSearchIntent(message: string, apiKey: string): Promise<{
  query: string;
  maxPrice?: number;
  minPrice?: number;
  category?: string;
}> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `استخرج من هذا الطلب: كلمات البحث بالإنجليزي، الميزانية القصوى، الميزانية الدنيا.
الطلب: "${message}"
رد بـ JSON فقط بهذا الشكل:
{"query":"english search keywords","maxPrice":null,"minPrice":null}
- query: اسم المنتج بالإنجليزي (مثل: iphone 15، samsung s25، air conditioner)
- إذا ما في ميزانية اكتب null`,
      }],
    }),
  });
  
  const data = await response.json();
  const text = data.content?.[0]?.text || '{}';
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { query: message };
  }
}

async function searchProducts(query: string, maxPrice?: number, minPrice?: number) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';
    const body: Record<string, unknown> = {
      query,
      pageSize: 5,
      sort: 'price_low',
      in_stock_only: true,
    };
    if (maxPrice) body.max_price = maxPrice;
    if (minPrice) body.min_price = minPrice;

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
  if (!products?.length) return '';
  return products.map((p, i) => {
    const stores = p.stores?.sort((a: any, b: any) => a.current_price - b.current_price) || [];
    const best = stores[0];
    const discount = best?.original_price && best.original_price > best.current_price
      ? Math.round(((best.original_price - best.current_price) / best.original_price) * 100)
      : 0;
    const allStores = stores.slice(0, 3).map((s: any) =>
      `${s.store_name || s.store}: ${Math.round(s.current_price)} ريال — ${s.product_url}`
    ).join('\n  ');

    return `منتج ${i + 1}: ${p.name_ar || p.name_en}
  أفضل سعر: ${Math.round(p.best_price)} ريال${discount > 0 ? ` (خصم ${discount}%)` : ''}
  متوفر في ${p.store_count} متجر
  المتاجر:
  ${allStores}
  كوبون: ${best?.coupon_code || 'لا يوجد'}`;
  }).join('\n\n');
}export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Claude يستخرج كلمات البحث ذكياً
    const intent = await extractSearchIntent(message, apiKey);
    
    // البحث في قاعدة البيانات بالكلمات المستخرجة
    const products = intent.query 
      ? await searchProducts(intent.query, intent.maxPrice, intent.minPrice)
      : null;
    
    const productsContext = products?.length ? formatProductsForAI(products) : '';

    const systemPrompt = `أنت "وفّر" — مساعد التسوق الذكي لمنصة توفيري السعودية.
شخصيتك: ذكي، ودود، عامية سعودية، مباشر وعملي.

${productsContext ? `✅ نتائج حقيقية من توفيري — استخدمها فقط:

${productsContext}

قواعد:
- استخدم الأسعار والروابط أعلاه كما هي
- رتّب من الأرخص للأغلى  
- اذكر الكوبون إذا موجود
- الروابط مباشرة للمنتج في المتجر` :
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

