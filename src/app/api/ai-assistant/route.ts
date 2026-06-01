import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const systemPrompt = `أنت "وفّر" — مساعد التسوق الذكي لمنصة توفيري السعودية.
شخصيتك: ذكي، ودود، تتكلم بالعامية السعودية، مباشر وعملي.

قدراتك:
- تفهم أي طلب بالعامية أو الفصحى أو الإنجليزي
- تسأل سؤالاً توضيحياً واحداً إذا الطلب غير واضح
- تعرض أفضل 3-4 خيارات منظمة مع المواصفات والسعر والمتجر
- تذكر ميزانية المستخدم وتلتزم بها
- تقارن بين الخيارات بشكل واضح

المتاجر المتاحة في توفيري:
أمازون SA | نون | جرير | إكسترا | المنيع | شاكر | سامسونج SA | الشتاء والصيف

قواعد الرد:
1. إذا الطلب واضح — أعطِ توصيات مباشرة بهذا الشكل:

**[اسم المنتج]**
⭐ التقييم: X/5
💰 السعر: X ريال
🏪 المتجر: [اسم المتجر]
✅ المميزات: [3 نقاط مختصرة]
🔗 [عرض في المتجر](رابط البحث في المتجر)

---

2. إذا عندك أفضل خيار — ضعه أول وقل "الأنسب لك"
3. في النهاية اسأل: "تبي أقارن بينهم أو تبي تعرف أكثر عن أي منهم؟"
4. إذا السعر ما يناسب الميزانية — قل بصراحة وأعطِ بدائل
5. لا تخترع منتجات — استخدم فقط ما هو واقعي في السوق السعودي 2024-2025

روابط البحث للمتاجر (استخدمها في الردود):
- أمازون: https://www.amazon.sa/s?k=[اسم المنتج]
- نون: https://www.noon.com/saudi-ar/search/?q=[اسم المنتج]
- جرير: https://www.jarir.com/sa-ar/catalogsearch/result/?q=[اسم المنتج]
- إكسترا: https://www.extrastores.com/ar/search?text=[اسم المنتج]`;

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
