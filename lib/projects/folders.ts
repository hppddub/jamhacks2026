import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { folders, projects } from '@/lib/db/schema';
import type { FolderCrumb, FolderSummary } from '@/types';

/** Create a folder under `parentId` (null = root), ownership-checked on the parent. */
export async function createFolder(
  userId: string,
  name: string,
  parentId: string | null
): Promise<string | null> {
  if (parentId) {
    const [parent] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, parentId), eq(folders.userId, userId)))
      .limit(1);
    if (!parent) return null; // parent missing or not owned
  }
  const [row] = await db
    .insert(folders)
    .values({ userId, name, parentId })
    .returning({ id: folders.id });
  return row?.id ?? null;
}

/** Direct children folders of `parentId` (null = root), with project/child counts. */
export async function listFolders(userId: string, parentId: string | null): Promise<FolderSummary[]> {
  const rows = await db
    .select()
    .from(folders)
    .where(and(eq(folders.userId, userId), parentId === null ? isNull(folders.parentId) : eq(folders.parentId, parentId)))
    .orderBy(asc(folders.name));

  // Counts across all of the user's folders, grouped — then matched in memory.
  const projCounts = await db
    .select({ folderId: projects.folderId, c: count() })
    .from(projects)
    .where(eq(projects.userId, userId))
    .groupBy(projects.folderId);
  const childCounts = await db
    .select({ parentId: folders.parentId, c: count() })
    .from(folders)
    .where(eq(folders.userId, userId))
    .groupBy(folders.parentId);

  const projByFolder = new Map(projCounts.map((r) => [r.folderId, Number(r.c)]));
  const childByFolder = new Map(childCounts.map((r) => [r.parentId, Number(r.c)]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentId: r.parentId,
    projectCount: projByFolder.get(r.id) ?? 0,
    childCount: childByFolder.get(r.id) ?? 0,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Ancestry of `folderId` from root → current, for breadcrumbs. [] for root. */
export async function getFolderPath(userId: string, folderId: string | null): Promise<FolderCrumb[]> {
  if (!folderId) return [];
  const all = await db
    .select({ id: folders.id, name: folders.name, parentId: folders.parentId })
    .from(folders)
    .where(eq(folders.userId, userId));
  const byId = new Map(all.map((f) => [f.id, f]));
  const path: FolderCrumb[] = [];
  let cur = byId.get(folderId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift({ id: cur.id, name: cur.name });
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

/** True when `folderId` exists and is owned by the user. */
export async function folderExists(userId: string, folderId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function renameFolder(id: string, userId: string, name: string): Promise<boolean> {
  const updated = await db
    .update(folders)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(folders.id, id), eq(folders.userId, userId)))
    .returning({ id: folders.id });
  return updated.length > 0;
}

/** Re-parent a folder, rejecting cycles (can't move a folder into itself/descendant). */
export async function moveFolder(id: string, userId: string, parentId: string | null): Promise<boolean> {
  if (id === parentId) return false;
  const all = await db
    .select({ id: folders.id, parentId: folders.parentId })
    .from(folders)
    .where(eq(folders.userId, userId));
  const ids = new Set(all.map((f) => f.id));
  if (!ids.has(id)) return false;
  if (parentId !== null && !ids.has(parentId)) return false;

  // Collect descendants of `id`; the new parent must not be among them.
  const childrenOf = new Map<string | null, string[]>();
  for (const f of all) {
    const list = childrenOf.get(f.parentId) ?? [];
    list.push(f.id);
    childrenOf.set(f.parentId, list);
  }
  const descendants = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const node = stack.pop()!;
    for (const child of childrenOf.get(node) ?? []) {
      if (!descendants.has(child)) { descendants.add(child); stack.push(child); }
    }
  }
  if (parentId !== null && descendants.has(parentId)) return false;

  const updated = await db
    .update(folders)
    .set({ parentId, updatedAt: new Date() })
    .where(and(eq(folders.id, id), eq(folders.userId, userId)))
    .returning({ id: folders.id });
  return updated.length > 0;
}

/** Delete a folder (cascade-deletes sub-folders; contained projects fall to root). */
export async function deleteFolder(id: string, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, userId)))
    .returning({ id: folders.id });
  return deleted.length > 0;
}
