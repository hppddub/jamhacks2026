'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSaveProject } from '@/hooks/useSaveProject';
import type { SaveProjectPayload } from '@/types';

interface SaveProjectDialogProps {
  base: Omit<SaveProjectPayload, 'name'>;
  defaultName: string;
  /** Where to go after a successful save. 'project' (default) → detail; 'mix' → mixing page. */
  redirectTo?: 'project' | 'mix';
  onClose: () => void;
}

export function SaveProjectDialog({ base, defaultName, redirectTo = 'project', onClose }: SaveProjectDialogProps) {
  const [name, setName] = useState(defaultName);
  const router = useRouter();
  const save = useSaveProject();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || save.isPending) return;
    save.mutate(
      { ...base, name: trimmed },
      {
        onSuccess: ({ projectId }) =>
          router.push(redirectTo === 'mix' ? `/mix/${projectId}` : `/projects/${projectId}`),
      }
    );
  };

  const heading = redirectTo === 'mix' ? 'Save & open mixing' : 'Save project';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !save.isPending && onClose()}
    >
      <div
        className="animate-fade-in w-full max-w-md rounded-xl border border-navy-700 bg-navy-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-cream-50">{heading}</h2>
        <p className="mt-1 text-sm text-cream-300">Give this generation a name to find it later.</p>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape' && !save.isPending) onClose();
          }}
          maxLength={120}
          placeholder="Project name"
          disabled={save.isPending}
          className="mt-4 w-full rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm text-cream-50 outline-none placeholder:text-cream-500 focus:border-[#ffcc18] disabled:opacity-60"
        />

        {save.isError && (
          <p className="mt-3 text-sm text-[#ee4444]">{(save.error as Error).message}</p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={save.isPending}
            className="rounded-lg border border-navy-700 bg-navy-800 px-4 py-2 text-sm text-cream-200 transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={save.isPending || !name.trim()}
            className="rounded-lg bg-[#ffcc18] px-4 py-2 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : redirectTo === 'mix' ? 'Save & mix' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
