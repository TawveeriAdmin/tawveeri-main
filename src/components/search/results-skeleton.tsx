import { Skeleton } from '@/components/ui/skeleton';

interface ResultsSkeletonProps {
  /** Number of skeleton cards. Defaults to 8 (one full row on most layouts). */
  count?: number;
}

/**
 * Brand-green shimmer grid that mirrors the real ProductCard outline so the
 * layout doesn't jump when results swap in.
 */
export function ResultsSkeleton({ count = 8 }: ResultsSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse flex flex-col rounded-[var(--radius-lg)] border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] overflow-hidden">
      <Skeleton className="aspect-square w-full !rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-3 w-[40%] mt-1" />
        <div className="flex items-end justify-between gap-2 mt-3">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 pb-4">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-9 !rounded-full" />
      </div>
    </div>
  );
}
