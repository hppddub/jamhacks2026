import { Skeleton, ProjectCardSkeleton } from '@/components/ui/Skeleton';

export default function ProjectsLoading() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
