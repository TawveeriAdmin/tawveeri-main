import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const VERSION = 'tawveeri-search-DIAG-2026-06-13';

function j(data: Record<string, any>) {
  return NextResponse.json({ version: VERSION, ...data }, { headers: { 'Cache-Control': 'no-store' } });
}

// ملف تشخيص مستقل — ملف api/search الحي لا يُمسّ
// افتح من المتصفح: https://tawveeri.com/api/search-diag?q=samsung
export async function GET(request: NextRequest) {
  const sb = createServerClient();
  const q = new URL(request.url).searchParams.get('q')?.trim() || 'samsung';
  const out: Record<string, any> = { q, steps: {} };

  // الطبقة 1: products لحاله، بدون أي شي
  try {
    const { data, count, error } = await sb
      .from('products')
      .select('id', { count: 'exact' })
      .limit(1);
    out.steps.step1_products_only = { count: count ?? null, got: data?.length ?? 0, error: error?.message || null };
  } catch (e: any) { out.steps.step1_products_only = { threw: String(e?.message || e) }; }

  // الطبقة 2: products + فلتر is_active
  try {
    const { data, count, error } = await sb
      .from('products')
      .select('id', { count: 'exact' })
      .eq('is_active', true)
      .limit(1);
    out.steps.step2_is_active = { count: count ?? null, got: data?.length ?? 0, error: error?.message || null };
  } catch (e: any) { out.steps.step2_is_active = { threw: String(e?.message || e) }; }

  // الطبقة 3: products + بحث ilike على الاسم
  try {
    const { data, count, error } = await sb
      .from('products')
      .select('id,name_ar,name_en', { count: 'exact' })
      .eq('is_active', true)
      .or(`name_ar.ilike.%${q}%,name_en.ilike.%${q}%`)
      .limit(3);
    out.steps.step3_ilike_search = {
      count: count ?? null, got: data?.length ?? 0, error: error?.message || null,
      sample: (data || []).map((r: any) => r.name_en || r.name_ar),
    };
  } catch (e: any) { out.steps.step3_ilike_search = { threw: String(e?.message || e) }; }

  // الطبقة 4: products + product_stores (بدون !inner) — join اختياري
  try {
    const { data, count, error } = await sb
      .from('products')
      .select('id,name_en,product_stores(store_name,current_price)', { count: 'exact' })
      .eq('is_active', true)
      .or(`name_ar.ilike.%${q}%,name_en.ilike.%${q}%`)
      .limit(3);
    out.steps.step4_with_stores_LEFT = {
      count: count ?? null, got: data?.length ?? 0, error: error?.message || null,
      sample: (data || []).map((r: any) => ({ n: r.name_en, stores: (r.product_stores || []).length })),
    };
  } catch (e: any) { out.steps.step4_with_stores_LEFT = { threw: String(e?.message || e) }; }

  // الطبقة 5: products + product_stores!inner — الـ join الإجباري (المشتبه به)
  try {
    const { data, count, error } = await sb
      .from('products')
      .select('id,name_en,product_stores!inner(store_name,current_price)', { count: 'exact' })
      .eq('is_active', true)
      .or(`name_ar.ilike.%${q}%,name_en.ilike.%${q}%`)
      .limit(3);
    out.steps.step5_with_stores_INNER = {
      count: count ?? null, got: data?.length ?? 0, error: error?.message || null,
      sample: (data || []).map((r: any) => ({ n: r.name_en, stores: (r.product_stores || []).length })),
    };
  } catch (e: any) { out.steps.step5_with_stores_INNER = { threw: String(e?.message || e) }; }

  // الطبقة 6: نفس استعلام البحث الكامل (الأعمدة كاملة)
  try {
    const sel = `id, name_ar, name_en, slug, brand, model, category, sku, image_urls, specifications, description_ar, description_en, product_stores!inner ( id, store_name, current_price, original_price, availability, product_url, coupon_code )`;
    const { data, count, error } = await sb
      .from('products')
      .select(sel, { count: 'exact' })
      .eq('is_active', true)
      .or(`name_ar.ilike.%${q}%,name_en.ilike.%${q}%`)
      .limit(3);
    out.steps.step6_full_select = {
      count: count ?? null, got: data?.length ?? 0, error: error?.message || null,
    };
  } catch (e: any) { out.steps.step6_full_select = { threw: String(e?.message || e) }; }

  // تشخيص product_stores مباشرة: كم صف إجمالاً
  try {
    const { count: total } = await sb.from('product_stores').select('id', { count: 'exact', head: true });
    out.steps.product_stores_total = total ?? null;
  } catch (e: any) { out.steps.product_stores_total = { threw: String(e?.message || e) }; }

  return j(out);
}

export async function POST() {
  return j({ note: 'DIAG MODE — استخدم GET للتشخيص: /api/search-diag?q=samsung', products: [], count: 0, total: 0 });
}
