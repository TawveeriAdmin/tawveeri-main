import type { Metadata } from 'next';
import DealsClient from './deals-client';
import { buildPageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    titleAr: 'العروض والتخفيضات',
    titleEn: 'Deals & Discounts',
    descriptionAr: 'أحدث العروض والتخفيضات على الإلكترونيات في السعودية. وفر أكثر مع توفيري.',
    descriptionEn: 'Latest deals and discounts on electronics in Saudi Arabia. Save more with Tawveeri.',
    locale,
    path: '/deals',
  });
}

export default function DealsPage() {
  return <DealsClient />;
}
