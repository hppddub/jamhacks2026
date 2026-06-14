import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getProject } from '@/lib/projects/queries';
import { buildMixSession } from '@/lib/mix/buildMixSession';

export const dynamic = 'force-dynamic';

/**
 * '/mix/[projectId]' — opens a saved project in the DAW.
 *
 * The DAW lives at the public, URL-seeded '/daw' route (?score=&original=&stems=).
 * This gated RSC loads the owner's project and forwards its audio tracks to /daw.
 * (Restoring a previously saved arrangement / mix_state is a future enhancement;
 * for now the project's score, stems and original audio are loaded fresh.)
 */
export default async function MixPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { projectId } = await params;
  const project = await getProject(projectId, userId);
  if (!project) notFound();

  const session = buildMixSession(project);

  const p = new URLSearchParams();
  const score = session.tracks.find((t) => t.kind === 'score');
  if (score) p.set('score', score.url);
  const original = session.tracks.find((t) => t.kind === 'original');
  if (original) p.set('original', original.url);
  const stems = session.tracks.filter((t) => t.kind === 'stem');
  if (stems.length > 0) p.set('stems', stems.map((t) => `${t.id}:${t.url}`).join(','));

  redirect(`/daw?${p.toString()}`);
}
