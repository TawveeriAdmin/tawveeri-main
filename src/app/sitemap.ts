import type { MetadataRoute } from 'next';
import { createServerClient } from '@/lib/database';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';
  const locales = ['ar', 'en'] as const;

  // Static pages
  const staticPages = ['', '/search', '/deals', '/stores', '/coupons', '/privacy', '/terms'];
  const staticEntries: MetadataRoute.Sitemap = staticPages.flatMap((path) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: path === '' ? 'daily' as const : 'weekly' as const,
      priority: path === '' ? 1.0 : 0.7,
      alternates: {
        languages: {
          ar: `${baseUrl}/ar${path}`,
          en: `${baseUrl}/en${path}`,
        },
      },
    }))
  );

  // Dynamic: products
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = createServerClient();
    const { data: products } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(5000);

    if (products) {
      productEntries = products.flatMap((product) =>
        locales.map((locale) => ({
          url: `${baseUrl}/${locale}/products/${product.slug}`,
          lastModified: new Date(product.updated_at),
          changeFrequency: 'daily' as const,
          priority: 0.8,
          alternates: {
            languages: {
              ar: `${baseUrl}/ar/products/${product.slug}`,
              en: `${baseUrl}/en/products/${product.slug}`,
            },
          },
        }))
      );
    }
  } catch {
    // DB unavailable — skip dynamic entries
  }

  // Dynamic: stores
  let storeEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = createServerClient();
    const { data: stores } = await supabase
      .from('stores')
      .select('slug, updated_at')
      .eq('status', 'active');

    if (stores) {
      storeEntries = stores.flatMap((store) =>
        locales.map((locale) => ({
          url: `${baseUrl}/${locale}/stores/${store.slug}`,
          lastModified: new Date(store.updated_at),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
          alternates: {
            languages: {
              ar: `${baseUrl}/ar/stores/${store.slug}`,
              en: `${baseUrl}/en/stores/${store.slug}`,
            },
          },
        }))
      );
    }
  } catch {
    // DB unavailable — skip dynamic entries
  }

  return [...staticEntries, ...productEntries, ...storeEntries];
}
