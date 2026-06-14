import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { renameFolder, moveFolder, deleteFolder } from '@/lib/projects/folders';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { id } = await params;
    const body = (await request.json()) as { name?: unknown; parentId?: unknown };

    // Move (re-parent) when a parentId key is present (string folder id, or null = root).
    if ('parentId' in body) {
      const parentId = typeof body.parentId === 'string' ? body.parentId : null;
      const ok = await moveFolder(id, userId, parentId);
      if (!ok) {
        return NextResponse.json(
          { error: 'Could not move folder — it may not exist or the move would create a loop.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Otherwise treat as a rename.
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'A folder name is required.' }, { status: 400 });
    }
    if (name.length > 120) {
      return NextResponse.json({ error: 'Folder name is too long (max 120 characters).' }, { status: 400 });
    }
    const ok = await renameFolder(id, userId, name);
    if (!ok) {
      return NextResponse.json({ error: 'Folder not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[/api/folders/:id PATCH]', error);
    const message = error instanceof Error ? error.message : 'Failed to update folder.';
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
    const ok = await deleteFolder(id, userId);
    if (!ok) {
      return NextResponse.json({ error: 'Folder not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[/api/folders/:id DELETE]', error);
    const message = error instanceof Error ? error.message : 'Failed to delete folder.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
