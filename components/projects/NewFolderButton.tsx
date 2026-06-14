'use client';

import { useState } from 'react';
import { useCreateFolder } from '@/hooks/useFolders';
import { useToast } from '@/components/ui/Toast';

export function NewFolderButton({ parentId }: { parentId: string | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const create = useCreateFolder();
  const { toast } = useToast();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setOpen(false); return; }
    create.mutate(
      { name: trimmed, parentId },
      {
        onSuccess: () => { setName(''); setOpen(false); toast('Folder created'); },
        onError: (err) => toast(err.message, 'error'),
      }
    );
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700 bg-navy-800 px-3 py-1.5 text-sm font-medium text-cream-100 transition-colors hover:bg-navy-700"
      >
        <span className="material-symbols-outlined !text-base">create_new_folder</span>
        New folder
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') { setName(''); setOpen(false); }
        }}
        onBlur={submit}
        maxLength={120}
        placeholder="Folder name"
        disabled={create.isPending}
        className="w-44 rounded-lg border border-navy-700 bg-navy-950 px-2.5 py-1.5 text-sm text-cream-50 outline-none placeholder:text-cream-500 focus:border-[#ffcc18]"
      />
    </div>
  );
}
