import { cn } from '@/lib/utils';
import type { TimelineSegment } from '@/types';

interface TimelineBarProps {
  segments: TimelineSegment[];
}

const ENERGY_BG: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

const ENERGY_TEXT: Record<string, string> = {
  low: 'text-green-950',
  medium: 'text-yellow-950',
  high: 'text-red-950',
};

export function TimelineBar({ segments }: TimelineBarProps) {
  if (segments.length === 0) return null;

  const totalDuration = segments[segments.length - 1].endSeconds;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Video Arc</p>

      <div className="flex h-9 w-full overflow-hidden rounded-lg">
        {segments.map((seg, i) => {
          const widthPct = ((seg.endSeconds - seg.startSeconds) / totalDuration) * 100;
          return (
            <div
              key={i}
              className={cn(
                'relative flex items-center justify-center overflow-hidden transition-opacity hover:opacity-80',
                ENERGY_BG[seg.energyLevel],
                i === 0 && 'rounded-l-lg',
                i === segments.length - 1 && 'rounded-r-lg'
              )}
              style={{ width: `${widthPct}%` }}
              title={`${seg.label} (${seg.startSeconds}s – ${seg.endSeconds}s)`}
            >
              {widthPct > 16 && (
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

      <div className="flex justify-between text-xs text-zinc-600">
        <span>0s</span>
        <span>{totalDuration}s</span>
      </div>
    </div>
  );
}
