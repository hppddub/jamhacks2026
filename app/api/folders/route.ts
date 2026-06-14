import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createFolder } from '@/lib/projects/folders';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const body = (await request.json()) as { name?: unknown; parentId?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const parentId = typeof body.parentId === 'string' ? body.parentId : null;

    if (!name) {
      return NextResponse.json({ error: 'A folder name is required.' }, { status: 400 });
    }
    if (name.length > 120) {
      return NextResponse.json({ error: 'Folder name is too long (max 120 characters).' }, { status: 400 });
    }

    const id = await createFolder(userId, name, parentId);
    if (!id) {
      return NextResponse.json({ error: 'Parent folder not found.' }, { status: 404 });
    }
    return NextResponse.json({ id });
  } catch (error) {
    console.error('[/api/folders POST]', error);
    const message = error instanceof Error ? error.message : 'Failed to create folder.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
