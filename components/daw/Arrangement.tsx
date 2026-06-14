'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DAWClip, DAWLibraryItem, DAWProject, DAWTrack, DAWToolMode, MixerInsert } from '@/types/daw';
import { getPeaks } from '@/lib/audio/waveform';

const TRACK_HEIGHT = 60;
const COLLAPSED_HEIGHT = 28;
const RULER_HEIGHT = 30;
const HEADER_WIDTH = 200;
const MIN_CLIP = 0.1;       // smallest trim/split length (s)
const TRIM_HANDLE_PX = 6;   // edge hit-zone width

interface ArrangementProps {
  project: DAWProject;
  currentTime: number;
  pxPerSecond: number;
  toolMode: DAWToolMode;
  onSeek: (t: number) => void;
  onMoveClip: (clipId: string, newStart: number) => void;
  onDeleteClip: (clipId: string) => void;
  onTrimClipStart: (clipId: string, newStart: number) => void;
  onTrimClipEnd: (clipId: string, newDuration: number) => void;
  onSplitClip: (clipId: string, atSeconds: number) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onToggleCollapse: (trackId: string) => void;
  onSetVolume: (trackId: string, vol: number) => void;
  onSetTrackInsert: (trackId: string, insertId: string) => void;
  onRemoveTrack: (trackId: string) => void;
  onDropItem: (item: DAWLibraryItem, trackId: string, startSeconds: number) => void;
}

function gridBackground(pxPerBeat: number): string {
  const pxPerBar = pxPerBeat * 4;
  // Bar lines (brighter) painted over beat lines (subtle).
  return [
    `repeating-linear-gradient(to right, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 1px, transparent 1px, transparent ${pxPerBar}px)`,
    `repeating-linear-gradient(to right, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent ${pxPerBeat}px)`,
  ].join(', ');
}

