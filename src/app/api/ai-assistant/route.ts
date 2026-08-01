import { NextRequest, NextResponse } from 'next/server';
import {
  validateGeneratedAnswer,
  recordValidationEvent,
  type EvidenceFigure,
} from '@/lib/vocabulary';
import { getDeals } from '@/lib/intelligence/getDeals';
import { getPriceIntelligence } from '@/lib/intelligence/getPriceIntelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';

const WAFFAR_SYSTEM_PROMPT = `أنت "وفّر" — مساعد التسوق الذكي لمنصة توفيري السعودية.
شخصيتك: ذكي، ودود، عامية سعودية، مباشر وعملي.

مهمتك الوحيدة: مساعدة المستخدم في إيجاد أفضل سعر للمنتج الذي يريده من المتاجر السعودية.

قواعد الرد:
- استخدم الأسعار والروابط المقدمة لك كما هي بدون تعديل
- رتّب النتائج من الأرخص للأغلى دائماً
- اذكر الكوبون إذا كان موجوداً
- الروابط مباشرة للمنتج في المتجر
- ردودك قصيرة ومباشرة — لا حشو ولا مقدمات طويلة
- في نهاية كل رد اسأل: "تبي أعرف أكثر عن أي منتج؟ 😊"

شكل الرد الثابت:
**[اسم المنتج]**
💰 [السعر] ريال
🏪 [المتجر]
🔗 [عرض المنتج](الرابط المباشر)
[كوبون إذا وجد: 🎟️ كود: XXXX]
---`;

