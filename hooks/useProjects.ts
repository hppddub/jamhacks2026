'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

async function apiJson(url: string, init: RequestInit): Promise<void> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Request failed.');
  }
}

/** Rename a project, then refresh the server-rendered list. */
export function useRenameProject() {
  const router = useRouter();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiJson(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => router.refresh(),
  });
}

/** Delete a project, then refresh the server-rendered list. */
export function useDeleteProject() {
  const router = useRouter();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => router.refresh(),
  });
}
