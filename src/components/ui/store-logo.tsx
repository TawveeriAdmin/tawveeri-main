'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getSearchStoreLogoPath, getStoreDisplayName, getStoreInitials, hasStoreLogo } from '@/lib/logos';

export type StoreLogoSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<StoreLogoSize, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 48,
};

export interface StoreLogoProps {
  slug: string;
  /** Visual size — defaults to `md` (32px). */
  size?: StoreLogoSize;
  /** Optional override for the accessible name. Defaults to the store's display name. */
  alt?: string;
  className?: string;
  /** Which locale to pick for the accessible default name. */
  locale?: 'ar' | 'en';
}

/**
 * Renders a store logo with a brand-tinted initial-letter fallback when the PNG is missing.
 * Single source of truth — use this instead of per-component `STORE_LOGOS` maps.
 */
export function StoreLogo({ slug, size = 'md', alt, className, locale = 'ar' }: StoreLogoProps) {
  const [failed, setFailed] = React.useState(false);
  const px = SIZE_PX[size];
  const name = alt ?? getStoreDisplayName(slug, locale);

  if (failed || !hasStoreLogo(slug)) {
    return (
      <span
        aria-label={name}
        role="img"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--brand-bg-green)] font-semibold text-[var(--brand-green-dark)]',
          className,
        )}
        style={{ width: px, height: px, fontSize: Math.max(10, Math.round(px * 0.38)) }}
      >
        {getStoreInitials(slug)}
      </span>
    );
  }

  return (
    <Image
      src={getSearchStoreLogoPath(slug)}
      alt={name}
      width={px}
      height={px}
      className={cn('shrink-0 rounded-full object-contain', className)}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
