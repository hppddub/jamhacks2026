'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMoveProject, useMoveFolder } from '@/hooks/useFolders';
import { useToast } from '@/components/ui/Toast';
import { isDraggingItem, readDraggedItem } from './dnd';
import type { FolderCrumb } from '@/types';

function Crumb({
  label, href, folderId, isLast,
}: {
  label: string;
  href: string;
  folderId: string | null;
  isLast: boolean;
}) {
  const [over, setOver] = useState(false);
  const moveProject = useMoveProject();
  const moveFolder = useMoveFolder();
  const { toast } = useToast();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const item = readDraggedItem(e.dataTransfer);
    if (!item) return;
    if (item.kind === 'project') {
      moveProject.mutate(
        { id: item.id, folderId },
        { onSuccess: () => toast(`Moved to ${label}`), onError: (err) => toast(err.message, 'error') }
      );
    } else if (item.kind === 'folder') {
      moveFolder.mutate(
        { id: item.id, parentId: folderId },
        { onSuccess: () => toast(`Moved to ${label}`), onError: (err) => toast(err.message, 'error') }
      );
    }
  };

  const classes = `rounded px-1.5 py-0.5 transition-colors ${
    over ? 'bg-[#ffcc18]/20 text-gold ring-1 ring-[#ffcc18]/40' : isLast ? 'text-cream-100' : 'text-cream-400 hover:text-cream-100'
  }`;

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      if (isDraggingItem(e.dataTransfer)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); }
    },
    onDragLeave: () => setOver(false),
    onDrop: handleDrop,
  };

  return isLast ? (
    <span className={classes} aria-current="page" {...dropProps}>{label}</span>
  ) : (
    <Link href={href} className={classes} {...dropProps}>{label}</Link>
  );
}

export function Breadcrumbs({ path }: { path: FolderCrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm">
      <Crumb label="Projects" href="/projects" folderId={null} isLast={path.length === 0} />
      {path.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1">
          <span className="text-cream-600">/</span>
          <Crumb
            label={crumb.name}
            href={`/projects?folder=${crumb.id}`}
            folderId={crumb.id}
            isLast={i === path.length - 1}
          />
        </span>
      ))}
    </nav>
  );
}
