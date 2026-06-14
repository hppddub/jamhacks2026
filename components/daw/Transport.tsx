'use client';

import { formatDuration } from '@/lib/utils';
import type { DAWTransportState, DAWToolMode } from '@/types/daw';

interface TransportProps {
  transport: DAWTransportState;
  currentTime: number;
  totalDuration: number;
  bpm: number;
  loadingAudio: boolean;
  mixerOpen: boolean;
  toolMode: DAWToolMode;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleMixer: () => void;
  onSetToolMode: (mode: DAWToolMode) => void;
}

export function Transport({
  transport, currentTime, totalDuration, bpm, loadingAudio, mixerOpen, toolMode,
  onPlay, onPause, onStop, onBpmChange, onZoomIn, onZoomOut, onToggleMixer, onSetToolMode,
}: TransportProps) {
  const isPlaying = transport === 'playing';

  return (
    <div className="flex items-center gap-4 border-b border-navy-800 bg-navy-950 px-4 py-2">
      {/* Stop */}
      <button
        onClick={onStop}
        title="Stop"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-navy-700 bg-navy-900 text-cream-200 transition-colors hover:bg-navy-800"
      >
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="1" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        disabled={loadingAudio}
        title={isPlaying ? 'Pause' : 'Play'}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ffcc18] text-navy-950 transition-all hover:bg-[#ffd84d] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loadingAudio ? (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : isPlaying ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Time display */}
      <div className="min-w-[80px] rounded-lg border border-navy-700 bg-navy-900 px-3 py-1 text-center font-mono text-sm tabular-nums text-[#ffcc18]">
        {formatDuration(currentTime)}
        <span className="text-cream-500"> / {formatDuration(totalDuration)}</span>
      </div>

      {/* BPM */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-cream-400">BPM</span>
        <input
          type="number"
          min={40}
          max={240}
          value={bpm}
          onChange={e => onBpmChange(parseInt(e.target.value) || DEFAULT_BPM)}
          className="w-16 rounded-lg border border-navy-700 bg-navy-900 px-2 py-1 text-center text-sm text-cream-100 focus:border-[#ffcc18] focus:outline-none"
        />
      </div>

      {/* Move / Slice tool toggle */}
      <div className="flex items-center gap-0.5 rounded-lg border border-navy-700 bg-navy-900 p-0.5" title="Clip tool — Move or Slice">
        <button
          onClick={() => onSetToolMode('move')}
          className={`flex h-6 w-7 items-center justify-center rounded transition-colors ${
            toolMode === 'move' ? 'bg-[#ffcc18] text-navy-950' : 'text-cream-300 hover:bg-navy-800'
          }`}
          title="Move tool (drag clips, trim edges)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
          </svg>
        </button>
        <button
          onClick={() => onSetToolMode('slice')}
          className={`flex h-6 w-7 items-center justify-center rounded transition-colors ${
            toolMode === 'slice' ? 'bg-[#ffcc18] text-navy-950' : 'text-cream-300 hover:bg-navy-800'
          }`}
          title="Slice tool (click a clip to split it)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 4L8.5 15.5M20 20L8.5 8.5" />
          </svg>
        </button>
      </div>

      {/* Mixer toggle */}
      <button
        onClick={onToggleMixer}
        className={`ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
          mixerOpen
            ? 'border-[#ffcc18] bg-[#ffcc18]/15 text-[#ffcc18]'
            : 'border-navy-700 bg-navy-900 text-cream-300 hover:bg-navy-800'
        }`}
        title="Toggle mixer"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6v12M4 9v6m8-9v12m4-7v2m4-5v8" />
        </svg>
        Mixer
      </button>

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-cream-500">Zoom</span>
        <button
          onClick={onZoomOut}
          className="flex h-7 w-7 items-center justify-center rounded border border-navy-700 bg-navy-900 text-cream-300 hover:bg-navy-800"
          title="Zoom out"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M5 12h14" />
          </svg>
        </button>
        <button
          onClick={onZoomIn}
          className="flex h-7 w-7 items-center justify-center rounded border border-navy-700 bg-navy-900 text-cream-300 hover:bg-navy-800"
          title="Zoom in"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const DEFAULT_BPM = 120;
