'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';

// Locale-aware error boundary. The previous version rendered both languages as
// one interleaved sentence ("حدث خطأ / Something went wrong"), which reads as
// broken copy in either locale. The error digest is kept visible (small, LTR)
// so a founder screenshot is enough to find the Sentry event.
const COPY = {
  ar: {
    title: 'حدث خطأ',
    body: 'نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.',
    retry: 'إعادة المحاولة',
    ref: 'مرجع الخطأ',
  },
  en: {
    title: 'Something went wrong',
    body: 'We apologize for this error. Please try again.',
    retry: 'Try again',
    ref: 'Error reference',
  },
};

export default function LocaleError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <h1 className="mb-4 text-headline-lg text-on-surface">{t.title}</h1>
        <p className="mb-6 text-body-lg text-on-surface-variant">{t.body}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-primary-600 px-6 py-3 text-white transition-colors hover:bg-primary-700"
        >
          {t.retry}
        </button>
        {error.digest && (
          <p className="mt-4 text-xs text-on-surface-variant">
            {t.ref}: <bdi dir="ltr">{error.digest}</bdi>
          </p>
        )}
      </div>
    </div>
  );
}
