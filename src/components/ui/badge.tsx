import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary-800 text-white',
        success: 'bg-success-600 text-white',
        'success-light':
          'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300',
        warning: 'bg-warning-600 text-white animate-pulse',
        'warning-light':
          'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300',
        featured:
          'bg-featured-100 text-featured-800 border border-featured-500 dark:bg-featured-900 dark:text-featured-300',
        outline:
          'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800',
        secondary:
          'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
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
