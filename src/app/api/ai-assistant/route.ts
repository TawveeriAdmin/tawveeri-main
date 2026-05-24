import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `أنت مساعد تسوق ذكي لمنصة توفيري السعودية لمقارنة أسعار الإلكترونيات والأجهزة المنزلية.
مهمتك مساعدة المستخدم في:
- إيجاد أفضل سعر للمنتج الذي يبحث عنه
- مقارنة المنتجات من حيث السعر والمواصفات
- تقديم توصيات بناءً على الميزانية والاحتياج
- الإجابة باللهجة السعودية بشكل ودي ومختصر
المتاجر المتاحة: أمازون السعودية، نون، جرير، إكسترا، المنيع، شاكر، سامسونج SA، الشتاء والصيف.
أجب دائماً بالعربية وكن مختصراً وعملياً.`,
        messages: [
          {
            role: 'user',
            content: context
              ? `السياق: ${context}\n\nسؤال المستخدم: ${message}`
              : message,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return NextResponse.json(
        { error: 'AI service error' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const reply = data.content[0]?.text || 'عذراً، لم أستطع الإجابة.';

    return NextResponse.json({ reply });

  } catch (error) {
    console.error('AI Assistant error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

