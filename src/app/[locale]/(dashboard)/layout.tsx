import { redirect } from 'next/navigation';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { getUserProfile, requireAuth } from '@/lib/auth/server';

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
      <div className="rounded-2xl border border-gray-200/70 bg-white/85 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800/70 dark:bg-gray-900/65 md:p-6">
        {children}
      </div>
    </PublicPageShell>
  );
}
