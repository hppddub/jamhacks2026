import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getProjectSummaries } from '@/lib/projects/queries';
import { listFolders, getFolderPath } from '@/lib/projects/folders';
import { ProjectGrid, ProjectsEmptyState } from '@/components/projects/ProjectGrid';
import { FolderCard } from '@/components/projects/FolderCard';
import { Breadcrumbs } from '@/components/projects/Breadcrumbs';
import { NewFolderButton } from '@/components/projects/NewFolderButton';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const sp = await searchParams;
  const folderId = typeof sp.folder === 'string' ? sp.folder : null;

  const [folderPath, childFolders, projects] = await Promise.all([
    getFolderPath(userId, folderId),
    listFolders(userId, folderId),
    getProjectSummaries(userId, folderId),
  ]);

  // A folder id that resolves to no ancestry doesn't exist / isn't owned → go to root.
  if (folderId && folderPath.length === 0) redirect('/projects');

  const currentName = folderPath.length > 0 ? folderPath[folderPath.length - 1].name : 'Your projects';
  const isEmpty = childFolders.length === 0 && projects.length === 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <Breadcrumbs path={folderPath} />

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-cream-50">{currentName}</h1>
          <p className="text-sm text-cream-300">
            {isEmpty
              ? 'Create folders and drag projects in to organise them.'
              : `${childFolders.length} folder${childFolders.length === 1 ? '' : 's'} · ${projects.length} project${projects.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <NewFolderButton parentId={folderId} />
      </div>

      {childFolders.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-cream-400">Folders</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {childFolders.map((f) => (
              <FolderCard key={f.id} folder={f} />
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 ? (
        <section className="space-y-3">
          {childFolders.length > 0 && (
            <h2 className="text-xs font-medium uppercase tracking-wider text-cream-400">Projects</h2>
          )}
          <ProjectGrid projects={projects} />
        </section>
      ) : (
        childFolders.length === 0 && <ProjectsEmptyState inFolder={folderId !== null} />
      )}
    </main>
  );
}
