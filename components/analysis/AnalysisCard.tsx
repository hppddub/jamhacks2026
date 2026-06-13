import { cn } from '@/lib/utils';
import { TimelineBar } from './TimelineBar';
import type { AnalysisResult } from '@/types';

interface AnalysisCardProps {
  result: AnalysisResult;
}

const MOOD_BADGE: Record<string, string> = {
  inspirational: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  emotional:     'bg-violet-500/10 text-violet-400 border-violet-500/20',
  dramatic:      'bg-red-500/10 text-red-400 border-red-500/20',
  energetic:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  suspenseful:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
  corporate:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  happy:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  calm:          'bg-green-500/10 text-green-400 border-green-500/20',
};

const ENERGY_BADGE: Record<string, string> = {
  low:    'bg-green-500/10 text-green-400 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  high:   'bg-red-500/10 text-red-400 border-red-500/20',
};

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
        className
      )}
    >
      {label}
    </span>
  );
}

export function AnalysisCard({ result }: AnalysisCardProps) {
  const analysis = result.analysis;
  const motionPct = Math.round(analysis.motionScore * 100);

  return (
    <div className="animate-fade-in space-y-5 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Analysis Complete
          </p>
          <h3 className="text-lg font-semibold text-zinc-100">Video Profile</h3>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums text-amber-500">{analysis.bpm}</p>
          <p className="mt-0.5 text-xs text-zinc-500">BPM</p>
        </div>
      </div>

      {/* Attribute badges */}
      <div className="flex flex-wrap gap-2">
        <Badge
          label={analysis.mood}
          className={MOOD_BADGE[analysis.mood] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700'}
        />
        <Badge
          label={`${analysis.energyLevel} energy`}
          className={ENERGY_BADGE[analysis.energyLevel]}
        />
        <Badge
          label={`${analysis.pace} pace`}
          className="border-blue-500/20 bg-blue-500/10 text-blue-400"
        />
        <Badge
          label={analysis.genre}
          className="border-zinc-700 bg-zinc-800 text-zinc-300"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-800/50 px-4 py-3">
          <p className="mb-1 text-xs text-zinc-500">Est. Scene Cuts</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{analysis.sceneCount}</p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 px-4 py-3">
          <p className="mb-2 text-xs text-zinc-500">Motion Score</p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-zinc-700">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${motionPct}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs font-medium tabular-nums text-zinc-300">
              {motionPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Instrument suggestions */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Suggested Instruments
        </p>
        <div className="flex flex-wrap gap-1.5">
          {analysis.instrumentSuggestions.map((instr) => (
            <span
              key={instr}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
            >
              {instr}
            </span>
          ))}
        </div>
      </div>

      {/* Summary */}
      <p className="border-t border-zinc-800 pt-4 text-sm italic leading-relaxed text-zinc-400">
        {analysis.analysisSummary}
      </p>

      {/* Timeline arc */}
      <div className="border-t border-zinc-800 pt-4">
        <TimelineBar segments={analysis.timeline} />
      </div>
    </div>
  );
}
