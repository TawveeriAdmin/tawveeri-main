import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-sm)] bg-[var(--brand-bg-green)]',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent',
        'rtl:before:translate-x-full rtl:before:animate-[shimmer-rtl_1.8s_infinite]',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
