'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/lib/utils';

interface VideoScorePlayerProps {
  videoUrl: string;
  audioSrc: string;
}

export function VideoScorePlayer({ videoUrl, audioSrc }: VideoScorePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoaded = () => { setDuration(video.duration); setIsLoaded(true); };
    const onEnded = () => {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('ended', onEnded);
    };
  }, [videoUrl, audioSrc]);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || !isLoaded) return;

    if (isPlaying) {
      video.pause();
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.currentTime = video.currentTime;
      try {
        await Promise.all([video.play(), audio.play()]);
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  }, [isPlaying, isLoaded]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || !isLoaded) return;
    const t = parseFloat(e.target.value);
    video.currentTime = t;
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="animate-fade-in overflow-hidden rounded-xl border border-navy-700 bg-navy-900">
      <video
        ref={videoRef}
        src={videoUrl}
        muted
        preload="metadata"
        className="w-full max-h-64 bg-black"
      />
      <audio ref={audioRef} src={audioSrc} preload="auto" />

      <div className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#ffcc18]" />
          <p className="text-sm font-medium text-cream-100">Score Preview</p>
          {!isLoaded && <span className="ml-auto text-xs text-cream-400">Loading…</span>}
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
          aria-label="Seek"
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
    </div>
  );
}
