import { cn } from '@/lib/utils';
import { TimelineBar } from './TimelineBar';
import type { AnalysisResult } from '@/types';

interface AnalysisCardProps {
  result: AnalysisResult;
}

const MOOD_BADGE: Record<string, string> = {
  inspirational: 'bg-[#7CA0CB]/10 text-[#7CA0CB] border-[#7CA0CB]/20',
  emotional:     'bg-[#6EA556]/10 text-[#6EA556] border-[#6EA556]/20',
  dramatic:      'bg-[#B28B52]/10 text-[#B28B52] border-[#B28B52]/20 dark:bg-[#fdf3ab]/10 dark:text-[#fdf3ab] dark:border-[#fdf3ab]/20',
  energetic:     'bg-[#ffcc18]/10 text-[#ffcc18] border-[#ffcc18]/20',
  suspenseful:   'bg-[#6EA556]/10 text-[#6EA556] border-[#6EA556]/20',
  corporate:     'bg-[#7CA0CB]/10 text-[#7CA0CB] border-[#7CA0CB]/20',
  happy:         'bg-[#B28B52]/10 text-[#B28B52] border-[#B28B52]/20 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20',
  calm:          'bg-green-500/10 text-green-400 border-green-500/20',
};

const ENERGY_BADGE: Record<string, string> = {
  low:    'bg-green-500/10 text-green-400 border-green-500/20',
  medium: 'bg-[#B28B52]/10 text-[#B28B52] border-[#B28B52]/20 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20',
  high:   'bg-[#B28B52]/10 text-[#B28B52] border-[#B28B52]/20 dark:bg-[#fdf3ab]/10 dark:text-[#fdf3ab] dark:border-[#fdf3ab]/20',
};

const AUDIO_TYPE_BADGE: Record<string, string> = {
  dialogue:         'bg-teal-500/10 text-teal-400 border-teal-500/20',
  sound_effects:    'bg-orange-500/10 text-orange-400 border-orange-500/20',
  background_music: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  ambient:          'bg-green-500/10 text-green-400 border-green-500/20',
  silence:          'bg-navy-800/50 text-cream-300 border-navy-700',
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
    <div className="animate-fade-in space-y-5 rounded-xl border border-navy-700 bg-navy-900 p-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-cream-300">
            Analysis Complete
          </p>
          <h3 className="text-lg font-semibold text-cream-50">Video Profile</h3>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums text-[#ffcc18]">{analysis.bpm}</p>
          <p className="mt-0.5 text-xs text-cream-300">BPM</p>
        </div>
      </div>

      {/* Attribute badges */}
      <div className="flex flex-wrap gap-2">
        <Badge
          label={analysis.mood}
          className={MOOD_BADGE[analysis.mood] ?? 'bg-navy-800 text-cream-100 border-navy-700'}
        />
        <Badge
          label={`${analysis.energyLevel} energy`}
          className={ENERGY_BADGE[analysis.energyLevel]}
        />
        <Badge
          label={`${analysis.pace} pace`}
          className="border-[#7CA0CB]/20 bg-[#7CA0CB]/10 text-[#7CA0CB]"
        />
        <Badge
          label={analysis.genre}
          className="border-navy-700 bg-navy-800 text-cream-100"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-navy-800/50 px-4 py-3">
          <p className="mb-1 text-xs text-cream-300">Est. Scene Cuts</p>
          <p className="text-xl font-semibold tabular-nums text-cream-50">{analysis.sceneCount}</p>
        </div>
        <div className="rounded-lg bg-navy-800/50 px-4 py-3">
          <p className="mb-2 text-xs text-cream-300">Motion Score</p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-navy-700">
              <div
                className="h-full rounded-full bg-[#ffcc18]"
                style={{ width: `${motionPct}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs font-medium tabular-nums text-cream-100">
              {motionPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Instrument suggestions */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-cream-300">
          Suggested Instruments
        </p>
        <div className="flex flex-wrap gap-1.5">
          {analysis.instrumentSuggestions.map((instr) => (
            <span
              key={instr}
              className="rounded-md border border-navy-700 bg-navy-800 px-2.5 py-1 text-xs text-cream-100"
            >
              {instr}
            </span>
          ))}
        </div>
      </div>

      {/* Summary */}
      <p className="border-t border-navy-800 pt-4 text-sm italic leading-relaxed text-cream-200">
        {analysis.analysisSummary}
      </p>

      {/* Audio Profile */}
      {(analysis.audioContentTypes?.length || analysis.soundTexture || analysis.volumeDynamics || analysis.audioSummary) && (
        <div className="border-t border-navy-800 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-cream-300">
            Audio Profile
          </p>
          {analysis.audioContentTypes && analysis.audioContentTypes.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {analysis.audioContentTypes.map((type) => (
                <Badge
                  key={type}
                  label={type.replace('_', ' ')}
                  className={AUDIO_TYPE_BADGE[type] ?? 'border-navy-700 bg-navy-800 text-cream-100'}
                />
              ))}
            </div>
          )}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {analysis.soundTexture && (
              <Badge
                label={`${analysis.soundTexture} texture`}
                className="border-orange-500/20 bg-orange-500/10 text-orange-400"
              />
            )}
            {analysis.volumeDynamics && (
              <Badge
                label={`${analysis.volumeDynamics} volume`}
                className="border-purple-500/20 bg-purple-500/10 text-purple-400"
              />
            )}
            {analysis.dialogueTone && (
              <Badge
                label={`${analysis.dialogueTone} tone`}
                className="border-teal-500/20 bg-teal-500/10 text-teal-400"
              />
            )}
            {analysis.dialogueSentiment && (
              <Badge
                label={`${analysis.dialogueSentiment} sentiment`}
                className="border-sky-500/20 bg-sky-500/10 text-sky-400"
              />
            )}
          </div>
          {analysis.audioSummary && (
            <p className="text-sm italic leading-relaxed text-cream-200">{analysis.audioSummary}</p>
          )}
        </div>
      )}

      {/* Timeline arc */}
      <div className="border-t border-navy-800 pt-4">
        <TimelineBar segments={analysis.timeline} />
      </div>
    </div>
  );
}
