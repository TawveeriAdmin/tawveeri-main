import { createServerClient } from '@/lib/database';

/**
 * All category enum values (migrations 01 + 18). Kept in sync with
 * the UI's CATEGORY_META (the V1 landing client, deleted 2026-08-01 as proven-dead code). Used to issue one
 * parallel COUNT query per bucket so we don't hit Supabase's 1,000-row
 * SELECT cap when the catalog is large.
 */
const KNOWN_CATEGORIES = [
  'smartphone', 'laptop', 'tablet', 'tv', 'audio', 'camera', 'gaming',
  'accessories', 'monitor', 'printer', 'networking', 'smart_home',
  'wearable', 'appliance', 'kitchen', 'personal_care', 'refrigerator',
] as const;

export interface LandingDeal {
  product_id: string;
  product_slug: string;
  name_ar: string;
  name_en: string;
  image_url: string | null;
  savings: number;
  current_price: number;
  original_price: number;
  store_slug: string;
  store_name_ar: string;
  store_name_en: string;
}

export interface LandingFeatured {
  product_id: string;
  product_slug: string;
  name_ar: string;
  name_en: string;
  image_url: string | null;
  best_price: number;
  max_savings: number;
  store_count: number;
}

export interface LandingStore {
  slug: string;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  average_rating: number | null;
  total_reviews: number | null;
}

export interface LandingData {
  topDeals: LandingDeal[];
  featured: LandingFeatured[];
  stores: LandingStore[];
  categoryCounts: Record<string, number>;
  /** Representative image (from the most-viewed product) for each category. */
  categoryImages: Record<string, string>;
  totalSavings: number;
  totalStores: number;
  totalProducts: number;
}

interface ProductStoreRow {
  current_price: number;
  original_price: number | null;
  is_deal: boolean | null;
  stores: {
    slug: string;
    name_ar: string;
    name_en: string;
    logo_url: string | null;
    average_rating: number | null;
    total_reviews: number | null;
  } | null;
}

interface ProductWithStoresRow {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  category: string;
  image_urls: string[] | null;
  product_stores: ProductStoreRow[];
}

/**
 * Fetches everything the landing page needs with reasonable fallbacks.
 * Intended to run once per request in the server component.
 */
