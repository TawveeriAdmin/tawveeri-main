import type { Metadata } from 'next';
import { CheckClient } from '@/components/check/check-client';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { buildAlternates } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ar' ? 'افحص رابط المنتج قبل الشراء — Check' : 'Check a product link before buying',
    description: locale === 'ar' ? 'الصق رابط المنتج لفحص العروض المرصودة وحالة الجهاز وتاريخ السعر في توفيري.' : 'Paste a product link to check observed Saudi offers, condition and price history.',
    alternates: buildAlternates('/check', locale) };
}
export default async function CheckPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <PublicPageShell locale={locale}><CheckClient locale={locale === 'en' ? 'en' : 'ar'} /></PublicPageShell>;
}
