// s

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const maxDuration = 900;
export const dynamic = 'force-dynamic';

// ─── Schema المنتج لـ Firecrawl v2 ──────────────────────────
const PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name_ar:       { type: 'string', description: 'اسم المنتج بالعربي كاملاً' },
          name_en:       { type: 'string', description: 'Product name in English if available' },
          brand:         { type: 'string', description: 'العلامة التجارية (مثل: سامسونج، أبل، هواوي...)' },
          current_price: { type: 'number', description: 'السعر الحالي رقم فقط بدون ريال أو أي نص' },
          original_price:{ type: ['number', 'null'], description: 'السعر الأصلي قبل الخصم أو null' },
          product_url:   { type: 'string', description: 'الرابط الكامل للمنتج يبدأ بـ https' },
          image_url:     { type: ['string', 'null'], description: 'رابط صورة المنتج أو null' },
          category:      { type: 'string', description: 'smartphone|laptop|tv|audio|appliance|kitchen|accessories' },
          availability:  { type: 'string', description: 'in_stock أو out_of_stock' },
        },
        required: ['name_ar', 'current_price', 'product_url'],
      },
    },
  },
  required: ['products'],
};

// ─── Firecrawl JSON extraction (v2) ─────────────────────
async function scrapeWithSchema(url: string): Promise<any[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    console.error('[Firecrawl] API key missing');
    return [];
  }

  console.log(`[Firecrawl] Scraping: ${url}`);

  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        url,
        formats: [
          'markdown', // للـ debugging
          {
            type: 'json',
            schema: PRODUCT_SCHEMA,
            prompt: 'استخرج جميع المنتجات المعروضة في الصفحة بشكل دقيق. ركز على قائمة المنتجات الرئيسية فقط، واستخرج الأسماء والأسعار والروابط والصور.',
          }
        ],
        onlyMainContent: true,
        timeout: 60000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Firecrawl] Error ${res.status}: ${err}`);
      return [];
    }

    const data = await res.json();
    console.log(`[Firecrawl] Success: ${data.success || false}`);

    // استخراج المنتجات (حسب هيكل الرد في v2)
    const products = data.data?.json?.products 
                  || data.json?.products 
                  || data.data?.products 
                  || data.products 
                  || [];

    console.log(`[Firecrawl] Found ${products.length} products from ${url}`);
    return Array.isArray(products) ? products : [];
  } catch (err) {
    console.error(`[Firecrawl] Exception:`, err);
    return [];
  }
}

// ─── حفظ في Supabase ──────────────────────────────────────
async function saveProducts(
  products: any[],
  storeName: string,
  affiliateFn: (url: string) => string
): Promise<number> {
  const supabase = createServerClient();
  let saved = 0;

  for (const p of products) {
    if (!p.name_ar || !p.current_price || p.current_price <= 0) continue;
    if (!p.product_url?.startsWith('http')) continue;

    try {
      const finalUrl = affiliateFn(p.product_url);

      const { data: product, error } = await supabase
        .from('products')
        .upsert({
          name_ar: p.name_ar.trim(),
          name_en: p.name_en || p.name_ar,
          brand: p.brand || 'Unknown',
          category: p.category || 'accessories',
          is_active: true,
        }, { onConflict: 'name_ar' })
        .select('id')
        .single();

      if (error || !product) {
        console.error('[Save] error:', error?.message);
        continue;
      }

      await supabase
        .from('product_stores')
        .upsert({
          product_id: product.id,
          store_name: storeName,
          current_price: p.current_price,
          original_price: p.original_price || null,
          product_url: finalUrl,
          availability: p.availability || 'in_stock',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,store_name' });

      saved++;
      console.log(`[Save] ✅ ${p.name_ar} - ${p.current_price} ريال`);
    } catch (err) {
      console.error('[Save] exception:', err);
    }
  }
  return saved;
}

// ─── المتاجر ──────────────────────────────────────────────
const STORES = [
  {
    slug: 'almanea',
    name: 'المنيع',
    url: 'https://www.almanea.sa/ar/mobiles-tablets',
    affiliate: (u: string) => u,
  },
  {
    slug: 'extra',
    name: 'اكسترا',
    url: 'https://www.extra.com/ar-sa/c/smartphones',
    affiliate: (u: string) => u,
  },
  {
    slug: 'jarir',
    name: 'جرير',
    url: 'https://www.jarir.com/sa-ar/computers-tablets.html',
    affiliate: (u: string) => u,
  },
  {
    slug: 'amazon',
    name: 'أمازون',
    url: 'https://www.amazon.sa/s?i=electronics&rh=n%3A11995771031',
    affiliate: (u: string) => u + (u.includes('?') ? '&' : '?') + 'tag=tawveeri-21',
  },
  {
    slug: 'noon',
    name: 'نون',
    url: 'https://www.noon.com/saudi-ar/mobiles-tablets/',
    affiliate: (u: string) => u,
  },
];

// ─── MAIN ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const targetSlug = body.store_slug;
  const stores = targetSlug 
    ? STORES.filter(s => s.slug === targetSlug) 
    : STORES;

  const results: Record<string, any> = {};
  let totalSaved = 0;

  for (const store of stores) {
    console.log(`\n[discover] ═══ ${store.name} ═══`);

    try {
      const products = await scrapeWithSchema(store.url);

      if (products.length === 0) {
        results[store.slug] = { store: store.name, saved: 0, note: 'no products found' };
        continue;
      }

      const saved = await saveProducts(products, store.name, store.affiliate);
      results[store.slug] = { 
        store: store.name, 
        extracted: products.length, 
        saved 
      };
      totalSaved += saved;
    } catch (err) {
      console.error(`[discover] ${store.name} failed:`, err);
      results[store.slug] = { error: String(err) };
    }

    // تأخير بسيط بين المتاجر
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n[discover] Total saved: ${totalSaved}`);
  return NextResponse.json({ 
    success: true, 
    total_saved: totalSaved, 
    results 
  });
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Firecrawl discovery endpoint (v2)',
    stores: STORES.map(s => s.slug),
  });
}
