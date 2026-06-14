'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import type { DAWLibraryItem } from '@/types/daw';

// Stem colors mirrored from StemPlayer
const STEM_COLORS: Record<string, string> = {
  drums: '#f97316',
  bass: '#a855f7',
  melody: '#ffcc18',
  vocals: '#2dd4bf',
};

const STEM_LABELS: Record<string, string> = {
  drums: 'Drums Stem',
  bass: 'Bass Stem',
  melody: 'Melody Stem',
  vocals: 'Vocals Stem',
};

export default function DAWPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-navy-950 text-sm text-cream-400">
        Loading Studio…
      </div>
    }>
      <DAWContent />
    </Suspense>
  );
}

function DAWContent() {
  const params = useSearchParams();

  // Parse seed library items from URL query params:
  // ?score=/generated/x.mp3&original=/uploads/x.mp3&stems=drums:/stems/id/drums.mp3,...
  const seedItems = useMemo<DAWLibraryItem[]>(() => {
    const items: DAWLibraryItem[] = [];

    const scoreUrl = params.get('score');
    if (scoreUrl) {
      items.push({ id: 'score', label: 'Generated Score', group: 'score', audioUrl: scoreUrl, color: '#ffcc18' });
    }
    const originalUrl = params.get('original');
    if (originalUrl) {
      items.push({ id: 'original', label: 'Original Audio', group: 'original', audioUrl: originalUrl, color: '#7CA0CB' });
    }
    const stemsParam = params.get('stems');
    if (stemsParam) {
      for (const part of stemsParam.split(',')) {
        const idx = part.indexOf(':');
        if (idx < 0) continue;
        const stemId = part.slice(0, idx);
        const url = part.slice(idx + 1);
        items.push({
          id: `stem-${stemId}`,
          label: STEM_LABELS[stemId] ?? `${stemId} Stem`,
          group: 'stems',
          audioUrl: url,
          color: STEM_COLORS[stemId] ?? '#6b7280',
        });
      }
    }
    return items;
  }, [params]);

  // Library is stateful so imported audio can be appended.
  const [libraryItems, setLibraryItems] = useState<DAWLibraryItem[]>(seedItems);

  const daw = useDAW(seedItems);
  const {
    project, transport, currentTime, pxPerSecond, loadingAudio,
    exportOpen, mixerOpen, selectedInsertId, toolMode,
  } = daw;

  const selectedInsert = project.inserts.find(i => i.id === selectedInsertId) ?? project.inserts[0];

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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-navy-950 text-cream-50">
      {/* Page header */}
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-navy-800 bg-navy-950/90 px-4 py-2">
        <Link href="/" className="flex items-center gap-2 text-cream-400 transition-colors hover:text-cream-200">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-xs">Back</span>
        </Link>
        <div className="flex items-center gap-2">
          <Image src="/banana-logo.svg" alt="BananaMOV" width={22} height={22} />
          <span className="text-sm font-bold tracking-tight">BananaMOV</span>
          <span className="text-cream-600">/</span>
          <span className="text-sm text-cream-400">Studio</span>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900 px-3 py-1">
          <div className="h-1.5 w-1.5 rounded-full bg-[#ffcc18]" />
          <span className="text-[10px] font-medium text-cream-400">Powered by ElevenLabs</span>
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
