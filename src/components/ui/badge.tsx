import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-label-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-gold)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-[var(--brand-green)] text-white',
        success: 'bg-[var(--brand-green)] text-white',
        'success-light': 'bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]',
        warning: 'bg-error text-on-error',
        'warning-light': 'bg-error-container text-on-error-container',
        featured: 'bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)] border border-[var(--brand-gold)]/50',
        outline: 'border border-[color:var(--color-outline-variant)] bg-transparent text-on-surface-variant',
        secondary: 'bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]',
        best: 'bg-[var(--brand-gold)] text-[var(--brand-dark-text)] font-semibold',
        coupon:
          'border-2 border-dashed border-[var(--brand-gold)] bg-[var(--brand-gold)]/10 text-[var(--brand-gold-dark)] font-semibold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
