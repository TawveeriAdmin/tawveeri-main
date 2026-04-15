import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface-container-high)]',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-white/50 dark:before:via-white/[0.08] before:to-transparent',
        'rtl:before:translate-x-full rtl:before:animate-[shimmer-rtl_1.8s_infinite]',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
