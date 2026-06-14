import { Skeleton } from '@/components/ui/Skeleton';

export default function ProjectDetailLoading() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Analysis card */}
      <Skeleton className="h-64 w-full rounded-xl" />

      {/* Score panel */}
      <Skeleton className="h-28 w-full rounded-xl" />

      {/* Player */}
      <Skeleton className="h-40 w-full rounded-xl" />
    </main>
  );
}
