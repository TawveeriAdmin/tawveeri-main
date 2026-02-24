import type { Metadata } from 'next';
import CouponsClient from './coupons-client';
import { buildPageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    titleAr: 'كوبونات الخصم',
    titleEn: 'Discount Coupons',
    descriptionAr: 'أحدث كوبونات الخصم وأكواد التوفير من المتاجر الإلكترونية في السعودية.',
    descriptionEn: 'Latest discount coupons and promo codes from electronics stores in Saudi Arabia.',
    locale,
    path: '/coupons',
  });
}

export default function CouponsPage() {
  return <CouponsClient />;
}
