import Link from 'next/link';
import { ProjectCard } from './ProjectCard';
import type { ProjectSummary } from '@/types';

/** Grid of project cards (no empty handling — the page composes the empty state). */
export function ProjectGrid({ projects }: { projects: ProjectSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}

/** Shown when a folder (or the root) has neither sub-folders nor projects. */
export function ProjectsEmptyState({ inFolder }: { inFolder: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-navy-700 bg-navy-900/40 px-6 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ffcc18]/10 ring-1 ring-[#ffcc18]/20">
        <span className="material-symbols-outlined !text-3xl text-gold">
          {inFolder ? 'folder_open' : 'library_music'}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-cream-50">
        {inFolder ? 'This folder is empty' : 'No projects yet'}
      </h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-cream-300">
        {inFolder
          ? 'Drag projects here to organise them, or create a sub-folder.'
          : 'Score a video and save it — your generations will collect here, ready to revisit, remix, and master.'}
      </p>
      <Link
        href="/studio"
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-[#ffcc18] px-5 py-2.5 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99]"
      >
        <span className="material-symbols-outlined !text-base">add</span>
        {inFolder ? 'Score a video' : 'Score your first video'}
      </Link>
    </div>
  );
}
