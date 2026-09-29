import { HomeMissionExample } from '@/components/public/home-mission-example';

export default async function ExamplePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <HomeMissionExample locale={locale === 'en' ? 'en' : 'ar'} />;
}
