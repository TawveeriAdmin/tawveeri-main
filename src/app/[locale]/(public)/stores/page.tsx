import type { Metadata } from 'next';
import StoresListingClient from './stores-listing-client';
import { buildPageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    titleAr: 'المتاجر',
    titleEn: 'Stores',
    descriptionAr: 'تصفح المتاجر الموثوقة في السعودية. أمازون، نون، جرير، اكسترا، المنيع وأكثر.',
    descriptionEn: 'Browse trusted stores in Saudi Arabia. Amazon, Noon, Jarir, Extra, Almanea and more.',
    locale,
    path: '/stores',
  });
}

export default function StoresPage() {
  return <StoresListingClient />;
}
