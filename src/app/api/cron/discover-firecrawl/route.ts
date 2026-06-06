import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const maxDuration = 900;
export const dynamic = 'force-dynamic';

const PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name_ar:       { type: 'string', description: 'اسم المنتج بالعربي كاملاً' },
          name_en:       { type: 'string' },
          brand:         { type: 'string' },
          current_price: { type: 'number' },
          original_price:{ type: ['number', 'null'] },
          product_url:   { type: 'string' },
          image_url:     { type: ['string', 'null'] },
          category:      { type: 'string' },
          availability:  { type: 'string' },
        },
        required: ['name_ar', 'current_price', 'product_url'],
      },
    },
  },
  required: ['products'],
};

async function scrapeWithSchema(url: string): Promise<any[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];

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
          'markdown',
          { 
            type: 'json', 
            schema: PRODUCT_SCHEMA, 
            prompt: 'استخرج كل المنتجات الرئيسية في الصفحة مع أسمائها وأسعارها الحالية والأصلية وروابطها بدقة عالية.' 
          }
        ],
        onlyMainContent: true,
        timeout: 60000,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const products = data.data?.json?.products || data.json?.products || [];
    console.log(`[Firecrawl] Found ${products.length} products from ${url}`);
    return Array.isArray(products) ? products : [];
  } catch (err) {
    console.error('[Firecrawl] Error:', err);
    return [];
  }
}

async function saveProducts(products: any[], storeName: string, affiliateFn: (u: string) => string) {
  const supabase = createServerClient();
  let saved = 0;
  for (const p of products) {
    if (!p.name_ar?.trim() || !p.current_price || p.current_price <= 0) continue;
    try {
      const { data: product } = await supabase
        .from('products')
        .upsert({
          name_ar: p.name_ar.trim(),
          name_en: p.name_en || p.name_ar,
          brand: p.brand || 'Unknown',
          is_active: true,
        }, { onConflict: 'name_ar' })
        .select('id')
        .single();

      if (product) {
        await supabase.from('product_stores').upsert({
          product_id: product.id,
          store_name: storeName,
          current_price: p.current_price,
          original_price: p.original_price || null,
          product_url: affiliateFn(p.product_url),
          availability: p.availability || 'in_stock',
          updated_at: new Date().toISOString(),
        });
        saved++;
      }
    } catch (e) { console.error(e); }
  }
  return saved;
}

const STORES = [
  { slug: 'almanea', name: 'المنيع', url: 'https://www.almanea.sa/ar/mobiles-tablets', affiliate: (u: string) => u },
  // أضف باقي المتاجر هنا...
];

// GET - للاختبار من المتصفح
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetSlug = searchParams.get('store_slug');

  if (!targetSlug) {
    return NextResponse.json({ 
      status: 'ok', 
      message: 'استخدم ?store_slug=almanea للاختبار' 
    });
  }

  const store = STORES.find(s => s.slug === targetSlug);
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const products = await scrapeWithSchema(store.url);
  const saved = await saveProducts(products, store.name, store.affiliate);

  return NextResponse.json({
    success: true,
    store: store.name,
    extracted: products.length,
    saved: saved,
    note: products.length === 0 ? 'لم يتم استخراج منتجات - تحقق من Logs' : ''
  });
}

// POST (للـ Cron)
export async function POST() {
  return NextResponse.json({ message: "POST endpoint ready for cron" });
}
