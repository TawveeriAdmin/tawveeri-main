'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            حدث خطأ غير متوقع / An unexpected error occurred
          </h1>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.
            <br />
            We apologize for this error. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#0D47A1',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            إعادة المحاولة / Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
