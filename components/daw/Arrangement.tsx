'use client';

import { useCallback, useRef, useState } from 'react';
import type { DAWClip, DAWLibraryItem, DAWProject, DAWTrack, MixerInsert } from '@/types/daw';

const TRACK_HEIGHT = 60;
const COLLAPSED_HEIGHT = 28;
const RULER_HEIGHT = 30;
const HEADER_WIDTH = 200;

interface ArrangementProps {
  project: DAWProject;
  currentTime: number;
  pxPerSecond: number;
  onSeek: (t: number) => void;
  onMoveClip: (clipId: string, newStart: number) => void;
  onDeleteClip: (clipId: string) => void;
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

interface ClipProps {
  clip: DAWClip;
  pxPerSecond: number;
  secondsPerBeat: number;
  onMoveClip: (clipId: string, newStart: number) => void;
  onDeleteClip: (clipId: string) => void;
}

function Clip({ clip, pxPerSecond, secondsPerBeat, onMoveClip, onDeleteClip }: ClipProps) {
  const dragRef = useRef<{ startX: number; startSeconds: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startSeconds: clip.startSeconds };
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setDragOffset((ev.clientX - dragRef.current.startX) / pxPerSecond);
    };
    const onUp = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const raw = dragRef.current.startSeconds + (ev.clientX - dragRef.current.startX) / pxPerSecond;
      // Snap to nearest beat
      const snapped = Math.max(0, Math.round(raw / secondsPerBeat) * secondsPerBeat);
      onMoveClip(clip.id, snapped);
      dragRef.current = null;
      setDragging(false);
      setDragOffset(0);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const displayStart = clip.startSeconds + (dragging ? dragOffset : 0);

  return (
    <div
      onMouseDown={handleMouseDown}
      onContextMenu={e => { e.preventDefault(); onDeleteClip(clip.id); }}
      className={`absolute top-1 flex select-none items-center overflow-hidden rounded px-2 ${
        dragging ? 'z-10 cursor-grabbing opacity-90 shadow-lg' : 'cursor-grab hover:brightness-110'
      }`}
      style={{
        left: Math.max(0, displayStart) * pxPerSecond,
        width: Math.max(clip.durationSeconds * pxPerSecond - 2, 20),
        height: TRACK_HEIGHT - 10,
        backgroundColor: clip.color,
      }}
      title={`${clip.label} — drag to move, right-click to delete`}
    >
      <span className="truncate text-[10px] font-medium text-navy-950">{clip.label}</span>
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
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onSetTrackInsert: (id: string, insertId: string) => void;
  onRemoveTrack: (id: string) => void;
  onMoveClip: (clipId: string, newStart: number) => void;
  onDeleteClip: (clipId: string) => void;
  onDragOverLane: (e: React.DragEvent) => void;
  onDropOnLane: (e: React.DragEvent, trackId: string) => void;
}

function TrackRow({
  track, inserts, pxPerSecond, secondsPerBeat, totalWidth, pxPerBeat,
  onToggleMute, onToggleSolo, onToggleCollapse, onSetTrackInsert, onRemoveTrack,
  onMoveClip, onDeleteClip, onDragOverLane, onDropOnLane,
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
              onMoveClip={onMoveClip}
              onDeleteClip={onDeleteClip}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Arrangement({
  project, currentTime, pxPerSecond,
  onSeek, onMoveClip, onDeleteClip,
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
            onToggleMute={onToggleMute}
            onToggleSolo={onToggleSolo}
            onToggleCollapse={onToggleCollapse}
            onSetTrackInsert={onSetTrackInsert}
            onRemoveTrack={onRemoveTrack}
            onMoveClip={onMoveClip}
            onDeleteClip={onDeleteClip}
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
