import { PublicPageShell } from '@/components/public/public-page-shell';

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <PublicPageShell locale={locale}>{children}</PublicPageShell>;
}
