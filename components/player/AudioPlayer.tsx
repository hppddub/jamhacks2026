'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { formatDuration } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  /** Header label; defaults to "Generated Score" for the existing score-player usage. */
  label?: string;
  videoRef?: RefObject<HTMLVideoElement | null>;
  /** Score tempo — drives the beat-synced pulse on the indicator while playing. */
  bpm?: number;
}

export function AudioPlayer({ src, label = 'Generated Score', videoRef, bpm }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);

  const BAR_COUNT = 56;

  // Decode the audio file once per src to draw a real amplitude waveform.
  // Best-effort: on any failure we fall back to the decorative pattern below.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setPeaks(null);
      try {
        const res = await fetch(src, { signal: controller.signal });
        const buf = await res.arrayBuffer();
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const audioBuffer = await ctx.decodeAudioData(buf);
        ctx.close().catch(() => {});
        if (cancelled) return;

        const data = audioBuffer.getChannelData(0);
        const block = Math.floor(data.length / BAR_COUNT) || 1;
        const raw: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let peak = 0;
          const start = i * block;
          for (let j = 0; j < block; j++) {
            const v = Math.abs(data[start + j] ?? 0);
            if (v > peak) peak = v;
          }
          raw.push(peak);
        }
        const max = Math.max(...raw, 0.0001);
        setPeaks(raw.map((v) => v / max));
      } catch {
        // ignore — decorative fallback is used
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset all state for the incoming source before attaching listeners
    audio.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoaded(false);

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => { setDuration(audio.duration); setIsLoaded(true); };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      const video = videoRef?.current;
      if (video) { video.pause(); video.currentTime = 0; }
    };
    const onError = () => { setIsLoaded(false); setDuration(0); };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // Race condition guard: if the browser already loaded metadata before this
    // effect ran (possible with local/cached files), fire the handler immediately.
    if (audio.readyState >= 1) {
      onLoadedMetadata();
    } else {
      // Explicitly trigger a load so the browser starts fetching the new src.
      // React updates the src attribute before effects run, but some browsers
      // need an explicit load() call to begin the fetch.
      audio.load();
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [src, videoRef]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    const video = videoRef?.current ?? null;
    if (!audio || !isLoaded) return;
    if (isPlaying) {
      audio.pause();
      video?.pause();
      setIsPlaying(false);
    } else {
      try {
        if (video) {
          // eslint-disable-next-line react-hooks/immutability
          video.currentTime = audio.currentTime;
          video.play().catch(() => {});
        }
        await audio.play();
        setIsPlaying(true);
      } catch {
        video?.pause();
        setIsPlaying(false);
      }
    }
  }, [isPlaying, isLoaded, videoRef]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const video = videoRef?.current ?? null;
    if (!audio || !isLoaded) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    if (video) {
      // eslint-disable-next-line react-hooks/immutability
      video.currentTime = t;
    }
    setCurrentTime(t);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Real waveform from decoded peaks; falls back to a decorative pattern until
  // (or unless) decoding succeeds.
  const waveHeights = peaks
    ? peaks.map((p) => Math.max(4, Math.min(44, 4 + p * 40)))
    : Array.from({ length: BAR_COUNT }, (_, i) =>
        Math.max(4, Math.min(44, 20 + Math.sin(i * 0.9) * 14 + Math.cos(i * 0.4) * 9 + Math.abs(Math.sin(i * 1.4)) * 7))
      );

  return (
    <div className="panel-elevate animate-fade-in space-y-4 rounded-xl border border-navy-700 bg-navy-900 p-6">
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-2 animate-pulse rounded-full bg-[#ffcc18]"
          style={isPlaying && bpm ? { animationDuration: `${60 / bpm}s` } : undefined}
        />
        <p className="text-sm font-medium text-cream-100">{label}</p>
        {!isLoaded && (
          <span className="ml-auto text-xs text-cream-400">Loading audio…</span>
        )}
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Waveform (real peaks when decoded, decorative fallback otherwise) */}
      <div className="flex h-12 items-center justify-center gap-[2px] px-2">
        {waveHeights.map((h, i) => {
          const filled = progress > 0 && (i / waveHeights.length) * 100 < progress;
          return (
            <div
              key={i}
              className={`min-w-[2px] flex-1 rounded-full transition-colors duration-150 ${
                filled ? 'bg-[#ffcc18]' : 'bg-navy-700'
              }`}
              // Fixed precision so the SSR and client strings match exactly —
              // Math.sin's trailing digits can differ across JS engines and
              // would otherwise trigger a hydration mismatch on these heights.
              style={{ height: `${h.toFixed(2)}px` }}
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
          [&::-webkit-slider-thumb]:bg-[#ffcc18] [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#ffcc18]
          [&::-moz-range-thumb]:border-0 disabled:cursor-not-allowed"
        style={{
          height: '4px',
          background: `linear-gradient(to right, #ffcc18 ${progress}%, #2D4B6E ${progress}%)`,
        }}
      />

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          disabled={!isLoaded}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#ffcc18] text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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

        <span className="tabular-nums text-sm text-cream-200">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}
