import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin, getUserProfile } from '@/lib/auth/server';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminSidebarProvider } from '@/components/admin/admin-sidebar-context';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Check admin access
  try {
    await requireAdmin();
  } catch (error) {
    redirect(`/${locale}/unauthorized`);
  }

  // Get user profile for header
  const userProfile = await getUserProfile();

  return (
    <AdminSidebarProvider>
      <div className="flex h-screen overflow-hidden bg-surface-container">
        {/* Skip to main content link */}
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary focus:shadow-lg"
        >
          {locale === 'ar' ? 'تخطي إلى المحتوى الرئيسي' : 'Skip to main content'}
        </a>

        {/* Sidebar (desktop only, mobile uses overlay) */}
        <AdminSidebar locale={locale} />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <AdminHeader userProfile={userProfile} locale={locale} />

          {/* Page Content */}
          <main id="admin-main" className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminSidebarProvider>
  );
}
