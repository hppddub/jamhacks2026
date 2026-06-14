import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, projectFiles } from '@/lib/db/schema';
import type { NewProjectRow, NewProjectFileRow } from '@/lib/db/schema';
import type { Project, ProjectSummary } from '@/types';
import { rowToProject, rowToSummary } from './serialize';

/** Insert a project row and its file rows. neon-http has no transactions, so on a
 *  files-insert failure the project row is rolled back manually by the caller. */
export async function insertProject(
  project: NewProjectRow,
  files: NewProjectFileRow[]
): Promise<void> {
  await db.insert(projects).values(project);
  if (files.length > 0) {
    await db.insert(projectFiles).values(files);
  }
}

/** Best-effort removal of a project row (used to roll back a partial save). */
export async function hardDeleteProjectRow(id: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, id));
}

/** Lightweight list for the grid, newest first, scoped to the user. */
export async function getProjectSummaries(userId: string): Promise<ProjectSummary[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      mood: projects.mood,
      genre: projects.genre,
      bpm: projects.bpm,
      durationSeconds: projects.durationSeconds,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt));
  return rows.map(rowToSummary);
}

/** Full project (+ files), ownership-checked. Returns null if missing or not owned. */
export async function getProject(id: string, userId: string): Promise<Project | null> {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  if (!row) return null;

  const fileRows = await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.projectId, id));

  return rowToProject(row, fileRows);
}

/** Rename, ownership-checked. Returns false if the project doesn't exist / isn't owned. */
export async function renameProject(
  id: string,
  userId: string,
  name: string
): Promise<boolean> {
  const updated = await db
    .update(projects)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  return updated.length > 0;
}

/** Delete a project (cascade-deletes its file rows), ownership-checked. */
export async function deleteProjectRow(id: string, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  return deleted.length > 0;
}

/** Delete all file rows of a given kind for a project (e.g. replacing the master). */
export async function deleteProjectFilesByKind(projectId: string, kind: string): Promise<void> {
  await db.delete(projectFiles).where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.kind, kind)));
}

/** Insert a single project file row. */
export async function insertProjectFile(file: NewProjectFileRow): Promise<void> {
  await db.insert(projectFiles).values(file);
}

/** Insert multiple project file rows in one statement. */
export async function insertProjectFiles(files: NewProjectFileRow[]): Promise<void> {
  if (files.length > 0) await db.insert(projectFiles).values(files);
}

/** Persist the DAW session JSON to a project's mix_state, ownership-checked. */
export async function setProjectMixState(id: string, userId: string, mixState: unknown): Promise<boolean> {
  const updated = await db
    .update(projects)
    .set({ mixState, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  return updated.length > 0;
}
