import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'state-layer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-label-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-38',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-dark)]',
        accent:
          'bg-[var(--brand-gold)] text-[var(--brand-dark-text)] hover:bg-[var(--brand-gold-dark)] hover:text-white',
        tonal:
          'bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)] hover:bg-[color:var(--color-surface-container-high)]',
        success:
          'bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-dark)]',
        warning:
          'bg-error text-on-error',
        destructive:
          'bg-error text-on-error',
        elevated:
          'bg-[color:var(--color-surface)] text-[var(--brand-green-dark)] shadow-[var(--elevation-1)] hover:shadow-[var(--elevation-2)]',
        outline:
          'border border-[var(--brand-green)]/60 text-[var(--brand-green-dark)] bg-transparent hover:bg-[var(--brand-bg-green)]',
        ghost:
          'text-on-surface-variant hover:bg-on-surface/8',
        link:
          'text-[var(--brand-green-dark)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-6 py-2.5',
        sm: 'h-9 px-4 py-2',
        lg: 'h-12 px-8 py-3 text-body-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
