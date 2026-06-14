import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getProject,
  deleteProjectFilesByKind,
  insertProjectFile,
  setProjectMixState,
} from '@/lib/projects/queries';
import { getStorageProvider } from '@/lib/storage/factory';

// Rendering + uploading a master can take a while.
export const maxDuration = 180;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { id } = await params;

    const project = await getProject(id, userId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      // A failed multipart parse here almost always means the proxy truncated an
      // oversized request body (default 10MB cap), dropping the closing boundary.
      // Surface that explicitly instead of a generic 500. See proxyClientMaxBodySize
      // in next.config.ts.
      return NextResponse.json(
        {
          error:
            'The rendered master was too large to upload. Try a shorter mix, or raise proxyClientMaxBodySize in next.config.ts.',
        },
        { status: 413 }
      );
    }
    const master = form.get('master');
    const mixStateRaw = form.get('mixState');

    if (!(master instanceof File) || master.size === 0) {
      return NextResponse.json({ error: 'Missing master audio.' }, { status: 400 });
    }

    let mixState: unknown = null;
    if (typeof mixStateRaw === 'string') {
      try {
        mixState = JSON.parse(mixStateRaw);
      } catch {
        mixState = null;
      }
    }

    const storage = getStorageProvider();

    // Replace any existing master (blob + row).
    const oldMasters = project.files.filter((f) => f.kind === 'master');
    await Promise.allSettled(oldMasters.map((f) => storage.delete(f.url)));
    await deleteProjectFilesByKind(id, 'master');

    const buffer = Buffer.from(await master.arrayBuffer());
    const url = await storage.uploadBytes(buffer, `${id}/master.wav`, 'audio/wav');
    await insertProjectFile({
      projectId: id,
      kind: 'master',
      url,
      filename: 'master.wav',
      sizeBytes: buffer.length,
      mimeType: 'audio/wav',
    });

    await setProjectMixState(id, userId, mixState);

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    console.error('[/api/projects/:id/master]', error);
    const message = error instanceof Error ? error.message : 'Failed to save master.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
