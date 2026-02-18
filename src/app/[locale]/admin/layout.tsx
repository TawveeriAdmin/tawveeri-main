import { redirect } from 'next/navigation';
import { requireAdmin, getUserProfile } from '@/lib/auth/server';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminSidebarProvider } from '@/components/admin/admin-sidebar-context';

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
        {/* Sidebar (desktop only, mobile uses overlay) */}
        <AdminSidebar locale={locale} />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <AdminHeader userProfile={userProfile} locale={locale} />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminSidebarProvider>
  );
}
