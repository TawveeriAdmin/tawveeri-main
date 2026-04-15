'use client';

import * as React from 'react';
import { Search, Heart, Tag, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/simple-intl-provider';
import { emptyDefaults } from '@/lib/copy';

export type EmptyStateVariant = 'default' | 'search' | 'wishlist' | 'deals' | 'compare';

const VARIANT_ICON: Record<Exclude<EmptyStateVariant, 'default'>, React.ReactNode> = {
  search: <Search className="h-8 w-8" strokeWidth={1.5} />,
  wishlist: <Heart className="h-8 w-8" strokeWidth={1.5} />,
  deals: <Tag className="h-8 w-8" strokeWidth={1.5} />,
  compare: <Scale className="h-8 w-8" strokeWidth={1.5} />,
};

interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Pre-wired copy + icon for common states; use `default` when passing your own. */
  variant?: EmptyStateVariant;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional secondary action rendered to the side of the primary. */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  variant = 'default',
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  ...props
}: EmptyStateProps) {
  const { locale } = useLocale();

  const defaults = variant !== 'default' ? emptyDefaults(locale)[variant] : undefined;
  const resolvedIcon =
    icon ?? (variant !== 'default' ? VARIANT_ICON[variant as keyof typeof VARIANT_ICON] : undefined);
  const resolvedTitle = title ?? defaults?.title ?? '';
  const resolvedDescription = description ?? defaults?.description;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-16 text-center',
        className,
      )}
      {...props}
    >
      {resolvedIcon && (
        <div
          className={cn(
            'mb-4 flex h-16 w-16 items-center justify-center rounded-full',
            'bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]',
          )}
        >
          {resolvedIcon}
        </div>
      )}
      {resolvedTitle && (
        <h3 className="t-h3 text-on-surface mb-2">{resolvedTitle}</h3>
      )}
      {resolvedDescription && (
        <p className="t-body text-on-surface-variant mb-6 max-w-sm">{resolvedDescription}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
