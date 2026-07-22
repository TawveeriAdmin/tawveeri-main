import type { Metadata } from 'next';
import { PriceTruthClient } from './price-truth-client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === 'ar';
  return {
    title: ar ? 'حقيقة الأسعار' : 'Price Truth',
    description: ar
      ? 'نتحقّق من الخصومات المعلنة مقابل ما رصدناه فعلاً، ونعرض العروض الحقيقية الموثّقة — بالدليل لا بالوعود، ومحايدون تمامًا.'
      : 'We verify advertised discounts against what we actually observed and surface genuine, evidence-backed deals — by evidence, not promises, and fully neutral.',
  };
}

export default async function PriceTruthPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <PriceTruthClient locale={locale} />;
}
