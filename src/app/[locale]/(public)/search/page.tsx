import type { Metadata } from 'next';
import SearchClient from './search-client';
import { buildPageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    titleAr: 'البحث عن المنتجات',
    titleEn: 'Search Products',
    descriptionAr: 'ابحث وقارن أسعار الإلكترونيات من أمازون ونون وجرير واكسترا والمنيع في السعودية.',
    descriptionEn: 'Search and compare electronics prices from Amazon, Noon, Jarir, Extra & Almanea in Saudi Arabia.',
    locale,
    path: '/search',
  });
}

export default function SearchPage() {
  return <SearchClient />;
}
