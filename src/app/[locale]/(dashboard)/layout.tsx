import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { getUserProfile, requireAuth } from '@/lib/auth/server';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  try {
    await requireAuth();
  } catch {
    redirect(`/${locale}/auth/login`);
  }

  const profile = await getUserProfile();
  if (profile?.role === 'admin') {
    redirect(`/${locale}/admin/dashboard`);
  }

  return (
    <PublicPageShell locale={locale}>
      {children}
    </PublicPageShell>
  );
}
