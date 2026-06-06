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
 if (!key) { console.error('[Firecrawl] missing key'); return []; }

 try {
   const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${key}`,
     },
     body: JSON.stringify({
       url,
       formats: ['extract'],
       extract: {
         schema: PRODUCT_SCHEMA,
         prompt: 'استخرج كل المنتجات في الصفحة مع أسمائها وأسعارها وروابطها',
       },
       onlyMainContent: true,
       timeout: 60000,
     }),
   });

   if (!res.ok) {
     console.error(`[Firecrawl] ${res.status}`);
     return [];
   }

   const data = await res.json();
   const products =
     data.data?.extract?.products ||
     data.extract?.products ||
     data.data?.products ||
     [];

   console.log(`[Firecrawl] ${url}: ${products.length} products`);
   return Array.isArray(products) ? products : [];
 } catch (err) {
   console.error('[Firecrawl] error:', err);
   return [];
 }
}

async function saveProducts(
 products: any[],
 storeName: string,
 affiliateFn: (u: string) => string
): Promise<number> {
 const supabase = createServerClient();
 let saved = 0;

 for (const p of products) {
   if (!p.name_ar?.trim() || !p.current_price || p.current_price <= 0) continue;
   if (!p.product_url?.startsWith('http')) continue;

   try {
     const { data: product } = await supabase
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

     if (!product) continue;

     await supabase.from('product_stores').upsert({
       product_id: product.id,
       store_name: storeName,
       current_price: p.current_price,
       original_price: p.original_price || null,
       product_url: affiliateFn(p.product_url),
       availability: p.availability || 'in_stock',
       updated_at: new Date().toISOString(),
     }, { onConflict: 'product_id,store_name' });

     saved++;
     console.log(`[Save] ✅ ${p.name_ar} - ${p.current_price}`);
   } catch (e) {
     console.error('[Save] error:', e);
   }
 }
 return saved;
}

const STORES = [
 { slug: 'almanea', name: 'المنيع', url: 'https://www.almanea.sa/ar/mobiles-tablets', affiliate: (u: string) => u },
 { slug: 'extra', name: 'اكسترا', url: 'https://www.extra.com/ar-sa/c/smartphones', affiliate: (u: string) => u },
 { slug: 'jarir', name: 'جرير', url: 'https://www.jarir.com/sa-ar/computers-tablets.html', affiliate: (u: string) => u },
 { slug: 'amazon', name: 'أمازون', url: 'https://www.amazon.sa/s?i=electronics&rh=n%3A11995771031', affiliate: (u: string) => u + (u.includes('?') ? '&' : '?') + 'tag=tawveeri-21' },
 { slug: 'noon', name: 'نون', url: 'https://www.noon.com/saudi-ar/mobiles-tablets/', affiliate: (u: string) => u },
];

export async function GET(request: NextRequest) {
 const { searchParams } = new URL(request.url);
 const targetSlug = searchParams.get('store_slug');

 if (!targetSlug) {
   return NextResponse.json({ status: 'ok', stores: STORES.map(s => s.slug) });
 }

 const store = STORES.find(s => s.slug === targetSlug);
 if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

 const products = await scrapeWithSchema(store.url);
 const saved = await saveProducts(products, store.name, store.affiliate);
 return NextResponse.json({ success: true, store: store.name, extracted: products.length, saved });
}

export async function POST(request: NextRequest) {
 const auth = request.headers.get('authorization');
 const secret = process.env.CRON_SECRET;
 if (secret && auth !== `Bearer ${secret}`) {
   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 const body = await request.json().catch(() => ({}));
 const targetSlug = body.store_slug;
 const stores = targetSlug ? STORES.filter(s => s.slug === targetSlug) : STORES;

 const results: Record<string, any> = {};
 let totalSaved = 0;

 for (const store of stores) {
   console.log(`[discover] ═══ ${store.name} ═══`);
   try {
     const products = await scrapeWithSchema(store.url);
     const saved = await saveProducts(products, store.name, store.affiliate);
     results[store.slug] = { store: store.name, extracted: products.length, saved };
     totalSaved += saved;
   } catch (err) {
     results[store.slug] = { error: String(err) };
   }
   await new Promise(r => setTimeout(r, 2000));
 }

 console.log(`[discover] Total saved: ${totalSaved}`);
 return NextResponse.json({ success: true, total_saved: totalSaved, results });
}
