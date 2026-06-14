import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getProjectSummaries } from '@/lib/projects/queries';
import { ProjectGrid } from '@/components/projects/ProjectGrid';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const projects = await getProjectSummaries(userId);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-cream-50">Your projects</h1>
        <p className="text-cream-300">
          {projects.length === 0
            ? 'Saved generations will appear here.'
            : `${projects.length} saved ${projects.length === 1 ? 'project' : 'projects'}.`}
        </p>
      </div>

      <ProjectGrid projects={projects} />
    </main>
  );
}
