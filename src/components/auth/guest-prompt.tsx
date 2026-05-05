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
      className={`rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest/80 backdrop-blur-sm p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className || ''}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-title-lg text-on-surface">{title}</h2>
          <p className="text-sm text-on-surface-variant mt-1">{description}</p>
        </div>
      </div>
      <div className="flex flex-col sm:items-end gap-3">
        <Button asChild>
          <Link href={`/${locale}/auth/login`}>
            {ctaLabel || t('auth.signIn') || 'Sign in'}
          </Link>
        </Button>
        <p className="text-xs text-on-surface-variant">
          {t('auth.noAccount')}{' '}
          <Link
            href={`/${locale}/auth/signup`}
            className="text-primary hover:underline font-semibold"
          >
            {t('auth.signUpLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}

