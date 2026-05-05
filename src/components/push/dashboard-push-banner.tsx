'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useWebPush } from '@/lib/push/use-web-push';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'tawveeri.push-banner.dismissed';

interface DashboardPushBannerProps {
  locale: string;
}

export function DashboardPushBanner({ locale }: DashboardPushBannerProps) {
  const { status, isSupported, subscribe } = useWebPush();
  // Start as "dismissed" on both server and first client render so SSR matches
  // hydration, then read localStorage in an effect.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(true);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore quota errors
    }
    setDismissed(true);
  };

  if (dismissed || !isSupported || status !== 'idle') return null;

  const isRTL = locale === 'ar';

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-900/30">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-800/50">
        <Bell className="h-4 w-4 text-primary-700 dark:text-primary-300" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-primary-900 dark:text-primary-100">
          {isRTL ? 'فعّل تنبيهات المتصفح' : 'Turn on browser notifications'}
        </p>
        <p className="mt-0.5 text-xs text-primary-700/80 dark:text-primary-300/80">
          {isRTL
            ? 'احصل على إشعارات فورية عند انخفاض الأسعار أو انتهاء صلاحية الكوبونات.'
            : 'Get real-time alerts on price drops and expiring coupons.'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" onClick={subscribe} disabled={status === 'loading'}>
          {isRTL ? 'تفعيل' : 'Enable'}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={isRTL ? 'إغلاق' : 'Dismiss'}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary-700/70 transition-colors hover:bg-primary-100 dark:text-primary-300/70 dark:hover:bg-primary-800/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
