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

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Create a folder under `parentId` (null = root). */
export function useCreateFolder() {
  const router = useRouter();
  return useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string | null }) =>
      apiJson('/api/folders', jsonInit('POST', { name, parentId })),
    onSuccess: () => router.refresh(),
  });
}

export function useRenameFolder() {
  const router = useRouter();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiJson(`/api/folders/${id}`, jsonInit('PATCH', { name })),
    onSuccess: () => router.refresh(),
  });
}

export function useDeleteFolder() {
  const router = useRouter();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/api/folders/${id}`, { method: 'DELETE' }),
    onSuccess: () => router.refresh(),
  });
}

/** Re-parent a folder (null = root). */
export function useMoveFolder() {
  const router = useRouter();
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      apiJson(`/api/folders/${id}`, jsonInit('PATCH', { parentId })),
    onSuccess: () => router.refresh(),
  });
}

/** Move a project into a folder (null = root). */
export function useMoveProject() {
  const router = useRouter();
  return useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      apiJson(`/api/projects/${id}`, jsonInit('PATCH', { folderId })),
    onSuccess: () => router.refresh(),
  });
}
