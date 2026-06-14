'use client';

import type { DAWLibraryItem } from '@/types/daw';
import { formatDuration } from '@/lib/utils';

interface TrackLibraryProps {
  items: DAWLibraryItem[];
  onAdd: (item: DAWLibraryItem) => void;
}

const GROUP_LABELS: Record<string, string> = {
  score: 'Generated Score',
  stems: 'Audio Tracks',
  original: 'Original Audio',
  imported: 'Imported',
};

export function TrackLibrary({ items, onAdd }: TrackLibraryProps) {
  const groups = ['score', 'stems', 'original', 'imported'] as const;

  const handleDragStart = (e: React.DragEvent, item: DAWLibraryItem) => {
    e.dataTransfer.setData('application/daw-item', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-col">
      <div className="border-b border-navy-800 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-cream-400">Track Library</p>
      </div>

      {groups.map(group => {
        const groupItems = items.filter(i => i.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group} className="border-b border-navy-800/60">
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-cream-500">
              {GROUP_LABELS[group]}
            </p>
            {groupItems.map(item => (
              <div
                key={item.id}
                draggable
                onDragStart={e => handleDragStart(e, item)}
                className="group flex cursor-grab items-center gap-2 px-3 py-2 transition-colors hover:bg-navy-900 active:cursor-grabbing"
              >
                <div
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-cream-200">{item.label}</p>
                  {item.durationSeconds !== undefined && (
                    <p className="text-[10px] text-cream-500">{formatDuration(item.durationSeconds)}</p>
                  )}
                </div>
                <button
                  onClick={() => onAdd(item)}
                  title={`Add ${item.label} to arrangement`}
                  className="flex-shrink-0 rounded p-0.5 text-cream-500 opacity-0 transition-opacity hover:text-cream-200 group-hover:opacity-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-cream-500">No audio sources available.</p>
          <p className="mt-1 text-xs text-cream-500">Generate a score first.</p>
        </div>
      )}
    </div>
  );
}
