'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useDAW } from '@/hooks/useDAW';
import { useSaveMaster } from '@/hooks/useSaveMaster';
import { generateId } from '@/lib/utils';
import { TrackLibrary } from '@/components/daw/TrackLibrary';
import { PluginPalette } from '@/components/daw/PluginPalette';
import { Arrangement } from '@/components/daw/Arrangement';
import { Transport } from '@/components/daw/Transport';
import { ExportPanel } from '@/components/daw/ExportPanel';
import { Mixer } from '@/components/daw/Mixer';
import type { DAWLibraryItem, DAWProject } from '@/types/daw';

interface DAWWorkspaceProps {
  seedItems: DAWLibraryItem[];
  /** When set, the workspace is bound to a saved project (enables "Save master"). */
  projectId?: string;
  projectName?: string;
  /** A previously-saved DAW session (projects.mix_state) to restore, if any. */
  savedState?: DAWProject | null;
}

/**
 * The full DAW UI, mounted under the global header (height = viewport − header).
 * Seeded from `seedItems` (built from a project's MixSession) or restored from a
 * saved session. When `projectId` is present, the rendered master can be saved
 * back to the project.
 */
export function DAWWorkspace({ seedItems, projectId, projectName, savedState }: DAWWorkspaceProps) {
  const [libraryItems, setLibraryItems] = useState<DAWLibraryItem[]>(seedItems);
  const daw = useDAW(seedItems, savedState);
  const saveMaster = useSaveMaster();
  const [rendering, setRendering] = useState(false);

  const {
    project, transport, currentTime, pxPerSecond, loadingAudio,
    exportOpen, mixerOpen, selectedInsertId,
  } = daw;

  const selectedInsert = project.inserts.find((i) => i.id === selectedInsertId) ?? project.inserts[0];

  const handleImport = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    const append = (durationSeconds?: number) => {
      setLibraryItems((prev) => [
        ...prev,
        {
          id: generateId(),
          label: file.name.replace(/\.[^.]+$/, ''),
          group: 'imported',
          audioUrl: url,
          color: '#B28B52',
          durationSeconds,
        },
      ]);
    };
    audio.onloadedmetadata = () => append(isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined);
    audio.onerror = () => append(undefined);
    audio.src = url;
  }, []);

  const handleSaveMaster = useCallback(async () => {
    if (!projectId || rendering || saveMaster.isPending) return;
    setRendering(true);
    try {
      const blob = await daw.renderMixBlob();
      saveMaster.mutate({ projectId, blob, mixState: daw.project });
    } finally {
      setRendering(false);
    }
  }, [projectId, rendering, saveMaster, daw]);

  const backHref = projectId ? `/projects/${projectId}` : '/';
  const masterLabel = rendering
    ? 'Rendering…'
    : saveMaster.isPending
      ? 'Saving…'
      : saveMaster.isSuccess
        ? 'Saved ✓'
        : 'Save master to project';

  return (
    <div className="flex h-[calc(100vh-65px)] flex-col overflow-hidden bg-navy-950 text-cream-50">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-navy-800 bg-navy-950/90 px-4 py-2">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-cream-400 transition-colors hover:text-cream-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-xs">{projectId ? 'Back to project' : 'Back'}</span>
        </Link>
        {projectName && (
          <span className="truncate text-sm font-medium text-cream-200">{projectName}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {projectId && saveMaster.isError && (
            <span className="text-xs text-red-400">{(saveMaster.error as Error).message}</span>
          )}
          {projectId && (
            <button
              onClick={handleSaveMaster}
              disabled={rendering || saveMaster.isPending}
              className="rounded-lg bg-[#ffcc18] px-3 py-1.5 text-xs font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {masterLabel}
            </button>
          )}
        </div>
      </div>

      {/* Transport bar */}
      <Transport
        transport={transport}
        currentTime={currentTime}
        totalDuration={project.totalDurationSeconds}
        bpm={project.bpm}
        loadingAudio={loadingAudio}
        mixerOpen={mixerOpen}
        onPlay={() => { void daw.play(); }}
        onPause={daw.pause}
        onStop={daw.stop}
        onBpmChange={daw.setBpm}
        onZoomIn={daw.zoomIn}
        onZoomOut={daw.zoomOut}
        onToggleMixer={() => daw.setMixerOpen(!mixerOpen)}
      />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-[220px] flex-shrink-0 flex-col overflow-y-auto border-r border-navy-800 bg-navy-950">
          <TrackLibrary items={libraryItems} onAdd={daw.addTrackFromLibrary} />
          <PluginPalette
            selectedInsert={selectedInsert}
            onAddEffect={daw.addEffect}
            onOpenMixer={() => daw.setMixerOpen(true)}
          />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <Arrangement
            project={project}
            currentTime={currentTime}
            pxPerSecond={pxPerSecond}
            onSeek={daw.seek}
            onMoveClip={daw.moveClip}
            onDeleteClip={daw.deleteClip}
            onToggleMute={daw.toggleMute}
            onToggleSolo={daw.toggleSolo}
            onToggleCollapse={daw.toggleCollapse}
            onSetVolume={daw.setTrackVolume}
            onSetTrackInsert={daw.setTrackInsert}
            onRemoveTrack={daw.removeTrack}
            onDropItem={daw.dropLibraryItemOnTrack}
          />

          <ExportPanel
            open={exportOpen}
            onToggle={() => daw.setExportOpen(!exportOpen)}
            project={project}
            onExportMix={daw.exportMix}
            onExportTrack={daw.exportTrack}
            onSaveProject={daw.saveProject}
            onImportAudio={handleImport}
          />
        </div>
      </div>

      {/* Bottom dock: Mixer */}
      {mixerOpen && (
        <Mixer
          project={project}
          selectedInsertId={selectedInsertId}
          onSelectInsert={daw.setSelectedInsertId}
          onSetInsertVolume={daw.setInsertVolume}
          onSetInsertPan={daw.setInsertPan}
          onToggleInsertMute={daw.toggleInsertMute}
          onToggleInsertSolo={daw.toggleInsertSolo}
          onAddInsert={daw.addInsert}
          onRemoveEffect={daw.removeEffect}
          onToggleEffect={daw.toggleEffect}
          onUpdateEffectParam={daw.updateEffectParam}
          onClose={() => daw.setMixerOpen(false)}
        />
      )}
    </div>
  );
}
