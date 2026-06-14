import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getProject } from '@/lib/projects/queries';
import { buildMixSession, mixSessionToDAWSeed } from '@/lib/mix/buildMixSession';
import { DAWWorkspace } from '@/components/daw/DAWWorkspace';
import type { DAWProject } from '@/types/daw';

export const dynamic = 'force-dynamic';

export default async function MixPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { projectId } = await params;
  const project = await getProject(projectId, userId);
  if (!project) notFound();

  const session = buildMixSession(project);
  const seedItems = mixSessionToDAWSeed(session);

  return (
    <DAWWorkspace
      seedItems={seedItems}
      projectId={project.id}
      projectName={project.name}
      savedState={(project.mixState as DAWProject | null) ?? null}
    />
  );
}
