import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const maxDuration = 900;
export const dynamic = 'force-dynamic';

const STORES = [
  {
    slug: 'amazon', name: 'أمازون',
    urls: ['https://www.amazon.sa/s?i=electronics&rh=n%3A11995771031'],
    affiliate: (url: string) => `${url}${url.includes('?') ? '&' : '?'}tag=tawveeri-21`,
  },
  {
    slug: 'noon', name: 'نون',
    urls: ['https://www.noon.com/saudi-ar/electronics/'],
    affiliate: (url: string) => url,
  },
  {
    slug: 'extra', name: 'اكسترا',
    urls: ['https://www.extra.com/ar-sa/c/electronics'],
    affiliate: (url: string) => url,
  },
  {
    slug: 'jarir', name: 'جرير',
    urls: ['https://www.jarir.com/sa-ar/computers-tablets.html'],
    affiliate: (url: string) => url,
  },
  {
    slug: 'almanea', name: 'المنيع',
    urls: ['https://www.almanea.sa/ar/mobiles-tablets'],
    affiliate: (url: string) => url,
  },
];

async function extractProductsFromUrl(url: string, storeName: string): Promise<any[]> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!firecrawlKey || !anthropicKey) return [];

  const crawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${firecrawlKey}` },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
  });
  if (!crawlRes.ok) return [];
  const crawlData = await crawlRes.json();
  const markdown = crawlData.data?.markdown || '';
  if (markdown.length < 100) return [];

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: `استخرج المنتجات من هذا النص من متجر ${storeName}.\n\nالنص:\n${markdown.slice(0, 8000)}\n\nأرجع JSON array فقط:\n[{"name_ar":"","name_en":"","brand":"","category":"smartphone|laptop|tv|audio|appliance|kitchen|accessories","current_price":0,"original_price":null,"product_url":"","image_url":null,"availability":"in_stock"}]` }],
    }),
  });
  if (!claudeRes.ok) return [];
  const claudeData = await claudeRes.json();
  const text = claudeData.content?.[0]?.text || '[]';
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { return []; }
}
async function saveProducts(products: any[], store: typeof STORES[0]) {
 const supabase = createServerClient();
 let saved = 0;
 for (const p of products) {
   if (!p.name_ar || !p.current_price || p.current_price <= 0) continue;
   if (!p.product_url?.startsWith('http')) continue;
   try {
     const affiliateUrl = store.affiliate(p.product_url);
     const { data: product } = await supabase
       .from('products')
       .upsert({ name_ar: p.name_ar, name_en: p.name_en || p.name_ar, brand: p.brand || 'Unknown', category: p.category || 'accessories', image_url: p.image_url || null, is_active: true }, { onConflict: 'name_ar,brand' })
       .select('id').single();
     if (!product) continue;
     await supabase.from('product_stores').upsert({ product_id: product.id, store_name: store.name, current_price: p.current_price, original_price: p.original_price || null, product_url: affiliateUrl, availability: p.availability || 'in_stock', coupon_code: null, updated_at: new Date().toISOString() }, { onConflict: 'product_id,store_name' });
     saved++;
   } catch { continue; }
 }
 return { saved };
}

export async function POST(request: NextRequest) {
 const authHeader = request.headers.get('authorization');
 const cronSecret = process.env.CRON_SECRET;
 if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }
 const body = await request.json().catch(() => ({}));
 const targetStore = body.store_slug;
 const storesToProcess = targetStore ? STORES.filter(s => s.slug === targetStore) : STORES;
 const results: Record<string, any> = {};
 let totalSaved = 0;
 for (const store of storesToProcess) {
   let storeSaved = 0;
   for (const url of store.urls) {
     try {
       const products = await extractProductsFromUrl(url, store.name);
       if (products.length > 0) {
         const { saved } = await saveProducts(products, store);
         storeSaved += saved;
       }
     } catch (err) { console.error(`Error for ${store.name}:`, err); }
     await new Promise(r => setTimeout(r, 2000));
   }
   results[store.slug] = { store: store.name, saved: storeSaved };
   totalSaved += storeSaved;
 }
 return NextResponse.json({ success: true, total_saved: totalSaved, results });
}

export async function GET() {
 return NextResponse.json({ status: 'ok', message: 'Firecrawl discovery endpoint', stores: STORES.map(s => s.slug) });
}
