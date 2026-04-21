import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { DashboardPushBanner } from '@/components/push/dashboard-push-banner';
import { getUserProfile, requireAuth } from '@/lib/auth/server';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Routes under (dashboard) that admins are allowed to access
const adminAllowedRoutes = ['/profile', '/settings', '/notifications', '/price-alerts', '/wishlist'];

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
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') || '/';
    const isAllowed = adminAllowedRoutes.some((route) => pathname.startsWith(route));
    if (!isAllowed) {
      redirect(`/${locale}/admin/dashboard`);
    }
  }

  return (
    <PublicPageShell locale={locale}>
      <DashboardPushBanner locale={locale} />
      {children}
    </PublicPageShell>
  );
}
