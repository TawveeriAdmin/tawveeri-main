import { Skeleton } from '@/components/ui/skeleton';

export default function PublicLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <Skeleton className="h-[180px] w-full rounded-2xl" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
          >
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
