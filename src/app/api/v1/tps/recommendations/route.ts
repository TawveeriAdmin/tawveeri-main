import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { productTrust } from '@/lib/intelligence/evidence-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tps/recommendations?canonical_id=<uuid>&limit=8
 *   (or ?category=<cat>&limit=8 for a category feed)
 * Platform API Contract v1 (E13) — DETERMINISTIC canonical recommendations keyed
 * to TPS identity. No embeddings, no LLM: deterministic engine decides (ADR-002/030).
 * Every item carries an explainable Arabic reason and a confidence, never fabricated
 * certainty. Category-aware; accessories excluded from main-product recs.
 */
interface Proj {
  canonical_id: string; tps_identity_key: string;
  display_name_ar: string | null; display_name_en: string | null;
  brand: string | null; category: string | null; image_url: string | null;
  lowest_price: number | null; store_count: number | null; has_comparison: boolean | null;
  compare_url: string | null; identity_confidence: number | null; last_observed_at: string | null;
}
// identity_key = brand|family|gen|variant|storage (mobile) or brand|type|series|btu|tech|cool (ac)
function keyParts(k: string | null | undefined): string[] { return (k || '').split('|'); }

export async function GET(req: NextRequest) {
  const canonicalId = req.nextUrl.searchParams.get('canonical_id');
  const category = req.nextUrl.searchParams.get('category');
  const limit = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 8));
  const supabase = createServerClient();

  const SEL = 'canonical_id, tps_identity_key, display_name_ar, display_name_en, brand, category, image_url, lowest_price, store_count, has_comparison, compare_url, identity_confidence, last_observed_at';

  let target: Proj | null = null;
  if (canonicalId) {
    const { data } = await supabase.from('tps_product_projection').select(SEL).eq('canonical_id', canonicalId).maybeSingle();
    target = (data as Proj) ?? null;
    if (!target) return NextResponse.json({ version: 'v1', target: null, recommendations: [] });
  }
  const cat = target?.category ?? category;
  if (!cat) return NextResponse.json({ error: 'canonical_id or category required' }, { status: 400 });

  // Candidate pool: same category, corroborated, excluding the target and accessories.
  const { data: rows } = await supabase.from('tps_product_projection').select(SEL)
    .eq('category', cat).eq('has_comparison', true)
    .neq('canonical_id', canonicalId ?? '00000000-0000-0000-0000-000000000000')
    .limit(200);
  const pool = (rows ?? []).filter((r) => r.category !== 'accessories') as Proj[];

  const tParts = keyParts(target?.tps_identity_key);
  const tBrand = (target?.brand ?? '').toLowerCase();
  const tPrice = target?.lowest_price ?? null;

  // Deterministic scoring — higher is better. Every score has an explicit reason.
  const scored = pool.map((c) => {
    const parts = keyParts(c.tps_identity_key);
    const sameBrand = !!tBrand && (c.brand ?? '').toLowerCase() === tBrand;
    const sameFamily = target ? sameBrand && parts[1] === tParts[1] : false; // family/type
    const cheaper = tPrice != null && c.lowest_price != null && c.lowest_price < tPrice;
    const diff = tPrice != null && c.lowest_price != null ? tPrice - c.lowest_price : 0;

    let score = 0; let reason_ar = 'بديل ذو صلة'; let kind = 'alternative';
    if (sameFamily) { score += 100; reason_ar = 'من نفس العائلة'; kind = 'same_family'; }
    else if (sameBrand) { score += 60; reason_ar = 'من نفس العلامة التجارية'; kind = 'same_brand'; }
    score += Math.min(20, (c.store_count ?? 0) * 5); // more corroboration
    if (cheaper && diff > 0) { score += Math.min(40, Math.round(diff / 50)); reason_ar = `أوفر بـ ${Math.round(diff)} ريال`; kind = 'best_value'; }
    if (!target && (c.store_count ?? 0) >= 2) { score += 10; reason_ar = `أفضل قيمة · متوفر في ${c.store_count} متاجر`; kind = 'best_value'; }

    // Trust from the shared evidence engine (ADR-087) — one trust definition everywhere.
    const trust = productTrust({ store_count: c.store_count, identity_confidence: c.identity_confidence, has_comparison: (c.store_count ?? 0) >= 2, tps_identity_key: c.tps_identity_key, last_observed_at: c.last_observed_at });
    return { c, score, reason_ar, kind, confidence: trust.score, trust };
  }).sort((a, b) => b.score - a.score).slice(0, limit);

  const recommendations = scored.map((s) => ({
    canonical_id: s.c.canonical_id, tps_identity_key: s.c.tps_identity_key,
    title_ar: s.c.display_name_ar, title_en: s.c.display_name_en,
    brand: s.c.brand, category: s.c.category, image_url: s.c.image_url,
    lowest_price: s.c.lowest_price, store_count: s.c.store_count,
    canonical_url: s.c.compare_url,
    reason: { kind: s.kind, reason_ar: s.reason_ar }, confidence: s.confidence,
    trust: { score: s.trust.score, tier: s.trust.tier, caveats_ar: s.trust.caveats_ar },
  }));

  return NextResponse.json({
    version: 'v1',
    target: target ? { canonical_id: target.canonical_id, tps_identity_key: target.tps_identity_key, category: target.category } : null,
    category: cat, tps_version: 'tps-v1', count: recommendations.length,
    recommendations,
  });
}