function Ruler({ totalDuration, pxPerSecond, secondsPerBar, pxPerBeat, onSeek }: {
  totalDuration: number;
  pxPerSecond: number;
  secondsPerBar: number;
  pxPerBeat: number;
  onSeek: (t: number) => void;
}) {
  const totalWidth = totalDuration * pxPerSecond;
  const barCount = Math.floor(totalDuration / secondsPerBar) + 1;
  const bars = Array.from({ length: barCount }, (_, i) => i);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek((e.clientX - rect.left) / pxPerSecond);
  };

  return (
    <div
      className="relative cursor-pointer select-none bg-navy-900"
      style={{
        width: totalWidth, height: RULER_HEIGHT,
        backgroundImage: `repeating-linear-gradient(to right, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent ${pxPerBeat}px)`,
      }}
      onClick={handleClick}
    >
      {bars.map(i => (
        <div key={i} className="absolute top-0 flex h-full flex-col justify-between" style={{ left: i * secondsPerBar * pxPerSecond }}>
          <div className="h-2.5 w-px bg-navy-500" />
          <span className="pl-1 text-[9px] tabular-nums text-cream-500">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

/** Monochrome peak waveform drawn inside the clip's trimmed window. */
function ClipWaveform({ audioUrl, offsetSeconds, durationSeconds, sourceDurationSeconds, width, height }: {
  audioUrl: string;
  offsetSeconds: number;
  durationSeconds: number;
  sourceDurationSeconds: number;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);

  useEffect(() => {
    let alive = true;
    getPeaks(audioUrl).then(p => { if (alive) setPeaks(p); }).catch(() => {});
    return () => { alive = false; };
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!peaks || peaks.length === 0) return;

    const srcDur = sourceDurationSeconds > 0 ? sourceDurationSeconds : durationSeconds;
    const total = peaks.length;
    const i0 = Math.max(0, Math.floor((offsetSeconds / srcDur) * total));
    const i1 = Math.min(total, Math.max(i0 + 1, Math.ceil(((offsetSeconds + durationSeconds) / srcDur) * total)));
    const span = i1 - i0;
    const mid = h / 2;
    ctx.fillStyle = 'rgba(15, 30, 53, 0.55)'; // dark navy, reads on any clip color
    for (let x = 0; x < w; x++) {
      const bi = i0 + Math.floor((x / w) * span);
      const p = peaks[Math.min(total - 1, Math.max(0, bi))] || 0;
      const bh = Math.max(1, p * (h - 2));
      ctx.fillRect(x, mid - bh / 2, 1, bh);
    }
  }, [peaks, offsetSeconds, durationSeconds, sourceDurationSeconds, width, height]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

interface ClipProps {
  clip: DAWClip;
  pxPerSecond: number;
  secondsPerBeat: number;
  toolMode: DAWToolMode;
  onMoveClip: (clipId: string, newStart: number) => void;
  onDeleteClip: (clipId: string) => void;
  onTrimStart: (clipId: string, newStart: number) => void;
  onTrimEnd: (clipId: string, newDuration: number) => void;
  onSplit: (clipId: string, atSeconds: number) => void;
}

function Clip({ clip, pxPerSecond, secondsPerBeat, toolMode, onMoveClip, onDeleteClip, onTrimStart, onTrimEnd, onSplit }: ClipProps) {
  const dragRef = useRef<{ startX: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [trim, setTrim] = useState<{ edge: 'start' | 'end'; dx: number } | null>(null);

  const snap = (t: number) => Math.round(t / secondsPerBeat) * secondsPerBeat;

  // ── Body: move (move tool) or split (slice tool) ───────────────────────────
  const handleBodyDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    if (toolMode === 'slice') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const at = snap(clip.startSeconds + (e.clientX - rect.left) / pxPerSecond);
      onSplit(clip.id, at);
      return;
    }

    dragRef.current = { startX: e.clientX };
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setDragOffset((ev.clientX - dragRef.current.startX) / pxPerSecond);
    };
    const onUp = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const raw = clip.startSeconds + (ev.clientX - dragRef.current.startX) / pxPerSecond;
      onMoveClip(clip.id, Math.max(0, snap(raw)));
      dragRef.current = null;
      setDragging(false);
      setDragOffset(0);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Edge handles: trim (inward, restore out to source bounds) ───────────────
  const handleTrimDown = (edge: 'start' | 'end') => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    setTrim({ edge, dx: 0 });
    const onMove = (ev: MouseEvent) => setTrim({ edge, dx: ev.clientX - startX });
    const onUp = (ev: MouseEvent) => {
      const dxSec = (ev.clientX - startX) / pxPerSecond;
      if (edge === 'start') {
        onTrimStart(clip.id, snap(clip.startSeconds + dxSec));
      } else {
        onTrimEnd(clip.id, snap(clip.startSeconds + clip.durationSeconds + dxSec) - clip.startSeconds);
      }
      setTrim(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Preview geometry (move + trim) ─────────────────────────────────────────
  let dispStart = clip.startSeconds;
  let dispDur = clip.durationSeconds;
  let dispOffset = clip.offsetSeconds;
  if (dragging) {
    dispStart = clip.startSeconds + dragOffset;
  } else if (trim) {
    const dxSec = trim.dx / pxPerSecond;
    if (trim.edge === 'start') {
      const d = Math.max(-clip.offsetSeconds, Math.min(clip.durationSeconds - MIN_CLIP, dxSec));
      dispStart = clip.startSeconds + d;
      dispDur = clip.durationSeconds - d;
      dispOffset = clip.offsetSeconds + d;
    } else {
      dispDur = Math.max(MIN_CLIP, Math.min(clip.sourceDurationSeconds - clip.offsetSeconds, clip.durationSeconds + dxSec));
    }
  }

  const widthPx = Math.max(dispDur * pxPerSecond - 2, 8);
  const heightPx = TRACK_HEIGHT - 10;
  const active = dragging || trim !== null;

  return (
    <div
      onMouseDown={handleBodyDown}
      onContextMenu={e => { e.preventDefault(); onDeleteClip(clip.id); }}
      className={`absolute top-1 select-none overflow-hidden rounded ${
        active ? 'z-10 opacity-90 shadow-lg' : 'hover:brightness-110'
      } ${toolMode === 'slice' ? 'cursor-crosshair' : dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ left: Math.max(0, dispStart) * pxPerSecond, width: widthPx, height: heightPx, backgroundColor: clip.color }}
      title={toolMode === 'slice'
        ? `${clip.label} — click to split`
        : `${clip.label} — drag to move, edges to trim, right-click to delete`}
    >
      <ClipWaveform
        audioUrl={clip.audioUrl}
        offsetSeconds={dispOffset}
        durationSeconds={dispDur}
        sourceDurationSeconds={clip.sourceDurationSeconds}
        width={widthPx}
        height={heightPx}
      />
      <span className="pointer-events-none relative z-10 block truncate px-2 pt-0.5 text-[10px] font-medium text-navy-950">
        {clip.label}
      </span>

      {/* Trim handles */}
      <div
        onMouseDown={handleTrimDown('start')}
        className="absolute inset-y-0 left-0 z-20 cursor-ew-resize bg-navy-950/30 opacity-0 hover:opacity-100"
        style={{ width: TRIM_HANDLE_PX }}
        title="Trim start"
      />
      <div
        onMouseDown={handleTrimDown('end')}
        className="absolute inset-y-0 right-0 z-20 cursor-ew-resize bg-navy-950/30 opacity-0 hover:opacity-100"
        style={{ width: TRIM_HANDLE_PX }}
        title="Trim end"
      />
    </div>
  );
}

interface TrackRowProps {
  track: DAWTrack;
  inserts: MixerInsert[];
  pxPerSecond: number;
  secondsPerBeat: number;
  totalWidth: number;
  pxPerBeat: number;
  toolMode: DAWToolMode;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onSetTrackInsert: (id: string, insertId: string) => void;
  onRemoveTrack: (id: string) => void;
  onMoveClip: (clipId: string, newStart: number) => void;
  onDeleteClip: (clipId: string) => void;
  onTrimStart: (clipId: string, newStart: number) => void;
  onTrimEnd: (clipId: string, newDuration: number) => void;
  onSplit: (clipId: string, atSeconds: number) => void;
  onDragOverLane: (e: React.DragEvent) => void;
  onDropOnLane: (e: React.DragEvent, trackId: string) => void;
}

function TrackRow({
  track, inserts, pxPerSecond, secondsPerBeat, totalWidth, pxPerBeat, toolMode,
  onToggleMute, onToggleSolo, onToggleCollapse, onSetTrackInsert, onRemoveTrack,
  onMoveClip, onDeleteClip, onTrimStart, onTrimEnd, onSplit, onDragOverLane, onDropOnLane,
}: TrackRowProps) {
  const rowHeight = track.collapsed ? COLLAPSED_HEIGHT : TRACK_HEIGHT;

  return (
    <div className="flex border-b border-navy-800/60" style={{ height: rowHeight }}>
      {/* Header — sticky left */}
      <div
        className="sticky left-0 z-10 flex flex-shrink-0 flex-col justify-center gap-1 border-r border-navy-800 bg-navy-900 px-2"
        style={{ width: HEADER_WIDTH }}
      >
        {/* Row 1: collapse, dot, name, remove */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onToggleCollapse(track.id)}
            className="flex-shrink-0 text-cream-500 hover:text-cream-200"
            title={track.collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`h-3 w-3 transition-transform ${track.collapsed ? '-rotate-90' : ''}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: track.color }} />
          <span className="flex-1 truncate text-[11px] text-cream-200" title={track.name}>{track.name}</span>
          <button
            onClick={() => onRemoveTrack(track.id)}
            className="flex-shrink-0 text-cream-600 hover:text-red-400"
            title="Remove track"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Row 2: mute, solo, insert routing */}
        {!track.collapsed && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleMute(track.id)}
              className={`flex-shrink-0 rounded px-1 text-[9px] font-bold transition-colors ${
                track.muted ? 'bg-red-700/80 text-cream-100' : 'text-cream-500 hover:text-cream-200'
              }`}
              title="Mute"
            >M</button>
            <button
              onClick={() => onToggleSolo(track.id)}
              className={`flex-shrink-0 rounded px-1 text-[9px] font-bold transition-colors ${
                track.solo ? 'bg-[#ffcc18] text-navy-950' : 'text-cream-500 hover:text-cream-200'
              }`}
              title="Solo"
            >S</button>
            <select
              value={track.insertId}
              onChange={e => onSetTrackInsert(track.id, e.target.value)}
              title="Route to mixer insert"
              className="ml-auto max-w-[96px] rounded border border-navy-700 bg-navy-950 px-1 py-0.5 text-[9px] text-cream-300 focus:border-[#ffcc18] focus:outline-none"
            >
              {inserts.map(ins => (
                <option key={ins.id} value={ins.id}>{ins.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Clip lane */}
      {!track.collapsed && (
        <div
          className="relative flex-1"
          style={{ width: totalWidth, minWidth: totalWidth, backgroundImage: gridBackground(pxPerBeat) }}
          onDragOver={onDragOverLane}
          onDrop={e => onDropOnLane(e, track.id)}
        >
          {track.clips.map(clip => (
            <Clip
              key={clip.id}
              clip={clip}
              pxPerSecond={pxPerSecond}
              secondsPerBeat={secondsPerBeat}
              toolMode={toolMode}
              onMoveClip={onMoveClip}
              onDeleteClip={onDeleteClip}
              onTrimStart={onTrimStart}
              onTrimEnd={onTrimEnd}
              onSplit={onSplit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Arrangement({
  project, currentTime, pxPerSecond, toolMode,
  onSeek, onMoveClip, onDeleteClip, onTrimClipStart, onTrimClipEnd, onSplitClip,
  onToggleMute, onToggleSolo, onToggleCollapse, onSetVolume, onSetTrackInsert,
  onRemoveTrack, onDropItem,
}: ArrangementProps) {
  void onSetVolume; // reserved for future inline track fader
  const totalWidth = project.totalDurationSeconds * pxPerSecond;
  const secondsPerBeat = 60 / project.bpm;
  const secondsPerBar = secondsPerBeat * 4;
  const pxPerBeat = secondsPerBeat * pxPerSecond;
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDropOnTrack = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/daw-item');
    if (!raw) return;
    try {
      const item = JSON.parse(raw) as DAWLibraryItem;
      const laneRect = e.currentTarget.getBoundingClientRect();
      const rawStart = Math.max(0, (e.clientX - laneRect.left) / pxPerSecond);
      const snapped = Math.round(rawStart / secondsPerBeat) * secondsPerBeat;
      onDropItem(item, trackId, snapped);
    } catch { /* ignore */ }
  }, [pxPerSecond, secondsPerBeat, onDropItem]);

  const playheadLeft = currentTime * pxPerSecond + HEADER_WIDTH;

  return (
    <div className="relative flex-1 overflow-auto" ref={scrollRef}>
      {/* Ruler row */}
      <div className="sticky top-0 z-20 flex border-b border-navy-800 bg-navy-900">
        <div
          className="sticky left-0 z-30 flex flex-shrink-0 items-center justify-center border-r border-navy-800 bg-navy-900"
          style={{ width: HEADER_WIDTH, height: RULER_HEIGHT }}
        >
          <span className="text-[9px] uppercase tracking-widest text-cream-500">Bars</span>
        </div>
        <Ruler
          totalDuration={project.totalDurationSeconds}
          pxPerSecond={pxPerSecond}
          secondsPerBar={secondsPerBar}
          pxPerBeat={pxPerBeat}
          onSeek={(t) => onSeek(Math.min(t, project.totalDurationSeconds))}
        />
      </div>

      {/* Track rows */}
      <div className="relative">
        {project.tracks.map(track => (
          <TrackRow
            key={track.id}
            track={track}
            inserts={project.inserts}
            pxPerSecond={pxPerSecond}
            secondsPerBeat={secondsPerBeat}
            totalWidth={totalWidth}
            pxPerBeat={pxPerBeat}
            toolMode={toolMode}
            onToggleMute={onToggleMute}
            onToggleSolo={onToggleSolo}
            onToggleCollapse={onToggleCollapse}
            onSetTrackInsert={onSetTrackInsert}
            onRemoveTrack={onRemoveTrack}
            onMoveClip={onMoveClip}
            onDeleteClip={onDeleteClip}
            onTrimStart={onTrimClipStart}
            onTrimEnd={onTrimClipEnd}
            onSplit={onSplitClip}
            onDragOverLane={handleDragOver}
            onDropOnLane={handleDropOnTrack}
          />
        ))}

        {project.tracks.length === 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-cream-500">
            Drag audio from the library or click + to add tracks
          </div>
        )}
      </div>

      {/* Playhead */}
      <div className="pointer-events-none absolute top-0 z-20 w-px bg-[#ffcc18]" style={{ left: playheadLeft, height: '100%' }} />
    </div>
  );
}
