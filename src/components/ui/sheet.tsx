import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Side-anchored panel built on Radix Dialog.
 * Use `side="bottom"` on mobile filter drawers, `side="end"` for cart/compare panels.
 * `side` is logical (`start` / `end`) so it flips automatically in RTL.
 */

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-[color:var(--color-scrim)]/40 backdrop-blur-[2px]',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  [
    'fixed z-50 gap-4 bg-[color:var(--color-surface)] text-on-surface',
    'shadow-[var(--elevation-4)]',
    'transition ease-[var(--ease-out-brand)]',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:duration-200 data-[state=open]:duration-300',
  ].join(' '),
  {
    variants: {
      side: {
        top: [
          'inset-x-0 top-0 border-b border-[color:var(--color-outline-variant)]',
          'rounded-b-[var(--radius-lg)]',
          'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        ].join(' '),
        bottom: [
          'inset-x-0 bottom-0 border-t border-[color:var(--color-outline-variant)]',
          'rounded-t-[var(--radius-lg)]',
          'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        ].join(' '),
        start: [
          // logical "start" — left in LTR, right in RTL
          'inset-y-0 start-0 h-full w-3/4 max-w-sm border-e border-[color:var(--color-outline-variant)]',
          'rounded-e-[var(--radius-lg)]',
          'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          'rtl:data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-right',
        ].join(' '),
        end: [
          'inset-y-0 end-0 h-full w-3/4 max-w-sm border-s border-[color:var(--color-outline-variant)]',
          'rounded-s-[var(--radius-lg)]',
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          'rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left',
        ].join(' '),
      },
    },
    defaultVariants: {
      side: 'bottom',
    },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Hide the built-in close button (still wire one via `<SheetClose />` if you do). */
  hideClose?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = 'bottom', className, children, hideClose, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), 'p-6', className)}
      {...props}
    >
      {side === 'bottom' && (
        <div
          aria-hidden
          className="mx-auto -mt-2 mb-2 h-1 w-10 rounded-full bg-[color:var(--color-outline-variant)]"
        />
      )}
      {children}
      {!hideClose && (
        <SheetPrimitive.Close
          className={cn(
            'absolute end-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full',
            'text-on-surface-variant transition-colors hover:bg-on-surface/8',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2',
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      )}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 text-start', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('t-h3 text-on-surface', className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('t-small text-on-surface-variant', className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
