import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getProject } from '@/lib/projects/queries';
import { buildPlayback } from '@/lib/projects/serialize';
import { AnalysisCard } from '@/components/analysis/AnalysisCard';
import { ScoreOutput } from '@/components/player/ScoreOutput';
import { DownloadButton } from '@/components/player/DownloadButton';
import { DeleteProjectButton } from '@/components/projects/DeleteProjectButton';
import { ProjectStemSection } from '@/components/projects/ProjectStemSection';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { id } = await params;
  const project = await getProject(id, userId);
  if (!project) notFound();

  const playback = buildPlayback(project);
  const { score, analysis } = project;
  const master = project.files.find((f) => f.kind === 'master');

  const meta = [
    { label: 'Mood', value: score.mood },
    { label: 'Genre', value: score.genre },
    { label: 'BPM', value: String(score.bpm) },
    { label: 'Duration', value: `${Math.round(score.durationSeconds)}s` },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <Link href="/projects" className="text-sm text-cream-300 transition-colors hover:text-cream-50">
          ← All projects
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/mix/${project.id}`}
            className="rounded-lg bg-[#ffcc18] px-3 py-1.5 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99]"
          >
            Open Mixing →
          </Link>
          <DeleteProjectButton id={project.id} />
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-cream-50">{project.name}</h1>
        <p className="text-xs text-cream-500">
          Saved{' '}
          {new Date(project.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      </div>

      <AnalysisCard result={analysis} />

      <div className="space-y-3 rounded-xl border border-navy-800 bg-navy-900 p-5">
        <div className="flex flex-wrap gap-2">
          {meta.map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-navy-700 bg-navy-800 px-3 py-1.5">
              <span className="text-xs text-cream-300">{label}: </span>
              <span className="text-xs font-medium capitalize text-cream-100">{value}</span>
            </div>
          ))}
        </div>
        {score.prompt && (
          <div className="rounded-lg border border-navy-800 bg-navy-950/50 p-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-cream-400">
              Generation Prompt
            </p>
            <p className="whitespace-pre-line text-xs italic leading-relaxed text-cream-200">
              {score.prompt}
            </p>
          </div>
        )}
      </div>

      <ScoreOutput score={score} videoSrc={playback.videoSrc} originalAudioUrl={playback.originalAudioUrl} />
      <DownloadButton score={score} />

      {master && (
        <a
          href={master.url}
          download="master.wav"
          className="flex items-center justify-center gap-2 rounded-xl border border-[#ffcc18]/40 bg-[#ffcc18]/10 py-3 text-sm font-semibold text-[#ffcc18] transition-colors hover:bg-[#ffcc18]/20"
        >
          ↓ Download mastered mix (.wav)
        </a>
      )}

      <ProjectStemSection projectId={project.id} initialStems={playback.stems} />
    </main>
  );
}
