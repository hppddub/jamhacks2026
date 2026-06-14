import { cn } from '@/lib/utils';

/** Animated placeholder block used in route-level loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-navy-800', className)}
    />
  );
}

/** A card-shaped skeleton matching ProjectCard's footprint. */
export function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-navy-700 bg-navy-900 p-5">
      <Skeleton className="h-5 w-2/3" />
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
      <Skeleton className="h-3 w-24" />
      <div className="mt-1 border-t border-navy-800 pt-3">
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}
