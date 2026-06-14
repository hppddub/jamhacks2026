'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';

/** Delete control for the project detail page; navigates back to /projects on success. */
export function DeleteProjectButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const del = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Failed to delete project.');
      }
    },
    onSuccess: () => {
      router.push('/projects');
      router.refresh();
    },
  });

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-navy-700 bg-navy-800 px-3 py-1.5 text-sm text-cream-300 transition-colors hover:border-red-800/60 hover:text-red-400"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-cream-400">Delete this project?</span>
      <button
        onClick={() => del.mutate()}
        disabled={del.isPending}
        className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-1.5 font-medium text-red-300 transition-colors hover:bg-red-950/60 disabled:opacity-50"
      >
        {del.isPending ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={del.isPending}
        className="rounded-lg border border-navy-700 bg-navy-800 px-3 py-1.5 text-cream-300 transition-colors hover:text-cream-100 disabled:opacity-50"
      >
        Cancel
      </button>
      {del.isError && <span className="text-red-400">{(del.error as Error).message}</span>}
    </span>
  );
}
