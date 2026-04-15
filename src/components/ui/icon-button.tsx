import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const iconButtonVariants = cva(
  [
    'state-layer inline-flex shrink-0 items-center justify-center rounded-full',
    'transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-brand)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand-gold)]',
    'disabled:pointer-events-none disabled:opacity-40',
  ].join(' '),
  {
    variants: {
      variant: {
        ghost: 'text-on-surface-variant hover:bg-on-surface/8',
        tonal:
          'bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)] hover:bg-[var(--color-surface-container-high)]',
        filled:
          'bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-dark)]',
        outline:
          'border border-[var(--color-outline-variant)] bg-transparent text-on-surface hover:bg-on-surface/8',
        accent:
          'bg-[var(--brand-gold)] text-[var(--brand-dark-text)] hover:bg-[var(--brand-gold-dark)] hover:text-white',
      },
      size: {
        sm: 'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4',
        md: 'h-10 w-10 [&_svg]:h-5 [&_svg]:w-5',
        lg: 'h-12 w-12 [&_svg]:h-6 [&_svg]:w-6',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
);

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>,
    VariantProps<typeof iconButtonVariants> {
  /** Required — every icon button must announce its purpose. */
  'aria-label': string;
  asChild?: boolean;
}

/**
 * Circular icon-only button. 32/40/48px per brand.
 * Prefer this over `<Button variant="ghost" size="sm" className="h-8 w-8 p-0">`.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type ?? 'button'}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';

export { iconButtonVariants };
