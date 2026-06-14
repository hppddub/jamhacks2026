import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveProjectFromWorkflow } from '@/lib/projects/save';
import type { SaveProjectPayload } from '@/types';

// Uploading several artifacts to object storage can take a while on big videos.
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in to save a project.' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<SaveProjectPayload>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'A project name is required.' }, { status: 400 });
    }
    if (name.length > 120) {
      return NextResponse.json({ error: 'Project name is too long (max 120 characters).' }, { status: 400 });
    }
    if (!body.analysis || !body.score || typeof body.videoPath !== 'string' || typeof body.videoFilename !== 'string') {
      return NextResponse.json({ error: 'Incomplete project payload.' }, { status: 400 });
    }

    const { id } = await saveProjectFromWorkflow(userId, {
      name,
      analysis: body.analysis,
      score: body.score,
      stems: body.stems ?? null,
      originalAudioUrl: body.originalAudioUrl ?? null,
      videoPath: body.videoPath,
      videoFilename: body.videoFilename,
    });

    return NextResponse.json({ projectId: id });
  } catch (error) {
    console.error('[/api/projects]', error);
    const message = error instanceof Error ? error.message : 'Failed to save project.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
