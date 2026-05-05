import type { Metadata } from 'next';
import TermsClient from './terms-client';
import { buildPageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    titleAr: 'الشروط والأحكام',
    titleEn: 'Terms of Service',
    descriptionAr: 'شروط وأحكام استخدام موقع توفيري لمقارنة أسعار الإلكترونيات.',
    descriptionEn: 'Terms of Service for using the Tawveeri electronics price comparison platform.',
    locale,
    path: '/terms',
  });
}

export default function TermsPage() {
  return <TermsClient />;
}
