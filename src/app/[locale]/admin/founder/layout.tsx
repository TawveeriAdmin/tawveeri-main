import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FounderNav } from '@/components/founder/founder-nav';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function FounderLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1f6f59] dark:text-[#9fe4d0]">توفيري · مركز قرارات المؤسس</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-on-surface md:text-3xl dark:text-white">ماذا حققنا، وما القرار التالي؟</h1>
          <p className="mt-1 text-xs text-on-surface-variant dark:text-white/55">كل رقم يحمل تعريفه ونافذته ومصدره وحدود إثباته. غير معلوم ≠ صفر. معرّف المتصفح ≠ شخص.</p>
        </div>
        <Suspense fallback={null}><FounderNav locale={locale} /></Suspense>
      </header>
      {children}
    </div>
  );
}
