import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getProject } from '@/lib/projects/queries';
import { buildMixSession, mixSessionToDAWSeed } from '@/lib/mix/buildMixSession';
import { DAW } from '@/components/daw/DAW';
import type { DAWProject } from '@/types/daw';

export const dynamic = 'force-dynamic';

/**
 * '/mix/[projectId]' — opens a saved project in the full DAW.
 *
 * Seeds the track library from the project's durable audio (score / stems / original)
 * and restores the saved arrangement (`mix_state`): bpm, tracks, clips, positions,
 * trims, mixer inserts, filters. Edits autosave back to the project; "Save Master"
 * renders the mixed WAV. Gated to the project's owner.
 */
export default async function MixPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { projectId } = await params;
  const project = await getProject(projectId, userId);
  if (!project) notFound();

  const session = buildMixSession(project);
  const seedItems = mixSessionToDAWSeed(session);
  const savedState = (project.mixState as DAWProject | null) ?? null;

  return (
    <DAW
      seedItems={seedItems}
      savedState={savedState}
      projectId={project.id}
      projectName={project.name}
      backHref={`/projects/${project.id}`}
    />
  );
}
