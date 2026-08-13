'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';

// Admin-scoped error boundary (founder mission 2026-08-13). Without it, any
// admin page crash unmounted the entire admin shell (sidebar + header) via the
// [locale] boundary; this keeps navigation usable and shows the error digest
// so a founder screenshot is enough to locate the Sentry event.
const COPY = {
  ar: {
    title: 'تعطلت هذه الصفحة',
    body: 'بقية لوحة الإدارة تعمل — يمكنك الانتقال من القائمة الجانبية أو إعادة المحاولة.',
    retry: 'إعادة المحاولة',
    ref: 'مرجع الخطأ',
  },
  en: {
    title: 'This page crashed',
    body: 'The rest of the admin panel is fine — navigate from the sidebar or retry.',
    retry: 'Retry',
    ref: 'Error reference',
  },
};

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = params?.locale === 'en' ? 'en' : 'ar';
  const t = COPY[locale];

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-red-500/30 bg-surface-container-lowest p-6 text-center">
        <h1 className="text-lg font-bold">{t.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t.retry}
        </button>
        {error.digest && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t.ref}: <bdi dir="ltr">{error.digest}</bdi>
          </p>
        )}
      </div>
    </div>
  );
}
