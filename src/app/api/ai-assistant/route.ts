import { NextRequest, NextResponse } from 'next/server';
import { validateGeneratedAnswer, recordValidationEvent } from '@/lib/vocabulary';
import { buildPublishedEvidence, customerPrice } from '@/lib/agent/published-evidence';
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
            `${s.store_name || s.store}: ${customerPrice(s.current_price)} ريال — ${s.product_url}`
        )
        .join('\n  ');

      const compareLine = p.tps_compare_url
        ? `\n  رابط المقارنة (كل المتاجر + الذكاء السعري): ${SITE_URL}${p.tps_compare_url}`
        : '';

      return `منتج ${i + 1}: ${p.name_ar || p.name_en}
  أفضل سعر: ${customerPrice(p.best_price)} ريال${
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
  السعر: ${customerPrice(d.bestPrice)} ريال
  المتجر: ${d.bestStore}
  المتوسط: ${customerPrice(d.averagePrice)} ريال
  أرخص من المتوسط: ${d.discountPct}٪
  القوة: ${d.strength === 'hot' ? 'عرض قوي 🔥' : 'سعر جيد ✅'}
  السبب: ${d.reason}
  رابط المقارنة: ${SITE_URL}${d.compareUrl}`
    )
    .join('\n\n');
}

/**
 * MEASURED LIVE 2026-08-09 (founder Unified Intelligence audit) — this comment previously
 * said "DISABLED BY DEFAULT" and described the flag as off. It is NOT off: a direct
 * unauthenticated POST to this route in production returned 200 with a live LLM-generated
 * reply, meaning `AI_ASSISTANT_ENABLED=1` is currently set in the production environment.
 * Nobody updated this comment when that changed, or documented why.
 *
 * The code below DOES now wire up F7 enforcement (`validateGeneratedAnswer` /
 * `recordValidationEvent`, see the POST handler) — a real answer-suppression gate that did
 * not exist when this comment was first written — so the specific "no repository search
 * catches what the assistant says" risk this comment originally raised is at least
 * partially addressed. What is UNCHANGED: this endpoint is still referenced by NOTHING —
 * zero matches across the web app and the mobile app (re-verified 2026-08-09) — so it is a
 * live, anonymously-callable, billable (Anthropic API on the founder's key) surface with NO
 * product entry point routing any real customer to it. Deliberately NOT deleted or modified
 * further here: `WAFFAR_SYSTEM_PROMPT` above is cache-protected (standing directive — never
 * edit in place without explicit founder approval), and whether this endpoint should be
 * (a) turned back off, (b) given a real product surface now that F7 exists, or (c) left as
 * an internal-only prototype behind a stronger gate than an env flag, is a product decision
 * this session did not make unilaterally. Flagged prominently in the mission's final report.
 *
 * 404 rather than 403 when disabled: a disabled surface should not advertise that it exists.
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
    // MEASURED DEFECT, 2026-08-01, first production session: 6 of 7 answers were suppressed,
    // 5 of them by `saving-or-price-without-provenance`. The cause was HERE — this bundle
    // carried retailer names and store counts and NOT ONE price, while the prompt below is
    // built from prices. Every price the model stated was real, supplied, and undeclared, so
    // the validator correctly refused to certify it.
    //
    // THE GUARD WAS RIGHT AND THIS ROUTE'S CONTRACT WAS INCOMPLETE — the same defect ADR-162
    // fixed for the decision engine, on the one route that never received the fix.
    //
    // It now uses THE SAME CONTRACT, not a copy of it: facts are collected in the shape
    // `buildPublishedEvidence` already understands and handed to it. There is one builder, one
    // provenance vocabulary, and no route-specific evidence rule — a second bundle format would
    // be a second policy, which is exactly what F7·1 exists to prevent.
    const evidenceItems: Array<{
      unit_price?: number | null;
      store_count?: number | null;
      stores?: string[] | null;
    }> = [];
    const retailers = new Set<string>();
    const noteRetailer = (name?: string | null) => {
      if (name && name.trim()) retailers.add(name.trim());
    };
    /** Publish one observed price. A figure with no value is not published — and so must not be rendered. */
    const notePrice = (value: unknown, storeCount?: unknown, stores?: string[] | null) => {
      // Declare the CUSTOMER-VISIBLE value — the same number the prompt shows. Publishing the
      // raw observation while showing a rounded one is the mismatch that suppressed 7 of 11.
      const price = typeof value === 'number' && Number.isFinite(value) ? customerPrice(value) : null;
      if (price === null && storeCount === undefined) return;
      evidenceItems.push({
        unit_price: price,
        store_count: typeof storeCount === 'number' ? storeCount : null,
        stores: stores ?? null,
      });
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
        noteRetailer(typeof d.bestStore === 'string' ? d.bestStore : null);
        // `formatDealsForAI` prints BOTH of these, so both must be declared.
        notePrice(d.bestPrice);
        notePrice(d.averagePrice);
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
        const names: string[] = [];
        for (const s of stores) {
          const n = typeof s.store_name === 'string' ? s.store_name : (typeof s.store === 'string' ? s.store : null);
          noteRetailer(n);
          if (n) names.push(n);
          // EVERY per-store price `formatProductsForAI` prints into the prompt. A price in the
          // prompt and not in the evidence is the exact gap that suppressed 5 of 7 answers.
          notePrice(s.current_price);
          notePrice(s.original_price);
        }
        notePrice(p.best_price, p.store_count, names);
      }
      const intel = tpsProduct
        ? await getPriceIntelligence(tpsProduct.product_id).catch((e) => { console.error('[AI] getPriceIntelligence error:', e); return null; })
        : null;

      if (tpsProduct && intel) {
        // Every price-intelligence figure the block below prints. Declared here, beside the
        // render, so the two cannot drift — the same discipline `explainChoice` uses for its
        // delta (ADR-162).
        notePrice((intel as unknown as Record<string, unknown>).currentBestPrice);
        notePrice((intel as unknown as Record<string, unknown>).lowestEver);
        notePrice((intel as unknown as Record<string, unknown>).average);
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
        const names: string[] = [];
        for (const s of stores) {
          const n = typeof s.store_name === 'string' ? s.store_name : (typeof s.store === 'string' ? s.store : null);
          noteRetailer(n);
          if (n) names.push(n);
          // EVERY per-store price `formatProductsForAI` prints into the prompt. A price in the
          // prompt and not in the evidence is the exact gap that suppressed 5 of 7 answers.
          notePrice(s.current_price);
          notePrice(s.original_price);
        }
        notePrice(p.best_price, p.store_count, names);
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
    // ── THE EVIDENCE BOUNDARY (ADR-167) ──────────────────────────────────────────────────
    //
    // Measured on 24 natural production journeys: 50% rejected, and 11 of 12 rejections were
    // the model stating a price nobody gave it. The facts were already in hand — the prompt
    // simply never told the model which figures it was allowed to use, so it filled the
    // template's `💰 [السعر] ريال` slot from memory and the validator correctly suppressed it.
    //
    // THIS STOPS THE MODEL GUESSING. IT DOES NOT MAKE THE VALIDATOR ACCEPT MORE. The guard is
    // unchanged and remains the final arbiter: if the model ignores this boundary, the answer is
    // still suppressed. A prompt is a request, which is exactly why F7 exists after generation.
    //
    // REORGANISES, NEVER DERIVES. Every number and name below is read verbatim from
    // `evidenceItems` / `retailers`, which ADR-166 already populated from the same fetch that
    // built the context above. Nothing is computed, rounded, summed or inferred — a boundary
    // that invented a fact would be the failure it exists to prevent.
    //
    // `WAFFAR_SYSTEM_PROMPT` IS NOT TOUCHED. This is a third system block, assembled per request.
    const permittedPrices = [...new Set(
      evidenceItems.map((e) => e.unit_price).filter((p): p is number => typeof p === 'number'),
    )];
    const permittedRetailers = [...retailers];
    const evidenceBoundary = (permittedPrices.length || permittedRetailers.length)
      ? `

⛔ حدود الأدلة — قاعدة مُلزمة:
- الأسعار المسموح ذكرها (ولا رقم غيرها): ${permittedPrices.length ? permittedPrices.join(' · ') : 'لا يوجد'}
- المتاجر المسموح تسميتها (ولا متجر غيره): ${permittedRetailers.length ? permittedRetailers.join(' · ') : 'لا يوجد'}
- إذا لم يتوفر سعر لمنتج، لا تكتب حقل السعر إطلاقاً — قل إن السعر غير متوفر.
- لا تذكر متجراً غير مذكور أعلاه، ولو كنت تعرفه.
- لا تحسب أو تقدّر أو تقرّب أي رقم. اكتب الأرقام كما هي أعلاه فقط.`
      : `

⛔ حدود الأدلة: لا تتوفر أسعار أو متاجر لهذا الطلب. لا تذكر أي سعر أو متجر إطلاقاً — قل بصدق إن البيانات غير متوفرة.`;

    const systemBlocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [
      {
        type: 'text',
        text: WAFFAR_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ];
    const trimmedContext = (dynamicContext + evidenceBoundary).trim();
    if (trimmedContext.length > 0) {
      // `trimmedContext`, not `dynamicContext` — the boundary is part of what the model sees,
      // and pushing the pre-boundary string would have made the whole unit a no-op that still
      // measured as a change.
      systemBlocks.push({ type: 'text', text: trimmedContext });
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
    // ONE CONTRACT, NOT A COPY. The same builder the decision engine uses (ADR-162), fed the
    // same objects the prompt was built from — so the validator judges the answer against what
    // the generator was actually given, and there is no route-specific evidence rule anywhere.
    const answerEvidence = buildPublishedEvidence({
      recommendations: evidenceItems,
      smart_pick: null,
    });
    answerEvidence.retailers = [...new Set([...answerEvidence.retailers, ...retailers])];

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