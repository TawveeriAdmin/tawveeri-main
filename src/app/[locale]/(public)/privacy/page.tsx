import type { Metadata } from 'next';
import PrivacyClient from './privacy-client';
import { buildPageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    titleAr: 'سياسة الخصوصية',
    titleEn: 'Privacy Policy',
    descriptionAr: 'سياسة الخصوصية لموقع توفيري. كيف نجمع ونستخدم ونحمي معلوماتك الشخصية.',
    descriptionEn: 'Tawveeri Privacy Policy. How we collect, use, and protect your personal information.',
    locale,
    path: '/privacy',
  });
}

export default function PrivacyPage() {
  return <PrivacyClient />;
}
