'use client';

import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/simple-intl-provider';

interface GuestPromptProps {
  locale: string;
  title: string;
  description: string;
  ctaLabel?: string;
  className?: string;
}

export function GuestPrompt({ locale, title, description, ctaLabel, className }: GuestPromptProps) {
  const t = useTranslations();

  return (
    <div
      className={`rounded-2xl border border-dashed border-primary-200 dark:border-primary-900 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm p-6 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className || ''}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        </div>
      </div>
      <div className="flex flex-col sm:items-end gap-3">
        <Button asChild>
          <Link href={`/${locale}/auth/login`}>
            {ctaLabel || t('auth.signIn') || 'Sign in'}
          </Link>
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          {t('auth.noAccount')}{' '}
          <Link
            href={`/${locale}/auth/signup`}
            className="text-primary-600 dark:text-primary-400 hover:underline font-semibold"
          >
            {t('auth.signUpLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}

