'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TimelineSegment } from '@/types';

interface TimelineBarProps {
  segments: TimelineSegment[];
  selectedIndex?: number;
  onSegmentClick?: (index: number) => void;
}

const ENERGY_BG: Record<string, string> = {
  low: 'bg-[#6EA556]',
  medium: 'bg-[#fdf3ab]',
  high: 'bg-[#FFCC18]',
};

const ENERGY_TEXT: Record<string, string> = {
  low: 'text-[#1D2F45]',
  medium: 'text-[#1D2F45]',
  high: 'text-[#1D2F45]',
};

export function TimelineBar({ segments, selectedIndex, onSegmentClick }: TimelineBarProps) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  // Trigger the grow-in animation on the next frame after mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (segments.length === 0) return null;

  const totalDuration = segments[segments.length - 1].endSeconds;
  const pct = (s: number) => (s / totalDuration) * 100;
  const active = hovered ?? selectedIndex ?? null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-cream-300">Video Arc</p>
        {onSegmentClick && (
          <p className="text-xs text-cream-400">Click a section for a detailed analysis</p>
        )}
      </div>

      {/* Bar + floating tooltip */}
      <div className="relative">
        {active !== null && segments[active] && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full"
            style={{ left: `${pct((segments[active].startSeconds + segments[active].endSeconds) / 2)}%` }}
          >
            <div className="whitespace-nowrap rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-1.5 text-center shadow-lg">
              <p className="text-xs font-semibold capitalize text-cream-50">{segments[active].mood}</p>
              <p className="text-[10px] capitalize text-cream-400">
                {segments[active].energyLevel} energy · {Math.round(segments[active].startSeconds)}s–{Math.round(segments[active].endSeconds)}s
              </p>
            </div>
            <div className="mx-auto h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-navy-700 bg-navy-900" />
          </div>
        )}

        <div className="flex h-9 w-full overflow-hidden rounded-lg">
          {segments.map((seg, i) => {
            const widthPct = pct(seg.endSeconds - seg.startSeconds);
            const isSelected = selectedIndex === i;
            const isClickable = !!onSegmentClick;
            return (
              <div
                key={i}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={() => isClickable && onSegmentClick(i)}
                onKeyDown={e => isClickable && (e.key === 'Enter' || e.key === ' ') && onSegmentClick(i)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered((h) => (h === i ? null : h))}
                className={cn(
                  'relative flex items-center justify-center overflow-hidden transition-all',
                  ENERGY_BG[seg.energyLevel],
                  i === 0 && 'rounded-l-lg',
                  i === segments.length - 1 && 'rounded-r-lg',
                  i !== segments.length - 1 && 'border-r-2 border-[#E4D3B2] dark:border-[#1D2F45]',
                  isClickable ? 'cursor-pointer hover:opacity-80' : 'hover:opacity-80',
                  isSelected && 'ring-2 ring-inset ring-white/70',
                )}
                style={{
                  width: `${widthPct}%`,
                  transform: mounted ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: `transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.07}s, opacity 0.2s ease`,
                }}
                title={`${seg.label} (${Math.round(seg.startSeconds)}s – ${Math.round(seg.endSeconds)}s)`}
              >
                {widthPct > 8 && (
                  <span
                    className={cn(
                      'truncate px-1.5 text-[10px] font-semibold',
                      ENERGY_TEXT[seg.energyLevel]
                    )}
                  >
                    {seg.mood}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Time axis with a tick at every segment boundary */}
      <div className="relative h-4">
        {segments.map((seg, i) => {
          // Hide intermediate labels that would crowd a very narrow segment.
          const left = pct(seg.startSeconds);
          if (i !== 0 && pct(seg.endSeconds - seg.startSeconds) < 9) return null;
          return (
            <div
              key={i}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${left}%` }}
            >
              <span className="h-1 w-px bg-navy-600" />
              <span className="mt-0.5 -translate-x-1/2 text-[10px] tabular-nums text-cream-400">
                {Math.round(seg.startSeconds)}s
              </span>
            </div>
          );
        })}
        <div className="absolute top-0 right-0 flex flex-col items-end">
          <span className="h-1 w-px bg-navy-600" />
          <span className="mt-0.5 text-[10px] tabular-nums text-cream-400">{Math.round(totalDuration)}s</span>
        </div>
      </div>
    </div>
  );
}
