'use client';

import { useRef } from 'react';
import type { DAWProject } from '@/types/daw';

interface ExportPanelProps {
  open: boolean;
  onToggle: () => void;
  project: DAWProject;
  onExportMix: () => Promise<void>;
  onExportTrack: (trackId: string) => Promise<void>;
  onSaveProject: () => void;
  onImportAudio: (file: File) => void;
}

export function ExportPanel({
  open, onToggle, project, onExportMix, onExportTrack, onSaveProject, onImportAudio,
}: ExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportAudio(file);
    e.target.value = ''; // allow re-importing the same file
  };

  return (
    <div className="flex-shrink-0 border-t border-navy-800 bg-navy-900">
      {/* Collapse header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-navy-800/50"
      >
        <svg
          className={`h-3 w-3 flex-shrink-0 text-cream-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="currentColor" viewBox="0 0 24 24"
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-widest text-cream-400">Export &amp; Import</span>
      </button>

      {open && (
        <div className="flex flex-wrap items-center gap-3 border-t border-navy-800/60 px-4 py-3">
          {/* Import audio → appears under "Imported" in the library */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-[#ffcc18]/40 bg-[#ffcc18]/10 px-3 py-1.5 text-xs font-medium text-[#ffcc18] transition-colors hover:bg-[#ffcc18]/20"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Audio
          </button>

          <div className="h-5 w-px bg-navy-700" />

          {/* Export full mix */}
          <button
            onClick={() => { void onExportMix(); }}
            className="flex items-center gap-2 rounded-lg border border-navy-700 bg-navy-800 px-3 py-1.5 text-xs font-medium text-cream-100 transition-colors hover:bg-navy-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Mix (WAV)
          </button>

          {/* Per-track exports */}
          {project.tracks.map(track => (
            <button
              key={track.id}
              onClick={() => { void onExportTrack(track.id); }}
              className="flex items-center gap-1.5 rounded-lg border border-navy-700 bg-navy-800 px-3 py-1.5 text-xs text-cream-200 transition-colors hover:bg-navy-700"
            >
              <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: track.color }} />
              {track.name}
            </button>
          ))}

          {/* Save project */}
          <button
            onClick={onSaveProject}
            className="ml-auto flex items-center gap-2 rounded-lg border border-navy-700 bg-navy-800 px-3 py-1.5 text-xs text-cream-400 transition-colors hover:bg-navy-700 hover:text-cream-200"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Project (.json)
          </button>
        </div>
      )}
    </div>
  );
}
