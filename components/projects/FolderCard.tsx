'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRenameFolder, useDeleteFolder, useMoveProject, useMoveFolder } from '@/hooks/useFolders';
import { useToast } from '@/components/ui/Toast';
import { DND_FOLDER, isDraggingItem, readDraggedItem } from './dnd';
import type { FolderSummary } from '@/types';

export function FolderCard({ folder }: { folder: FolderSummary }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [confirming, setConfirming] = useState(false);
  const [over, setOver] = useState(false);

  const rename = useRenameFolder();
  const del = useDeleteFolder();
  const moveProject = useMoveProject();
  const moveFolder = useMoveFolder();
  const { toast } = useToast();
  const busy = rename.isPending || del.isPending;

  const commitRename = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) {
      setName(folder.name);
      setEditing(false);
      return;
    }
    rename.mutate({ id: folder.id, name: trimmed }, { onSuccess: () => setEditing(false) });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const item = readDraggedItem(e.dataTransfer);
    if (!item) return;
    if (item.kind === 'project') {
      moveProject.mutate(
        { id: item.id, folderId: folder.id },
        { onSuccess: () => toast(`Moved to “${folder.name}”`), onError: (err) => toast(err.message, 'error') }
      );
    } else if (item.kind === 'folder' && item.id !== folder.id) {
      moveFolder.mutate(
        { id: item.id, parentId: folder.id },
        { onSuccess: () => toast(`Moved into “${folder.name}”`), onError: (err) => toast(err.message, 'error') }
      );
    }
  };

  const count = folder.projectCount + folder.childCount;

  return (
    <div
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_FOLDER, folder.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (isDraggingItem(e.dataTransfer)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={`bento-card flex items-center gap-3 rounded-xl border bg-navy-900 p-4 transition-colors ${
        over ? 'border-[#ffcc18] ring-2 ring-[#ffcc18]/40' : 'border-navy-700 hover:border-navy-600'
      }`}
    >
      <span className="material-symbols-outlined flex-shrink-0 !text-3xl text-gold">folder</span>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setName(folder.name); setEditing(false); }
            }}
            onBlur={commitRename}
            maxLength={120}
            disabled={busy}
            className="w-full rounded-lg border border-navy-700 bg-navy-950 px-2 py-1 text-sm font-semibold text-cream-50 outline-none focus:border-[#ffcc18]"
          />
        ) : (
          <Link
            href={`/projects?folder=${folder.id}`}
            className="block truncate text-sm font-semibold text-cream-50 hover:text-gold"
          >
            {folder.name}
          </Link>
        )}
        <p className="mt-0.5 text-xs text-cream-500">
          {count === 0 ? 'Empty' : `${count} item${count === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-2 text-xs">
        {confirming ? (
          <>
            <button
              onClick={() => del.mutate(folder.id)}
              disabled={del.isPending}
              className="font-medium text-[#ee4444] hover:text-[#ee4444]/80 disabled:opacity-50"
            >
              {del.isPending ? '…' : 'Delete'}
            </button>
            <button onClick={() => setConfirming(false)} className="text-cream-400 hover:text-cream-200">
              Cancel
            </button>
          </>
        ) : (
          !editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-cream-400 transition-colors hover:text-cream-50"
                title="Rename folder"
                aria-label="Rename folder"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="text-cream-400 transition-colors hover:text-[#ee4444]"
                title="Delete folder"
                aria-label="Delete folder"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
}
