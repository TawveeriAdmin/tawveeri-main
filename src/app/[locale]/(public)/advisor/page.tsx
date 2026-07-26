import type { Metadata } from 'next';
import { AdvisorClient } from './advisor-client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === 'ar';
  return {
    title: ar ? 'وفّر — مساعد التسوّق الذكي' : 'Waffar — smart shopping assistant',
    description: ar
      ? 'قل ما تحتاجه بكلماتك واحصل على ترشيح محايد بمحرك حتمي — يرتّب حسب الملاءمة والتكلفة الإجمالية لا العمولة.'
      : 'Describe what you need and get a neutral recommendation from a deterministic engine — ranked by suitability and total cost, never commission.',
  };
}

export default async function AdvisorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const raw = sp?.q;
  const initialQuery = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : '';
  return <AdvisorClient locale={locale} initialQuery={initialQuery} />;
}
