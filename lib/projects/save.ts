import fs from 'fs';
import path from 'path';
import { getStorageProvider } from '@/lib/storage/factory';
import { generateId } from '@/lib/utils';
import { insertProject, hardDeleteProjectRow } from './queries';
import type { NewProjectFileRow, NewProjectRow } from '@/lib/db/schema';
import type { GeneratedScore, ProjectFileKind, SaveProjectPayload, StemId } from '@/types';

const VIDEO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

/** Resolve a public URL (e.g. /generated/x.mp3) to a local path, rejecting traversal. */
function publicUrlToLocal(url: string, sub: 'uploads' | 'generated' | 'stems'): string {
  if (typeof url !== 'string' || !url.startsWith(`/${sub}/`)) {
    throw new Error(`Invalid ${sub} URL: ${url}`);
  }
  const base = path.resolve(process.cwd(), 'public', sub);
  const resolved = path.resolve(path.join(process.cwd(), 'public', url));
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Refusing to read outside public/${sub}: ${url}`);
  }
  return resolved;
}

/** Validate an absolute upload path stays within public/uploads, rejecting traversal. */
function validateUploadsAbsPath(absPath: string): string {
  const base = path.resolve(process.cwd(), 'public', 'uploads');
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(base + path.sep)) {
    throw new Error('Source video path is outside the uploads directory.');
  }
  return resolved;
}

interface Artifact {
  kind: ProjectFileKind;
  stemId?: StemId;
  localPath: string;
  key: string;
  contentType: string;
  filename?: string;
}

/**
 * Promotes the in-memory workflow artifacts to durable storage and writes the
 * project + file rows. Uploads happen before the DB write; on any failure the
 * uploaded blobs and (any) inserted project row are best-effort removed.
 */
export async function saveProjectFromWorkflow(
  userId: string,
  payload: SaveProjectPayload
): Promise<{ id: string }> {
  const id = generateId();
  const storage = getStorageProvider();

  const videoLocal = validateUploadsAbsPath(payload.videoPath);
  const videoExt = (path.extname(videoLocal) || '.mp4').toLowerCase();

  const artifacts: Artifact[] = [
    {
      kind: 'source_video',
      localPath: videoLocal,
      key: `${id}/source${videoExt}`,
      contentType: VIDEO_MIME[videoExt] ?? 'video/mp4',
      filename: payload.videoFilename,
    },
    {
      kind: 'score',
      localPath: publicUrlToLocal(payload.score.audioUrl, 'generated'),
      key: `${id}/score.mp3`,
      contentType: 'audio/mpeg',
      filename: payload.score.filename,
    },
  ];

  if (payload.originalAudioUrl) {
    artifacts.push({
      kind: 'original_audio',
      localPath: publicUrlToLocal(payload.originalAudioUrl, 'uploads'),
      key: `${id}/original.mp3`,
      contentType: 'audio/mpeg',
      filename: 'original.mp3',
    });
  }

  if (payload.stems) {
    for (const stem of payload.stems.stems) {
      artifacts.push({
        kind: 'stem',
        stemId: stem.id,
        localPath: publicUrlToLocal(stem.audioUrl, 'stems'),
        key: `${id}/stem-${stem.id}.mp3`,
        contentType: 'audio/mpeg',
        filename: `${stem.id}.mp3`,
      });
    }
  }

  const uploadedUrls: string[] = [];
  try {
    const fileRows: NewProjectFileRow[] = [];
    let scoreUrl = payload.score.audioUrl;

    for (const a of artifacts) {
      const sizeBytes = fs.statSync(a.localPath).size;
      const url = await storage.upload(a.localPath, a.key, a.contentType);
      uploadedUrls.push(url);
      if (a.kind === 'score') scoreUrl = url;
      fileRows.push({
        projectId: id,
        kind: a.kind,
        stemId: a.stemId ?? null,
        url,
        filename: a.filename ?? null,
        sizeBytes,
        mimeType: a.contentType,
      });
    }

    // Store the score with its durable URL so the detail page plays it back directly.
    const storedScore: GeneratedScore = { ...payload.score, audioUrl: scoreUrl };

    const projectRow: NewProjectRow = {
      id,
      userId,
      name: payload.name,
      status: 'saved',
      durationSeconds: payload.score.durationSeconds ?? null,
      bpm: payload.score.bpm ?? null,
      genre: payload.score.genre ?? null,
      mood: payload.score.mood ?? null,
      analysis: payload.analysis,
      score: storedScore,
    };

    await insertProject(projectRow, fileRows);
    return { id };
  } catch (err) {
    // Roll back: remove uploaded blobs and any inserted project row.
    await Promise.allSettled(uploadedUrls.map((u) => storage.delete(u)));
    await hardDeleteProjectRow(id).catch(() => undefined);
    throw err;
  }
}
