import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:ps-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4',
  {
    variants: {
      variant: {
        default: 'bg-white text-gray-900 border-gray-200 [&>svg]:text-primary-600 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:[&>svg]:text-primary-400',
        success:
          'border-success-200 bg-success-50 text-success-900 [&>svg]:text-success-600 dark:border-success-800 dark:bg-success-950 dark:text-success-100 dark:[&>svg]:text-success-400',
        warning:
          'border-warning-200 bg-warning-50 text-warning-900 [&>svg]:text-warning-600 dark:border-warning-800 dark:bg-warning-950 dark:text-warning-100 dark:[&>svg]:text-warning-400',
        destructive:
          'border-warning-200 bg-warning-50 text-warning-900 [&>svg]:text-warning-600 dark:border-warning-800 dark:bg-warning-950 dark:text-warning-100 dark:[&>svg]:text-warning-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
