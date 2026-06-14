import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject, renameProject, deleteProjectRow, setProjectMixState } from '@/lib/projects/queries';
import { getStorageProvider } from '@/lib/storage/factory';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH supports two independent updates (either or both):
 *  - `{ name }`     — rename the project.
 *  - `{ mixState }` — persist the DAW arrangement/settings (cheap autosave; no audio render).
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { id } = await params;
    const body = (await request.json()) as { name?: unknown; mixState?: unknown };

    const hasName = typeof body.name === 'string';
    const hasMixState = 'mixState' in body;

    if (!hasName && !hasMixState) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    // Autosave the DAW state (settings, tracks, clips, filters, positions, bpm…).
    if (hasMixState) {
      const ok = await setProjectMixState(id, userId, body.mixState ?? null);
      if (!ok) {
        return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      }
    }

    if (hasName) {
      const name = (body.name as string).trim();
      if (!name) {
        return NextResponse.json({ error: 'A project name is required.' }, { status: 400 });
      }
      if (name.length > 120) {
        return NextResponse.json({ error: 'Project name is too long (max 120 characters).' }, { status: 400 });
      }
      const ok = await renameProject(id, userId, name);
      if (!ok) {
        return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[/api/projects/:id PATCH]', error);
    const message = error instanceof Error ? error.message : 'Failed to update project.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { id } = await params;

    // Fetch first (ownership-checked) so we have the file URLs to clean up.
    const project = await getProject(id, userId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    await deleteProjectRow(id, userId); // cascade-deletes file rows
    const storage = getStorageProvider();
    await Promise.allSettled(project.files.map((f) => storage.delete(f.url)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[/api/projects/:id DELETE]', error);
    const message = error instanceof Error ? error.message : 'Failed to delete project.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
