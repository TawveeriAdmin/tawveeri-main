import { PublicPageShell } from '@/components/public/public-page-shell';
import { HomePageContent } from '@/components/public/home-page-content';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;

  return (
    <PublicPageShell locale={locale}>
      <HomePageContent locale={locale} />
    </PublicPageShell>
  );
}
