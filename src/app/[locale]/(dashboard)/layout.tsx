import { redirect } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-[1440px] px-3 pb-8 pt-4 md:px-6 md:pt-6">
        <div className="rounded-2xl border border-gray-200/70 bg-white/85 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800/70 dark:bg-gray-900/65 md:p-6">
          {children}
        </div>
      </main>
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,rgba(13,71,161,0.12),transparent_62%)] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_58%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[340px] bg-[radial-gradient(circle_at_bottom,rgba(79,70,229,0.10),transparent_64%)] dark:bg-[radial-gradient(circle_at_bottom,rgba(165,180,252,0.14),transparent_60%)]" />
    </div>
  );
}
