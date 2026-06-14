import { pgTable, uuid, text, integer, real, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import type { AnalysisResult, GeneratedScore } from '@/types';

/**
 * One row per saved generation (a "project"). The full Gemini analysis and the
 * generated score are stored as jsonb so a saved project can be reconstructed
 * exactly; bpm/genre/mood/duration are denormalized for cheap card rendering.
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(), // Clerk user id
    name: text('name').notNull(), // user-assigned project name
    status: text('status').notNull().default('saved'),
    durationSeconds: real('duration_s'),
    bpm: integer('bpm'),
    genre: text('genre'),
    mood: text('mood'),
    analysis: jsonb('analysis').$type<AnalysisResult>().notNull(),
    score: jsonb('score').$type<GeneratedScore>().notNull(),
    mixState: jsonb('mix_state'), // reserved for future mixing settings (Phase E+)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('projects_user_created_idx').on(t.userId, t.createdAt)]
);

/**
 * Durable object-storage URLs for each artifact belonging to a project
 * (source video, extracted original audio, score, and one row per stem).
 */
export const projectFiles = pgTable(
  'project_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'source_video' | 'original_audio' | 'score' | 'stem'
    stemId: text('stem_id'), // 'drums' | 'bass' | 'melody' | 'vocals' when kind = 'stem'
    url: text('url').notNull(), // object-storage URL
    filename: text('filename'),
    sizeBytes: integer('size_bytes'),
    mimeType: text('mime_type'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_files_project_idx').on(t.projectId)]
);

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type ProjectFileRow = typeof projectFiles.$inferSelect;
export type NewProjectFileRow = typeof projectFiles.$inferInsert;
