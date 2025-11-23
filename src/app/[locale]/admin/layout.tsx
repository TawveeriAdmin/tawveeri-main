import { redirect } from 'next/navigation';
import { requireAdmin, getUserProfile } from '@/lib/auth/server';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Package,
  Store,
  CreditCard,
  BarChart3,
  FileText,
  LogOut,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';

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
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <AdminSidebar locale={locale} />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <AdminHeader userProfile={userProfile} locale={locale} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

