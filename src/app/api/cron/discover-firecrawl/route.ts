import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const maxDuration = 900;
export const dynamic = 'force-dynamic';

// ─── Firecrawl SDK مباشرة بدون fetch يدوي ────────────────
async function firecrawlScrape(url: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error('FIRECRAWL_API_KEY missing');

  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 60000,
    }),
  });

  if (!res.ok) {
    console.error(`[Firecrawl] ${res.status} for ${url}`);
    return '';
  }

  const data = await res.json();
  return data.data?.markdown || data.markdown || '';
}

// ─── Claude يستخرج المنتجات من الـ Markdown ──────────────
async function extractProducts(markdown: string, storeName: string): Promise<any[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || markdown.length < 200) return [];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `أنت مساعد استخراج بيانات. استخرج المنتجات من هذا النص لمتجر ${storeName}.

النص:
${markdown.slice(0, 6000)}

أرجع JSON array فقط بدون أي نص آخر:
[{"name_ar":"اسم المنتج","name_en":"product name","brand":"العلامة","category":"smartphone|laptop|tv|audio|appliance|accessories","current_price":0,"product_url":"https://...","availability":"in_stock"}]

شروط:
- current_price رقم فقط بدون ريال
- product_url رابط كامل يبدأ بـ https
- إذا ما في منتجات واضحة أرجع []`,
      }],
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return Array.isArray(result) ? result : [];
  } catch { return []; }
}
// ─── حفظ فوري في Supabase ────────────────────────────────
async function saveToSupabase(
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
     // ١. أضف كود الـ affiliate
     const finalUrl = affiliateFn(p.product_url);

     // ٢. احفظ المنتج
     const { data: product, error: pErr } = await supabase
       .from('products')
       .upsert({
         name_ar: p.name_ar,
         name_en: p.name_en || p.name_ar,
         brand: p.brand || 'Unknown',
         category: p.category || 'accessories',
         is_active: true,
       }, { onConflict: 'name_ar' })
       .select('id')
       .single();

     if (pErr || !product) {
       console.error('[Save] product error:', pErr?.message);
       continue;
     }

     // ٣. احفظ السعر في المتجر
     await supabase
       .from('product_stores')
       .upsert({
         product_id: product.id,
         store_name: storeName,
         current_price: p.current_price,
         product_url: finalUrl,
         availability: p.availability || 'in_stock',
         updated_at: new Date().toISOString(),
       }, { onConflict: 'product_id,store_name' });

     saved++;
   } catch (err) {
     console.error('[Save] error:', err);
   }
 }

 return saved;
}

// ─── المتاجر ─────────────────────────────────────────────
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
   url: 'https://www.extra.com/ar-sa/c/electronics',
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
   url: 'https://www.amazon.sa/s?i=electronics',
   affiliate: (u: string) =>
     u + (u.includes('?') ? '&' : '?') + 'tag=tawveeri-21',
 },
 {
   slug: 'noon',
   name: 'نون',
   url: 'https://www.noon.com/saudi-ar/electronics/',
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
   console.log(`[discover] Starting: ${store.name}`);
   try {
     // Firecrawl يجلب الصفحة
     const markdown = await firecrawlScrape(store.url);
     console.log(`[discover] ${store.name}: ${markdown.length} chars`);

     if (markdown.length < 200) {
       results[store.slug] = { store: store.name, saved: 0, error: 'empty markdown' };
       continue;
     }

     // Claude يستخرج المنتجات
     const products = await extractProducts(markdown, store.name);
     console.log(`[discover] ${store.name}: ${products.length} products extracted`);

     // حفظ فوري في Supabase
     const saved = await saveToSupabase(products, store.name, store.affiliate);
     console.log(`[discover] ${store.name}: ${saved} saved`);

     results[store.slug] = { store: store.name, saved };
     totalSaved += saved;
   } catch (err) {
     console.error(`[discover] ${store.name} failed:`, err);
     results[store.slug] = { error: String(err) };
   }

   // rate limit بين المتاجر
   await new Promise(r => setTimeout(r, 3000));
 }

 return NextResponse.json({ success: true, total_saved: totalSaved, results });
}

export async function GET() {
 return NextResponse.json({
   status: 'ok',
   message: 'Firecrawl discovery endpoint',
   stores: STORES.map(s => s.slug),
 });
}
