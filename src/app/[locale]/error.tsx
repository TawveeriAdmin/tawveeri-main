'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <h1 className="mb-4 text-headline-lg text-on-surface">
          حدث خطأ / Something went wrong
        </h1>
        <p className="mb-6 text-body-lg text-on-surface-variant">
          نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.
          <br />
          We apologize for this error. Please try again.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-primary-600 px-6 py-3 text-white transition-colors hover:bg-primary-700"
        >
          إعادة المحاولة / Try Again
        </button>
      </div>
    </div>
  );
}
