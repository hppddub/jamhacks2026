import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject, renameProject, deleteProjectRow, moveProjectToFolder } from '@/lib/projects/queries';
import { folderExists } from '@/lib/projects/folders';
import { getStorageProvider } from '@/lib/storage/factory';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { id } = await params;
    const body = (await request.json()) as { name?: unknown; folderId?: unknown };

    // Move into a folder when a folderId key is present (string id, or null = root).
    if ('folderId' in body) {
      const folderId = typeof body.folderId === 'string' ? body.folderId : null;
      if (folderId !== null && !(await folderExists(userId, folderId))) {
        return NextResponse.json({ error: 'Destination folder not found.' }, { status: 404 });
      }
      const moved = await moveProjectToFolder(id, userId, folderId);
      if (!moved) {
        return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';

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
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[/api/projects/:id PATCH]', error);
    const message = error instanceof Error ? error.message : 'Failed to rename project.';
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
