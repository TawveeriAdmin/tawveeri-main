import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireStore, getUserProfile, createClient } from '@/lib/auth/server';
import { StoreSidebar } from '@/components/store/store-sidebar';
import { StoreHeader } from '@/components/store/store-header';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function StoreLayout({
 children,
 params,
}: {
 children: React.ReactNode;
 params: Promise<{ locale: string }>;
}) {
 const { locale } = await params;

 // Check store access
 try {
 await requireStore();
 } catch (error) {
 redirect(`/${locale}/unauthorized`);
 }

 // Get user profile
 const userProfile = await getUserProfile();
 if (!userProfile) {
 redirect(`/${locale}/auth/login`);
 }

 // Fetch user's store(s)
 const supabase = await createClient();
 const { data: stores, error: storesError } = await supabase
 .from('stores')
 .select('*')
 .eq('created_by', userProfile.id)
 .order('created_at', { ascending: false });

 if (storesError || !stores || stores.length === 0) {
 // If user has no store, redirect to create store page or show message
 // For now, we'll allow access but show a message
 }

 const primaryStore = stores?.[0] || null;

 return (
 <div className="flex h-screen overflow-hidden bg-surface-container">
 {/* Skip to main content link */}
 <a
   href="#store-main"
   className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary focus:shadow-lg"
 >
   {locale === 'ar' ? 'تخطي إلى المحتوى الرئيسي' : 'Skip to main content'}
 </a>

 {/* Sidebar */}
 <StoreSidebar locale={locale} store={primaryStore} />

 {/* Main Content */}
 <div className="flex flex-1 flex-col overflow-hidden">
 {/* Header */}
 <StoreHeader userProfile={userProfile} store={primaryStore} locale={locale} />

 {/* Page Content */}
 <main id="store-main" className="flex-1 overflow-y-auto p-6">
 {children}
 </main>
 </div>
 </div>
 );
}

