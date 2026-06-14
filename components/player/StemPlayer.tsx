'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/lib/utils';
import type { Stem, StemId, StemResult } from '@/types';

interface StemPlayerProps {
  result: StemResult;
}

const STEM_STYLE: Record<StemId, { color: string; label: string; waveParams: [number, number, number] }> = {
  drums:  { color: '#ee4444', label: 'Drums & Percussion', waveParams: [0.7, 1.9, 2.1] },
  bass:   { color: '#6EA556', label: 'Bass',               waveParams: [0.3, 0.6, 0.5] },
  melody: { color: '#FFCC18', label: 'Melody & Harmony',   waveParams: [0.9, 0.4, 1.4] },
  vocals: { color: '#7CA0CB', label: 'Vocals',             waveParams: [0.5, 1.1, 0.8] },
};

function StemRow({ stem }: { stem: Stem }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const style = STEM_STYLE[stem.id] ?? { color: '#ffcc18', label: stem.label, waveParams: [0.9, 0.4, 1.4] as [number, number, number] };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => { setDuration(audio.duration); setIsLoaded(true); };
    const onEnd  = () => { setIsPlaying(false); setCurrentTime(0); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, [stem.audioUrl]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !isLoaded) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try { await audio.play(); setIsPlaying(true); } catch { setIsPlaying(false); }
    }
  }, [isPlaying, isLoaded]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !isLoaded) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const [p0, p1, p2] = style.waveParams;
  const waveHeights = Array.from({ length: 20 }, (_, i) =>
    Math.max(3, Math.min(28, 14 + Math.sin(i * p0) * 8 + Math.cos(i * p1) * 5 + Math.abs(Math.sin(i * p2)) * 4))
  );

  return (
    <div className="rounded-lg border border-navy-800 bg-navy-950/40 p-4">
      <audio ref={audioRef} src={stem.audioUrl} preload="metadata" />

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: style.color }} />
          <span className="text-sm font-medium text-cream-100">{style.label}</span>
        </div>
        <span className="tabular-nums text-xs text-cream-400">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>

      {/* Mini waveform */}
      <div className="mb-3 flex h-8 items-end gap-[2px]">
        {waveHeights.map((h, i) => {
          const filled = progress > 0 && (i / waveHeights.length) * 100 < progress;
          return (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors duration-100"
              // Fixed precision so SSR/client strings match (avoids a hydration
              // mismatch from Math.sin's engine-dependent trailing digits).
              style={{ height: `${h.toFixed(2)}px`, backgroundColor: filled ? style.color : '#2D4B6E' }}
            />
          );
        })}
      </div>

      {/* Seek + controls row */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!isLoaded}
          aria-label={isPlaying ? `Pause ${style.label}` : `Play ${style.label}`}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: style.color }}
        >
          {isPlaying ? (
            <svg className="h-3 w-3 text-navy-950" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-3 w-3 text-navy-950" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          disabled={!isLoaded}
          aria-label={`Seek ${style.label}`}
          className="flex-1 cursor-pointer appearance-none rounded-full
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5
            [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0
            disabled:cursor-not-allowed"
          style={{
            height: '3px',
            background: `linear-gradient(to right, ${style.color} ${progress}%, #2D4B6E ${progress}%)`,
          }}
        />

        <a
          href={stem.audioUrl}
          download={stem.audioUrl.split('/').pop()}
          className="flex-shrink-0 rounded-md border border-navy-700 bg-navy-800 px-2.5 py-1 text-xs text-cream-200 transition-colors hover:bg-navy-700"
        >
          ↓
        </a>
      </div>
    </div>
  );
}

export function StemPlayer({ result }: StemPlayerProps) {
  return (
    <div className="panel-elevate animate-fade-in space-y-3 rounded-xl border border-navy-700 bg-navy-900 p-6">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-cream-300">Audio Stems</p>
        <p className="text-xs text-cream-500">
          {result.stems.length} stem{result.stems.length !== 1 ? 's' : ''}
        </p>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-cream-400">
        Vocals may be near-silent — this score is instrumental. The melody content sits in the Melody &amp; Harmony stem.
      </p>
      <div className="space-y-2">
        {result.stems.map((stem) => (
          <StemRow key={stem.id} stem={stem} />
        ))}
      </div>
    </div>
  );
}
