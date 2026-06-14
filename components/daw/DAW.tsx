'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useDAW } from '@/hooks/useDAW';
import { generateId } from '@/lib/utils';
import { TrackLibrary } from '@/components/daw/TrackLibrary';
import { PluginPalette } from '@/components/daw/PluginPalette';
import { Arrangement } from '@/components/daw/Arrangement';
import { Transport } from '@/components/daw/Transport';
import { ExportPanel } from '@/components/daw/ExportPanel';
import { Mixer } from '@/components/daw/Mixer';
import type { DAWLibraryItem, DAWProject } from '@/types/daw';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DEBOUNCE_MS = 1500;

interface DAWProps {
  /** Library items to seed the arrangement / track library from (URL- or project-sourced). */
  seedItems: DAWLibraryItem[];
  /** Restored DAW arrangement (bpm, tracks, clips, inserts, effects, positions). */
  savedState?: DAWProject | null;
  /** When set, the DAW is bound to a saved project: edits autosave + "Save Master" is shown. */
  projectId?: string;
  projectName?: string;
  backHref?: string;
}

export function DAW({ seedItems, savedState = null, projectId, projectName, backHref = '/' }: DAWProps) {
  const daw = useDAW(seedItems, savedState);
  const {
    project, transport, currentTime, pxPerSecond, loadingAudio,
    exportOpen, mixerOpen, selectedInsertId, toolMode,
  } = daw;

  const [libraryItems, setLibraryItems] = useState<DAWLibraryItem[]>(seedItems);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savingMaster, setSavingMaster] = useState(false);

  const selectedInsert = project.inserts.find(i => i.id === selectedInsertId) ?? project.inserts[0];

  // ── Autosave the DAW settings (debounced) whenever the project changes ───────
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstAutosave = useRef(true);
  useEffect(() => {
    if (!projectId) return;
    if (skipFirstAutosave.current) { skipFirstAutosave.current = false; return; }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const res = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mixState: project }),
        });
        setSaveStatus(res.ok ? 'saved' : 'error');
      } catch {
        setSaveStatus('error');
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [project, projectId]);

  // ── Save the rendered master WAV (+ settings) to the project ─────────────────
  const saveMaster = useCallback(async () => {
    if (!projectId) return;
    setSavingMaster(true);
    setSaveStatus('saving');
    try {
      const blob = await daw.renderMasterBlob();
      const form = new FormData();
      form.append('master', blob, 'master.wav');
      form.append('mixState', JSON.stringify(daw.project));
      const res = await fetch(`/api/projects/${projectId}/master`, { method: 'POST', body: form });
      setSaveStatus(res.ok ? 'saved' : 'error');
    } catch {
      setSaveStatus('error');
    } finally {
      setSavingMaster(false);
    }
  }, [projectId, daw]);

  const handleImport = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    const append = (durationSeconds?: number) => {
      setLibraryItems(prev => [...prev, {
        id: generateId(),
        label: file.name.replace(/\.[^.]+$/, ''),
        group: 'imported',
        audioUrl: url,
        color: '#B28B52',
        durationSeconds,
      }]);
    };
    audio.onloadedmetadata = () => append(isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined);
    audio.onerror = () => append(undefined);
    audio.src = url;
  }, []);

  const saveLabel = saveStatus === 'saving' ? 'Saving…'
    : saveStatus === 'saved' ? 'All changes saved'
    : saveStatus === 'error' ? 'Save failed' : '';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-navy-950 text-cream-50">
      {/* Page header */}
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-navy-800 bg-navy-950/90 px-4 py-2">
        <Link href={backHref} className="flex items-center gap-2 text-cream-400 transition-colors hover:text-cream-200">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-xs">Back</span>
        </Link>
        <div className="flex items-center gap-2">
          <Image src="/banana-logo.svg" alt="BananaMOV" width={22} height={22} />
          <span className="text-sm font-bold tracking-tight">BananaMOV</span>
          <span className="text-cream-600">/</span>
          <span className="max-w-[200px] truncate text-sm text-cream-400">{projectName ?? 'Studio'}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {projectId && saveLabel && (
            <span className={`text-[11px] ${saveStatus === 'error' ? 'text-red-400' : 'text-cream-500'}`}>
              {saveLabel}
            </span>
          )}
          {projectId && (
            <button
              onClick={() => { void saveMaster(); }}
              disabled={savingMaster}
              className="flex items-center gap-1.5 rounded-lg bg-[#ffcc18] px-3 py-1 text-xs font-semibold text-navy-950 transition-colors hover:bg-[#ffd84d] disabled:cursor-not-allowed disabled:opacity-60"
              title="Render the mix and save it to this project"
            >
              {savingMaster ? (
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              Save Master
            </button>
          )}
          <div className="flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900 px-3 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-[#ffcc18]" />
            <span className="text-[10px] font-medium text-cream-400">Powered by ElevenLabs</span>
          </div>
        </div>
      </header>

      {/* Transport bar */}
      <Transport
        transport={transport}
        currentTime={currentTime}
        totalDuration={project.totalDurationSeconds}
        bpm={project.bpm}
        loadingAudio={loadingAudio}
        mixerOpen={mixerOpen}
        toolMode={toolMode}
        onPlay={() => { void daw.play(); }}
        onPause={daw.pause}
        onStop={daw.stop}
        onBpmChange={daw.setBpm}
        onZoomIn={daw.zoomIn}
        onZoomOut={daw.zoomOut}
        onToggleMixer={() => daw.setMixerOpen(!mixerOpen)}
        onSetToolMode={daw.setToolMode}
      />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Track Library + Plugins */}
        <div className="flex w-[220px] flex-shrink-0 flex-col overflow-y-auto border-r border-navy-800 bg-navy-950">
          <TrackLibrary items={libraryItems} onAdd={daw.addTrackFromLibrary} />
          <PluginPalette
            selectedInsert={selectedInsert}
            onAddEffect={daw.addEffect}
            onOpenMixer={() => daw.setMixerOpen(true)}
          />
        </div>

        {/* Right: Arrangement + Export */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Arrangement
            project={project}
            currentTime={currentTime}
            pxPerSecond={pxPerSecond}
            timelineDuration={daw.timelineDurationSeconds}
            toolMode={toolMode}
            onSeek={daw.seek}
            onMoveClip={daw.moveClip}
            onDeleteClip={daw.deleteClip}
            onTrimClipStart={daw.trimClipStart}
            onTrimClipEnd={daw.trimClipEnd}
            onSplitClip={daw.splitClip}
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
