import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject, insertProjectFiles } from '@/lib/projects/queries';
import { getStemProvider } from '@/lib/providers/stems/factory';
import { getStorageProvider } from '@/lib/storage/factory';
import { generateId } from '@/lib/utils';
import type { NewProjectFileRow } from '@/lib/db/schema';
import type { StemResult } from '@/types';
import { STEM_LABELS } from '@/lib/projects/serialize';

const STEM_LABEL = STEM_LABELS as Record<string, string>;

type RouteContext = { params: Promise<{ id: string }> };

// Allow up to 3 minutes — same cap as /api/stems for Replicate polling
export const maxDuration = 180;

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const { id } = await params;
    const project = await getProject(id, userId);
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

    // If stems already exist, return them immediately (idempotent).
    const existingStemFiles = project.files.filter((f) => f.kind === 'stem' && f.stemId);
    if (existingStemFiles.length > 0) {
      const stems: StemResult = {
        jobId: project.id,
        sourceAudioUrl: project.score.audioUrl,
        stems: existingStemFiles.map((f) => ({
          id: f.stemId!,
          label: STEM_LABEL[f.stemId!] ?? f.stemId!,
          audioUrl: f.url,
        })),
      };
      return NextResponse.json(stems);
    }

    const scoreFile = project.files.find((f) => f.kind === 'score');
    if (!scoreFile) {
      return NextResponse.json({ error: 'Score file not found in project.' }, { status: 404 });
    }

    // The stem providers expect a local /generated/ path. If the score is in
    // object storage (full HTTPS URL), download it to a temp local file first.
    let localAudioUrl: string;
    let tempLocalPath: string | null = null;

    if (scoreFile.url.startsWith('/generated/')) {
      localAudioUrl = scoreFile.url;
    } else {
      const tempId = generateId();
      tempLocalPath = path.join(process.cwd(), 'public', 'generated', `${tempId}.mp3`);
      fs.mkdirSync(path.dirname(tempLocalPath), { recursive: true });
      const resp = await fetch(scoreFile.url);
      if (!resp.ok) throw new Error(`Failed to download score: HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(tempLocalPath, buf);
      localAudioUrl = `/generated/${tempId}.mp3`;
    }

    let stemResult: StemResult;
    try {
      stemResult = await getStemProvider().separate(localAudioUrl, project.score.instrumentSpec);
    } finally {
      // Clean up temp score file regardless of separation outcome.
      if (tempLocalPath) fs.unlink(tempLocalPath, () => undefined);
    }

    // Upload each stem file to durable storage and build DB rows.
    const storage = getStorageProvider();
    const fileRows: NewProjectFileRow[] = [];
    const durableStems: StemResult['stems'] = [];
    const uploadedUrls: string[] = [];

    try {
      for (const stem of stemResult.stems) {
        // stem.audioUrl is like /stems/{jobId}/{stemId}.wav
        const localPath = path.join(process.cwd(), 'public', stem.audioUrl);
        const ext = path.extname(stem.audioUrl).toLowerCase() || '.wav';
        const mimeType = ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';
        const sizeBytes = fs.statSync(localPath).size;
        const storageKey = `${id}/stem-${stem.id}${ext}`;

        const url = await storage.upload(localPath, storageKey, mimeType);
        uploadedUrls.push(url);

        fileRows.push({
          projectId: id,
          kind: 'stem',
          stemId: stem.id,
          url,
          filename: `${stem.id}${ext}`,
          sizeBytes,
          mimeType,
        });
        durableStems.push({ ...stem, audioUrl: url });
      }

      await insertProjectFiles(fileRows);
    } catch (err) {
      // Best-effort rollback of any uploaded blobs.
      await Promise.allSettled(uploadedUrls.map((u) => storage.delete(u)));
      throw err;
    } finally {
      // Clean up the local stems directory (provider wrote them to public/stems/).
      if (stemResult.stems.length > 0) {
        const stemsDir = path.join(
          process.cwd(), 'public', 'stems', stemResult.jobId
        );
        fs.rm(stemsDir, { recursive: true, force: true }, () => undefined);
      }
    }

    const result: StemResult = {
      jobId: stemResult.jobId,
      sourceAudioUrl: project.score.audioUrl,
      stems: durableStems,
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/projects/:id/stems]', error);
    const message = error instanceof Error ? error.message : 'Stem separation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
