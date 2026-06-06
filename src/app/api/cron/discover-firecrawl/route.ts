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
          name_ar:        { type: 'string' },
          name_en:        { type: 'string' },
          brand:          { type: 'string' },
          current_price:  { type: 'number' },
          original_price: { type: 'number' },
          product_url:    { type: 'string' },
          category:       { type: 'string' },
          availability:   { type: 'string' },
        },
        required: ['name_ar', 'current_price', 'product_url'],
      },
    },
  },
};

async function scrapeWithSchema(url: string): Promise<any[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        url,
        formats: [{ type: 'json', schema: PRODUCT_SCHEMA, prompt: 'استخرج كل المنتجات مع أسمائها وأسعارها وروابطها' }],
        onlyMainContent: true,
        timeout: 60000,
      }),
    });
    if (!res.ok) { console.error(`[FC] ${res.status}`); return []; }
    const data = await res.json();
    console.log('[FC] raw:', JSON.stringify(data).slice(0, 500));
    return data.data?.json?.products || data.data?.extract?.products || data.json?.products || [];
  } catch (e) { console.error('[FC]', e); return []; }
}

async function saveProducts(products: any[], storeName: string, af: (u: string) => string): Promise<number> {
  const sb = createServerClient();
  let saved = 0;
  for (const p of products) {
    if (!p.name_ar?.trim() || !p.current_price || p.current_price <= 0) continue;
    if (!p.product_url?.startsWith('http')) continue;
    try {
      const { data: prod } = await sb.from('products')
        .upsert({ name_ar: p.name_ar.trim(), name_en: p.name_en || p.name_ar, brand: p.brand || 'Unknown', category: p.category || 'accessories', is_active: true }, { onConflict: 'name_ar' })
        .select('id').single();
      if (!prod) continue;
      await sb.from('product_stores').upsert({ product_id: prod.id, store_name: storeName, current_price: p.current_price, original_price: p.original_price || null, product_url: af(p.product_url), availability: p.availability || 'in_stock', updated_at: new Date().toISOString() }, { onConflict: 'product_id,store_name' });
      saved++;
    } catch (e) { console.error('[Save]', e); }
  }
  return saved;
}

const STORES = [
  { slug: 'almanea', name: 'المنيع', url: 'https://www.almanea.sa/ar/mobiles-tablets', affiliate: (u: string) => u },
  { slug: 'extra', name: 'اكسترا', url: 'https://www.extra.com/ar-sa/c/smartphones', affiliate: (u: string) => u },
  { slug: 'jarir', name: 'جرير', url: 'https://www.jarir.com/sa-ar/computers-tablets.html', affiliate: (u: string) => u },
  { slug: 'amazon', name: 'أمازون', url: 'https://www.amazon.sa/s?i=electronics', affiliate: (u: string) => u + (u.includes('?') ? '&' : '?') + 'tag=tawveeri-21' },
  { slug: 'noon', name: 'نون', url: 'https://www.noon.com/saudi-ar/mobiles-tablets/', affiliate: (u: string) => u },
];

export async function GET(request: NextRequest) {
  const slug = new URL(request.url).searchParams.get('store_slug');
  if (!slug) return NextResponse.json({ status: 'ok', stores: STORES.map(s => s.slug) });
  const store = STORES.find(s => s.slug === slug);
  if (!store) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const products = await scrapeWithSchema(store.url);
  const saved = await saveProducts(products, store.name, store.affiliate);
  return NextResponse.json({ success: true, store: store.name, extracted: products.length, saved });
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { store_slug } = await request.json().catch(() => ({}));
  const stores = store_slug ? STORES.filter(s => s.slug === store_slug) : STORES;
  const results: Record<string, any> = {};
  let totalSaved = 0;
  for (const store of stores) {
    const products = await scrapeWithSchema(store.url);
    const saved = await saveProducts(products, store.name, store.affiliate);
    results[store.slug] = { extracted: products.length, saved };
    totalSaved += saved;
    await new Promise(r => setTimeout(r, 2000));
  }
  return NextResponse.json({ success: true, total_saved: totalSaved, results });
}
