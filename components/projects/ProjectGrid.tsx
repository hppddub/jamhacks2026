import Link from 'next/link';
import { ProjectCard } from './ProjectCard';
import type { ProjectSummary } from '@/types';

export function ProjectGrid({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-navy-700 bg-navy-900/40 p-12 text-center">
        <p className="text-cream-200">You haven&apos;t saved any projects yet.</p>
        <Link
          href="/studio"
          className="mt-4 inline-block rounded-xl bg-[#ffcc18] px-5 py-2.5 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99]"
        >
          Score a video →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}
