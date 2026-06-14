'use client';

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
  if (segments.length === 0) return null;

  const totalDuration = segments[segments.length - 1].endSeconds;
  const hasScores = segments.some(s => s.microScores !== undefined);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-cream-300">Video Arc</p>
        {hasScores && (
          <p className="text-xs text-zinc-500">Click a segment for micro-analysis</p>
        )}
      </div>

      <div className="flex h-9 w-full overflow-hidden rounded-lg">
        {segments.map((seg, i) => {
          const widthPct = ((seg.endSeconds - seg.startSeconds) / totalDuration) * 100;
          const isSelected = selectedIndex === i;
          const isClickable = hasScores && !!onSegmentClick;
          return (
            <div
              key={i}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={() => isClickable && onSegmentClick(i)}
              onKeyDown={e => isClickable && (e.key === 'Enter' || e.key === ' ') && onSegmentClick(i)}
              className={cn(
                'relative flex items-center justify-center overflow-hidden transition-all',
                ENERGY_BG[seg.energyLevel],
                i === 0 && 'rounded-l-lg',
                i === segments.length - 1 && 'rounded-r-lg',
                i !== segments.length - 1 && 'border-r-2 border-[#E4D3B2]',
                isClickable ? 'cursor-pointer hover:opacity-80' : 'hover:opacity-80',
                isSelected && 'ring-2 ring-inset ring-white/70',
              )}
              style={{ width: `${widthPct}%` }}
              title={`${seg.label} (${seg.startSeconds}s – ${seg.endSeconds}s)`}
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

      <div className="flex justify-between text-xs text-cream-400">
        <span>0s</span>
        <span>{totalDuration}s</span>
      </div>
    </div>
  );
}
