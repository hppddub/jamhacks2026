'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRenameProject, useDeleteProject } from '@/hooks/useProjects';
import { formatDuration } from '@/lib/utils';
import type { ProjectSummary } from '@/types';

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [confirming, setConfirming] = useState(false);
  const rename = useRenameProject();
  const del = useDeleteProject();
  const busy = rename.isPending || del.isPending;

  const commitRename = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) {
      setName(project.name);
      setEditing(false);
      return;
    }
    rename.mutate({ id: project.id, name: trimmed }, { onSuccess: () => setEditing(false) });
  };

  const meta = [
    project.mood,
    project.genre,
    project.bpm ? `${project.bpm} BPM` : null,
    project.durationSeconds ? formatDuration(project.durationSeconds) : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col rounded-xl border border-navy-700 bg-navy-900 p-5 transition-colors hover:border-navy-600">
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setName(project.name);
              setEditing(false);
            }
          }}
          onBlur={commitRename}
          maxLength={120}
          disabled={busy}
          className="w-full rounded-lg border border-navy-700 bg-navy-950 px-2 py-1 text-base font-semibold text-cream-50 outline-none focus:border-[#ffcc18]"
        />
      ) : (
        <Link
          href={`/projects/${project.id}`}
          className="truncate text-base font-semibold text-cream-50 hover:text-[#ffcc18]"
        >
          {project.name}
        </Link>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {meta.map((m) => (
          <span
            key={m}
            className="rounded-md border border-navy-700 bg-navy-800 px-2 py-0.5 text-xs capitalize text-cream-200"
          >
            {m}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-cream-500">
        {new Date(project.createdAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </p>

      <div className="mt-4 flex items-center gap-3 border-t border-navy-800 pt-3 text-xs">
        <Link href={`/projects/${project.id}`} className="font-medium text-[#ffcc18] hover:underline">
          Open
        </Link>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="text-cream-300 transition-colors hover:text-cream-50 disabled:opacity-50"
          >
            Rename
          </button>
        )}
        <div className="ml-auto">
          {confirming ? (
            <span className="flex items-center gap-2">
              <span className="text-cream-400">Delete?</span>
              <button
                onClick={() => del.mutate(project.id)}
                disabled={busy}
                className="font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {del.isPending ? 'Deleting…' : 'Yes'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="text-cream-400 hover:text-cream-200 disabled:opacity-50"
              >
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              disabled={busy}
              className="text-cream-400 transition-colors hover:text-red-400 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {(rename.isError || del.isError) && (
        <p className="mt-2 text-xs text-red-400">
          {((rename.error ?? del.error) as Error).message}
        </p>
      )}
    </div>
  );
}