async function extractSearchIntent(
  message: string,
  apiKey: string
): Promise<{
  type: 'search' | 'deals' | 'advice';
  query: string;
  store?: string | null;
  maxPrice?: number;
  minPrice?: number;
}> {
  try {
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
        messages: [
          {
            role: 'user',
            content: `صنّف هذا الطلب واستخرج منه:
- type: "deals" لو يسأل عن العروض/التخفيضات/الخصومات عموماً، "advice" لو يسأل هل يشتري الآن أو ينتظر أو هل السعر جيد لمنتج معين، "search" لأي بحث عن منتج.
- query: **اسم المنتج فقط بالإنجليزي** — احذف حتماً: أسماء المتاجر (amazon, jarir, extra, almanea, noon, أمازون, جرير, اكسترا, المنيع, نون) وكلمات مثل price/سعر/بكم/كم. مثال: "iPhone 17 Amazon price" → query="iphone 17". (فارغة لو deals عام).
- store: اسم المتجر بالعربي إن ذكره المستخدم (أمازون/جرير/اكسترا/المنيع/نون) وإلا null.
- maxPrice/minPrice: الميزانية إن ذُكرت.
الطلب: "${message}"
رد بـ JSON فقط:
{"type":"search","query":"iphone 17","store":null,"maxPrice":null,"minPrice":null}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!['search', 'deals', 'advice'].includes(parsed.type)) parsed.type = 'search';
    return parsed;
  } catch (e) {
    console.error('[AI] extractSearchIntent failed, fallback to search:', e);
    return { type: 'search', query: message, store: null };
  }
}

async function searchProducts(
  query: string,
  maxPrice?: number,
  minPrice?: number
) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';

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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.products?.slice(0, 4) || null;
  } catch (e) {
    console.error('[AI] searchProducts failed:', e);
    return null;
  }
}

function formatProductsForAI(products: any[]): string {
  if (!products?.length) return '';

  return products
    .map((p, i) => {
      const stores =
        p.stores?.sort(
          (a: any, b: any) => a.current_price - b.current_price
        ) || [];

      const best = stores[0];

      const discount =
        best?.original_price &&
        best.original_price > best.current_price
          ? Math.round(
              ((best.original_price - best.current_price) /
                best.original_price) *
                100
            )
          : 0;

      const allStores = stores
        .slice(0, 3)
        .map(
          (s: any) =>
            `${s.store_name || s.store}: ${Math.round(
              s.current_price
            )} ريال — ${s.product_url}`
        )
        .join('\n  ');

      const compareLine = p.tps_compare_url
        ? `\n  رابط المقارنة (كل المتاجر + الذكاء السعري): ${SITE_URL}${p.tps_compare_url}`
        : '';

      return `منتج ${i + 1}: ${p.name_ar || p.name_en}
  أفضل سعر: ${Math.round(p.best_price)} ريال${
        discount > 0 ? ` (خصم ${discount}%)` : ''
      }
  متوفر في ${p.store_count} متجر
  المتاجر:
  ${allStores}
  كوبون: ${best?.coupon_code || 'لا يوجد'}${compareLine}`;
    })
    .join('\n\n');
}

function formatDealsForAI(deals: Awaited<ReturnType<typeof getDeals>>): string {
  if (!deals?.length) return '';
  return deals
    .map(
      (d, i) => `عرض ${i + 1}: ${d.nameAr}
  السعر: ${d.bestPrice} ريال
  المتجر: ${d.bestStore}
  المتوسط: ${d.averagePrice} ريال
  أرخص من المتوسط: ${d.discountPct}٪
  القوة: ${d.strength === 'hot' ? 'عرض قوي 🔥' : 'سعر جيد ✅'}
  السبب: ${d.reason}
  رابط المقارنة: ${SITE_URL}${d.compareUrl}`
    )
    .join('\n\n');
}

/**
 * DISABLED BY DEFAULT — Phase 2 unit P2-1, Constitution Appendix F7.
 *
 * MEASURED 2026-07-31, in production: this endpoint answered an ANONYMOUS POST with 200 and
 * LLM-generated Arabic, calling Anthropic on our API key. It is referenced by NOTHING —
 * zero matches across the web app and the mobile app. It served no customer while being able
 * to make shopping claims at runtime under no verified vocabulary constraint, which is exactly
 * what F7 exists to govern:
 *
 *   "No repository search catches what the assistant says in a live answer."
 *
 * It is not a general-purpose proxy — its system prompt correctly refuses off-topic requests
 * (verified: it declined to write a poem). The problem is narrower and still real: an ungoverned
 * generative surface, open and billable, with no offsetting customer value.
 *
 * The customer-facing advisor is unaffected. `/advisor` is DETERMINISTIC — it calls
 * `POST /api/v1/agent/decide`, which makes no model call at all.
 *
 * NOT DELETED, deliberately. The prompt work here is the starting point for P2-5, when the
 * assistant becomes generative *after* F7's protections are real. Re-enable with
 * `AI_ASSISTANT_ENABLED=1`, and only once the F7 checklist is satisfied: no claim outside the
 * approved vocabulary, no merchant discount presented as ours, absence stated plainly, and an
 * adversarial test run against a retailer with no provenance and a category we do not cover.
 *
 * 404 rather than 403: a disabled surface should not advertise that it exists.
 */
const AI_ASSISTANT_ENABLED = process.env.AI_ASSISTANT_ENABLED === '1';

export async function POST(request: NextRequest) {
  if (!AI_ASSISTANT_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  console.log('[AI] Step 0 — POST reached');
  try {
    const { message, conversationHistory = [] } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error('[AI] ANTHROPIC_API_KEY missing');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const intent = await extractSearchIntent(message, apiKey);
    console.log('[AI] Step 1 — intent:', JSON.stringify(intent));

    // توجيه المتجر: لو ذكر المستخدم متجراً بعينه، نوجّه وفّر لإبرازه
    const storeHint = intent.store
      ? `\n\nملاحظة: المستخدم يسأل عن متجر "${intent.store}" تحديداً — أبرز سعر هذا المتجر من قائمة المتاجر في النتائج أولاً، وقارنه بالبقية. لو المتجر غير موجود في النتائج، أخبره بصدق واعرض المتاجر المتوفرة.`
      : '';

    let dynamicContext = '';

    // F7·2 — THE EVIDENCE THIS ANSWER IS ALLOWED TO REST ON.
    //
    // Accumulated from the SAME facts that build `dynamicContext`, so the validator judges the
    // answer against what the generator was actually given — not against a second lookup that
    // could disagree with it. Anything not recorded here is, by construction, something the
    // answer may not state: the validator treats an unbacked figure or an unsupplied retailer
    // as a rejection, because unknown beats incorrect.
    const answerEvidence: { figures: EvidenceFigure[]; retailers: string[] } = {
      figures: [],
      retailers: [],
    };
    const noteRetailer = (name?: string | null) => {
      if (name && !answerEvidence.retailers.includes(name)) answerEvidence.retailers.push(name);
    };

    if (intent.type === 'deals') {
      console.log('[AI] Step 2 — calling getDeals');
      let deals = await getDeals(6).catch((e) => { console.error('[AI] getDeals error:', e); return []; });
      let isStrictDeals = true;

      if (!deals.length) {
        deals = await getDeals(6, 0).catch((e) => { console.error('[AI] getDeals(relaxed) error:', e); return []; });
        isStrictDeals = false;
      }
      console.log('[AI] Step 3 — deals:', deals.length, '| strict:', isStrictDeals);

      for (const d of deals as Array<Record<string, unknown>>) {
        noteRetailer(typeof d.store_name === 'string' ? d.store_name : null);
      }

      dynamicContext = deals.length
        ? `

✅ ${isStrictDeals ? 'عروض اليوم الحقيقية' : 'لا توجد عروض قوية حالياً — لكن هذه أفضل الأسعار المتوفرة الآن مقارنة بمتوسطها المسجّل'} من توفيري — استخدمها فقط ولا تخترع غيرها:

${formatDealsForAI(deals)}

صفحة كل العروض: ${SITE_URL}/ar/deals

تعليمات العرض: اعرض كل منتج بهذا الشكل:
${isStrictDeals ? '🔥' : '✅'} **[اسم المنتج]**
🏆 [السعر] ريال لدى [المتجر]
💰 أرخص من متوسطه بـ [النسبة]٪
📊 [قارن الأسعار](رابط المقارنة)
---
${isStrictDeals ? 'وأكد أنها عروض محسوبة من تاريخ الأسعار الفعلي.' : 'وكن صادقاً: هذه أفضل الأسعار الحالية وليست عروضاً قوية — الأسعار مستقرة هذا الأسبوع.'}`
        : `

❌ لا بيانات أسعار كافية حالياً. اقترح صفحة العروض: ${SITE_URL}/ar/deals`;
    } else if (intent.type === 'advice') {
      console.log('[AI] Step 2b — calling searchProducts');
      const products = intent.query
        ? await searchProducts(intent.query, intent.maxPrice, intent.minPrice)
        : null;
      console.log('[AI] Step 3b — products:', products?.length ?? 0);

      const tpsProduct = products?.find(
        (p: any) => p.tps_compare_url && p.product_id
      );

      console.log('[AI] Step 4b — tpsProduct:', tpsProduct ? 'found' : 'none');

      // Every retailer named in the supplied results, and the store count as a LIVE-QUERY
      // figure — the distinction §9 turns on, and the one no text scan can make.
      for (const p of (products ?? []) as Array<Record<string, unknown>>) {
        noteRetailer(typeof p.store_name === 'string' ? p.store_name : null);
        const stores = Array.isArray(p.stores) ? (p.stores as Array<Record<string, unknown>>) : [];
        for (const s of stores) noteRetailer(typeof s.store_name === 'string' ? s.store_name : null);
        if (typeof p.store_count === 'number') {
          answerEvidence.figures.push({ value: p.store_count, kind: 'retailer-count', derivedFrom: 'live-query' });
        }
      }
      const intel = tpsProduct
        ? await getPriceIntelligence(tpsProduct.product_id).catch((e) => { console.error('[AI] getPriceIntelligence error:', e); return null; })
        : null;

      if (tpsProduct && intel) {
        dynamicContext = `

✅ ذكاء سعري حقيقي من توفيري للمنتج "${tpsProduct.name_ar || tpsProduct.name_en}" — استخدمه فقط ولا تخترع أرقاماً:

أفضل سعر رصدناه: ${intel.currentBestPrice} ريال
أقل سعر مسجّل: ${intel.lowestEver} ريال ${intel.isLowestEver ? '(هذا أقل سعر رصدناه! 🔥)' : ''}
متوسط السعر: ${intel.average} ريال (الفرق عن المتوسط: ${intel.diffFromAverage}٪)
الاتجاه: ${intel.trend === 'falling' ? 'في انخفاض ↓' : intel.trend === 'rising' ? 'في ارتفاع ↑' : 'مستقر'}
التقييم: ${intel.dealText}
أيام التتبع: ${intel.trackingDays}
رابط المقارنة: ${SITE_URL}${tpsProduct.tps_compare_url}

تعليمات النصيحة: انصح بصراحة —
- لو أقل سعر مسجّل: "اشترِ الآن 🔥"
- لو أقل من المتوسط: "سعر جيد ✅"
- لو أعلى من المتوسط: "انتظر — السعر مرتفع حالياً"
واذكر: أقل سعر مسجّل، المتوسط، الاتجاه، ورابط المقارنة.

${products?.length ? `وهذه نتائج البحث للسياق:\n\n${formatProductsForAI(products)}` : ''}${storeHint}`;
      } else if (products?.length) {
        dynamicContext = `

✅ نتائج حقيقية من توفيري — استخدمها فقط (لا يتوفر ذكاء سعري لهذا المنتج بعد، فانصح بناءً على مقارنة الأسعار بين المتاجر بصراحة وتواضع):

${formatProductsForAI(products)}${storeHint}`;
      } else {
        dynamicContext = `

❌ ما لقيت المنتج. أخبر المستخدم بلطف واقترح:
1. البحث مباشرة: ${SITE_URL}/ar/search
2. تغيير كلمات البحث`;
      }
    } else {
      console.log('[AI] Step 2s — search branch, calling searchProducts');
      const products = intent.query
        ? await searchProducts(intent.query, intent.maxPrice, intent.minPrice)
        : null;
      console.log('[AI] Step 3s — products:', products?.length ?? 0);

      for (const p of (products ?? []) as Array<Record<string, unknown>>) {
        noteRetailer(typeof p.store_name === 'string' ? p.store_name : null);
        const stores = Array.isArray(p.stores) ? (p.stores as Array<Record<string, unknown>>) : [];
        for (const s of stores) noteRetailer(typeof s.store_name === 'string' ? s.store_name : null);
        if (typeof p.store_count === 'number') {
          answerEvidence.figures.push({ value: p.store_count, kind: 'retailer-count', derivedFrom: 'live-query' });
        }
      }

      const productsContext = products?.length
        ? formatProductsForAI(products)
        : '';

      dynamicContext = productsContext
        ? `

✅ نتائج حقيقية من توفيري — استخدمها فقط:

${productsContext}

تعليمات العرض:
أبرز الأرخص 🏆،
وأضف 📊 رابط المقارنة،
ولا تخترع مقدار التوفير إذا لم يكن موجوداً في البيانات.${storeHint}`
        : `

❌ ما لقيت نتائج. أخبر المستخدم بلطف واقترح:
1. البحث مباشرة: ${SITE_URL}/ar/search
2. تغيير كلمات البحث
3. توسيع الميزانية`;
    }

    const messages = [
      ...conversationHistory,
      {
        role: 'user',
        content: message,
      },
    ];

    // system: البلوك الأساسي (cached) + البلوك الديناميكي فقط إن كان غير فارغ
    const systemBlocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [
      {
        type: 'text',
        text: WAFFAR_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ];
    const trimmedContext = dynamicContext.trim();
    if (trimmedContext.length > 0) {
      systemBlocks.push({ type: 'text', text: dynamicContext });
    }

    console.log('[AI] Step 5 — calling Anthropic | contextLen:', trimmedContext.length, '| blocks:', systemBlocks.length);

    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta':
            'prompt-caching-2024-07-31',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemBlocks,
          messages,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI] Anthropic API error | status:', response.status, '| body:', errText);

      return NextResponse.json(
        { error: 'AI service error' },
        { status: 500 }
      );
    }

    const data = await response.json();

    const reply =
      data.content?.[0]?.text ||
      'عذراً، ما قدرت أساعدك. حاول مرة ثانية.';

    const cacheStats = data.usage;

    if (cacheStats?.cache_read_input_tokens > 0) {
      console.log(
        `✅ Cache hit: ${cacheStats.cache_read_input_tokens} tokens saved`
      );
    }

    console.log('[AI] Step 6 — generated, replyLen:', reply.length);

    // ── F7·2 · THE ENFORCEMENT POINT (ADR-158) ───────────────────────────────────────────
    //
    // AFTER generation, before the answer can leave the process. Not a prompt instruction: a
    // prompt is a request, and F7 exists because requests are not guarantees.
    //
    // On any finding — or on the validator being unable to run — the generated text is
    // SUPPRESSED WHOLE. It is never edited, spliced, or swapped for other approved copy: those
    // are the routes by which a claim nobody wrote reaches a customer. The response says
    // explicitly that it was suppressed, so the client falls back to its deterministic answer
    // rather than rendering silence it cannot explain.
    const verdict = validateGeneratedAnswer(reply, answerEvidence);
    recordValidationEvent({
      verdict,
      query: String(message),
      generated: reply,
      surface: 'api/ai-assistant',
      timestamp: new Date().toISOString(),
    });

    if (!verdict.publish) {
      console.warn(
        `[AI] F7 SUPPRESSED (${verdict.outcome})`,
        verdict.unavailableReason ?? verdict.findings.map((f) => f.ruleId).join(','),
      );
      // 200, not an error: nothing failed for the customer. The generated phrasing was withheld
      // and the caller owns the deterministic answer — this endpoint has none to substitute, and
      // inventing one here is exactly the fabrication the rule forbids.
      return NextResponse.json({
        reply: null,
        suppressed: true,
        suppressedBy: 'f7-vocabulary-validator',
        outcome: verdict.outcome,
        violatedRules: [...new Set(verdict.findings.map((f) => f.ruleId))],
        ...(verdict.unavailableReason ? { unavailableReason: verdict.unavailableReason } : {}),
        // History is NOT extended with a suppressed answer: carrying it forward would feed a
        // rejected claim back into the next turn's context as if we had said it.
        updatedHistory: conversationHistory,
      });
    }

    console.log('[AI] Step 7 — validated, publishing');

    return NextResponse.json({
      reply,
      updatedHistory: [
        ...conversationHistory,
        {
          role: 'user',
          content: message,
        },
        {
          role: 'assistant',
          content: reply,
        },
      ],
    });
  } catch (error) {
    console.error('[AI] FATAL:', error);
    if (error instanceof Error) console.error('[AI] Stack:', error.stack);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}