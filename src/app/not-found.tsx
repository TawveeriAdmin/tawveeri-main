// THE SITE'S 404 PAGE — resolved at the ROOT, above `[locale]`.
//
// Until the root layout owned the HTML shell, this page rendered with no header, no footer, no
// fonts and no theme: an inline-styled slab on a blank document, ~663 bytes of markup. It is a
// real page now because the providers live above it.
//
// It reads the locale from the request (`getRequestLocale`) rather than a route param, because
// a not-found boundary has no params. `/en/<missing>` therefore answers in English and `/ar/…`
// in Arabic, instead of showing both languages stacked and hoping one of them was wanted.
import Link from 'next/link';
import { Search } from 'lucide-react';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { getRequestLocale } from '@/lib/i18n/request-locale';

export default function NotFound() {
  const locale = getRequestLocale();
  const isAr = locale === 'ar';

  return (
    <PublicPageShell locale={locale}>
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center">
        <div className="text-[64px] font-black leading-none text-primary-600 dark:text-primary-400">
          404
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-on-surface">
          {isAr ? 'الصفحة غير موجودة' : 'Page not found'}
        </h1>
        <p className="mt-3 text-base text-on-surface-variant">
          {isAr
            ? 'الرابط الذي فتحته لا يؤدي إلى صفحة على توفيري — قد يكون تغيّر أو حُذف.'
            : 'That link does not lead to a page on Tawveeri — it may have changed or been removed.'}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/${locale}/search`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-600 px-6 text-sm font-bold text-white transition-colors hover:bg-primary-700"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {isAr ? 'ابحث عن منتج' : 'Search for a product'}
          </Link>
          <Link
            href={`/${locale}`}
            className="inline-flex min-h-[44px] items-center rounded-full border border-outline-variant px-6 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container"
          >
            {isAr ? 'الصفحة الرئيسية' : 'Go to homepage'}
          </Link>
        </div>
      </div>
    </PublicPageShell>
  );
}