export async function getLandingData(): Promise<LandingData> {
  const supabase = createServerClient();

  const [
    dealsRes,
    featuredRes,
    storesRes,
    categoryRes,
    totalStoresRes,
    totalProductsRes,
    categoryLeadsRes,
  ] = await Promise.all([
    // Top deals — most recent products with a real discount.
    supabase
      .from('products')
      .select(
        `id, slug, name_ar, name_en, category, image_urls,
         product_stores!inner(current_price, original_price, is_deal,
           stores!inner(slug, name_ar, name_en, logo_url, average_rating, total_reviews))`,
      )
      .eq('is_active', true)
      .eq('product_stores.is_deal', true)
      .order('updated_at', { ascending: false })
      .limit(40)
      .returns<ProductWithStoresRow[]>(),

    // Featured — products with multiple store offers, ordered by view_count.
    supabase
      .from('products')
      .select(
        `id, slug, name_ar, name_en, category, image_urls,
         product_stores!inner(current_price, original_price, is_deal,
           stores!inner(slug, name_ar, name_en, logo_url, average_rating, total_reviews))`,
      )
      .eq('is_active', true)
      .order('view_count', { ascending: false })
      .limit(30)
      .returns<ProductWithStoresRow[]>(),

    supabase
      .from('stores')
      .select('slug, name_ar, name_en, logo_url, average_rating, total_reviews, is_active')
      .eq('is_active', true)
      .order('average_rating', { ascending: false, nullsFirst: false })
      .limit(12),

    // Per-category active counts — server-side COUNT per bucket, run in
    // parallel to sidestep Supabase's 1,000-row SELECT cap.
    Promise.all(
      KNOWN_CATEGORIES.map((cat) =>
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('category', cat)
          .then((res) => [cat, res.count ?? 0] as const),
      ),
    ),

    supabase
      .from('stores')
      .select('slug', { count: 'exact', head: true })
      .eq('is_active', true),

    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),

    // Most-viewed products (with images) — used to pick a representative
    // thumbnail for each category bucket below.
    supabase
      .from('products')
      .select('category, image_urls')
      .eq('is_active', true)
      .not('image_urls', 'is', null)
      .order('view_count', { ascending: false })
      .limit(400),
  ]);

  const dealsData: ProductWithStoresRow[] = dealsRes.data ?? [];
  const featuredData: ProductWithStoresRow[] = featuredRes.data ?? [];

  // Flatten deals: one row per (product, store) with biggest savings.
  const topDeals: LandingDeal[] = [];
  for (const p of dealsData) {
    for (const ps of p.product_stores) {
      if (!ps.stores || !ps.original_price) continue;
      const savings = ps.original_price - ps.current_price;
      if (savings <= 0) continue;
      topDeals.push({
        product_id: p.id,
        product_slug: p.slug,
        name_ar: p.name_ar,
        name_en: p.name_en,
        image_url: p.image_urls?.[0] ?? null,
        savings,
        current_price: ps.current_price,
        original_price: ps.original_price,
        store_slug: ps.stores.slug,
        store_name_ar: ps.stores.name_ar,
        store_name_en: ps.stores.name_en,
      });
    }
  }
  topDeals.sort((a, b) => b.savings - a.savings);
  topDeals.splice(12);

  // Featured: rank products by (store_count desc, max_savings desc).
  const featuredList: LandingFeatured[] = featuredData
    .map((p) => {
      const prices = p.product_stores
        .map((ps) => ps.current_price)
        .filter((n): n is number => typeof n === 'number' && n > 0);
      const bestPrice = prices.length ? Math.min(...prices) : 0;
      const maxSavings = p.product_stores.reduce((acc, ps) => {
        if (!ps.original_price) return acc;
        return Math.max(acc, ps.original_price - ps.current_price);
      }, 0);
      return {
        product_id: p.id,
        product_slug: p.slug,
        name_ar: p.name_ar,
        name_en: p.name_en,
        image_url: p.image_urls?.[0] ?? null,
        best_price: bestPrice,
        max_savings: maxSavings,
        store_count: new Set(
          p.product_stores.map((ps) => ps.stores?.slug).filter(Boolean) as string[],
        ).size,
      };
    })
    .filter((f) => f.store_count >= 1 && f.best_price > 0)
    .sort((a, b) => {
      if (b.store_count !== a.store_count) return b.store_count - a.store_count;
      return b.max_savings - a.max_savings;
    })
    .slice(0, 10);

  const stores: LandingStore[] = (storesRes.data ?? []).map((s) => ({
    slug: s.slug,
    name_ar: s.name_ar,
    name_en: s.name_en,
    logo_url: s.logo_url ?? null,
    average_rating: s.average_rating ?? null,
    total_reviews: s.total_reviews ?? null,
  }));

  const categoryCounts: Record<string, number> = Object.fromEntries(categoryRes);

  // Representative image per category — take the first image of the
  // most-viewed product in each bucket. Works as a live "hero" that rotates
  // naturally as catalog traffic shifts.
  const categoryImages: Record<string, string> = {};
  for (const row of (categoryLeadsRes.data ?? []) as Array<{ category: string; image_urls: string[] | null }>) {
    if (categoryImages[row.category]) continue;
    const url = row.image_urls?.[0];
    if (url) categoryImages[row.category] = url;
  }

  // Total savings across all active deals.
  const totalSavings = dealsData.reduce((acc, p) => {
    for (const ps of p.product_stores) {
      if (!ps.original_price) continue;
      acc += Math.max(0, ps.original_price - ps.current_price);
    }
    return acc;
  }, 0);

  return {
    topDeals,
    featured: featuredList,
    stores,
    categoryCounts,
    categoryImages,
    totalSavings,
    totalStores: totalStoresRes.count ?? stores.length,
    totalProducts: totalProductsRes.count ?? 0,
  };
}
