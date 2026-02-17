import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-label-sm transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-on-primary',
        success: 'bg-success text-on-success',
        'success-light': 'bg-success-container text-on-success-container',
        warning: 'bg-error text-on-error',
        'warning-light': 'bg-error-container text-on-error-container',
        featured: 'bg-tertiary-container text-on-tertiary-container border border-tertiary',
        outline: 'border border-outline bg-transparent text-on-surface-variant',
        secondary: 'bg-secondary-container text-on-secondary-container',
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
