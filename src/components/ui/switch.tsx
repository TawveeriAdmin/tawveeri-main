import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    {...props}
    ref={ref}
    dir="ltr"
    className={cn(
      'peer inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
      'transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]',
      'disabled:cursor-not-allowed disabled:opacity-38',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-container-highest',
      className
    )}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-6 w-6 rounded-full bg-white ring-0 transition-transform',
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5'
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
