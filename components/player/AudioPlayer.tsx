'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => { setDuration(audio.duration); setIsLoaded(true); };
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !isLoaded) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
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

  // Decorative waveform heights (static, computed once)
  const waveHeights = Array.from({ length: 40 }, (_, i) =>
    Math.max(4, Math.min(44, 20 + Math.sin(i * 0.9) * 14 + Math.cos(i * 0.4) * 9 + Math.abs(Math.sin(i * 1.4)) * 7))
  );

  return (
    <div className="animate-fade-in space-y-4 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        <p className="text-sm font-medium text-zinc-300">Generated Score</p>
        {!isLoaded && (
          <span className="ml-auto text-xs text-zinc-600">Loading audio…</span>
        )}
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Decorative waveform */}
      <div className="flex h-12 items-end justify-center gap-[2px] px-2">
        {waveHeights.map((h, i) => {
          const filled = progress > 0 && (i / waveHeights.length) * 100 < progress;
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-colors duration-150 ${
                filled ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>

      {/* Seek bar */}
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={currentTime}
        onChange={handleSeek}
        disabled={!isLoaded}
        aria-label="Seek audio"
        className="w-full cursor-pointer appearance-none rounded-full
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-amber-500
          [&::-moz-range-thumb]:border-0 disabled:cursor-not-allowed"
        style={{
          height: '4px',
          background: `linear-gradient(to right, #f59e0b ${progress}%, #3f3f46 ${progress}%)`,
        }}
      />

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          disabled={!isLoaded}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-zinc-950 transition-all hover:bg-amber-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPlaying ? (
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

        <span className="tabular-nums text-sm text-zinc-400">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}
