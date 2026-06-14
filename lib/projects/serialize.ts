import type {
  Mood,
  Project,
  ProjectFile,
  ProjectFileKind,
  ProjectSummary,
  StemId,
  StemResult,
} from '@/types';
import type { ProjectFileRow, ProjectRow } from '@/lib/db/schema';

export const STEM_LABELS: Record<StemId, string> = {
  drums: 'Drums & Percussion',
  bass: 'Bass',
  melody: 'Melody & Harmony',
  vocals: 'Vocals',
};

const STEM_ORDER: StemId[] = ['drums', 'bass', 'melody', 'vocals'];

function rowToFile(row: ProjectFileRow): ProjectFile {
  return {
    id: row.id,
    kind: row.kind as ProjectFileKind,
    stemId: (row.stemId ?? undefined) as StemId | undefined,
    url: row.url,
    filename: row.filename ?? undefined,
    sizeBytes: row.sizeBytes ?? undefined,
    mimeType: row.mimeType ?? undefined,
  };
}

/** Maps a DB project row (+ its file rows) to the app-facing Project shape. */
export function rowToProject(row: ProjectRow, fileRows: ProjectFileRow[]): Project {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    status: 'saved',
    durationSeconds: row.durationSeconds ?? undefined,
    bpm: row.bpm ?? undefined,
    genre: row.genre ?? undefined,
    mood: (row.mood ?? undefined) as Mood | undefined,
    analysis: row.analysis,
    score: row.score,
    files: fileRows.map(rowToFile),
    mixState: row.mixState ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Maps a DB project row to the lightweight grid summary. */
export function rowToSummary(row: Pick<
  ProjectRow,
  'id' | 'name' | 'mood' | 'genre' | 'bpm' | 'durationSeconds' | 'createdAt' | 'updatedAt'
>): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    mood: (row.mood ?? undefined) as Mood | undefined,
    genre: row.genre ?? undefined,
    bpm: row.bpm ?? undefined,
    durationSeconds: row.durationSeconds ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface ProjectPlayback {
  videoSrc: string; // '' when no source video file is present
  originalAudioUrl: string | null;
  stems: StemResult | null;
}

/**
 * Reconstructs the playback inputs the detail page feeds to ScoreOutput / StemPlayer
 * from a saved project's files (durable object-storage URLs).
 */
export function buildPlayback(project: Project): ProjectPlayback {
  const video = project.files.find((f) => f.kind === 'source_video');
  const original = project.files.find((f) => f.kind === 'original_audio');
  const stemFiles = project.files.filter((f) => f.kind === 'stem' && f.stemId);

  let stems: StemResult | null = null;
  if (stemFiles.length > 0) {
    stems = {
      jobId: project.id,
      sourceAudioUrl: project.score.audioUrl,
      stems: stemFiles
        .map((f) => ({
          id: f.stemId as StemId,
          label: STEM_LABELS[f.stemId as StemId],
          audioUrl: f.url,
        }))
        .sort((a, b) => STEM_ORDER.indexOf(a.id) - STEM_ORDER.indexOf(b.id)),
    };
  }

  return {
    videoSrc: video?.url ?? '',
    originalAudioUrl: original?.url ?? null,
    stems,
  };
}
