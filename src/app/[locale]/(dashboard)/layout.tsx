import { SidebarProvider } from '@/components/dashboard/sidebar-context';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
        <DashboardSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto w-full max-w-[1440px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
