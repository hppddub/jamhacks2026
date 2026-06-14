'use client';

import { useMutation } from '@tanstack/react-query';
import type { SaveProjectPayload } from '@/types';

async function postSave(payload: SaveProjectPayload): Promise<{ projectId: string }> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { projectId?: string; error?: string };
  if (!res.ok || !data.projectId) {
    throw new Error(data.error ?? 'Failed to save project.');
  }
  return { projectId: data.projectId };
}

/** Saves the current workflow as a project. Returns the new projectId on success. */
export function useSaveProject() {
  return useMutation({ mutationFn: postSave });
}
