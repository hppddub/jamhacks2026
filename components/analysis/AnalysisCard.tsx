'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TimelineBar } from './TimelineBar';
import { MicroScorePanel } from './MicroScorePanel';
import { SegmentDetailPanel } from './SegmentDetailPanel';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { AnalysisResult } from '@/types';

interface AnalysisCardProps {
  result: AnalysisResult;
}

/** Animates a number from 0 → target on mount (respects reduced-motion). */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (reduce) { setValue(target); return; }
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const MOOD_BADGE: Record<string, string> = {
  inspirational: 'bg-[#7CA0CB]/10 text-slate border-[#7CA0CB]/20',
  emotional:     'bg-[#6EA556]/10 text-leaf border-[#6EA556]/20',
  dramatic:      'bg-[#B28B52]/10 text-bronze border-[#B28B52]/20 dark:bg-[#fdf3ab]/10 dark:text-[#fdf3ab] dark:border-[#fdf3ab]/20',
  energetic:     'bg-[#ffcc18]/10 text-gold border-[#ffcc18]/20',
  suspenseful:   'bg-[#6EA556]/10 text-leaf border-[#6EA556]/20',
  corporate:     'bg-[#7CA0CB]/10 text-slate border-[#7CA0CB]/20',
  happy:         'bg-[#B28B52]/10 text-bronze border-[#B28B52]/20 dark:bg-[#ffcc18]/10 dark:text-gold dark:border-[#ffcc18]/20',
  calm:          'bg-[#6EA556]/10 text-leaf border-[#6EA556]/20',
};

const ENERGY_BADGE: Record<string, string> = {
  low:    'bg-[#6EA556]/10 text-leaf border-[#6EA556]/20',
  medium: 'bg-[#B28B52]/10 text-bronze border-[#B28B52]/20 dark:bg-[#ffcc18]/10 dark:text-gold dark:border-[#ffcc18]/20',
  high:   'bg-[#B28B52]/10 text-bronze border-[#B28B52]/20 dark:bg-[#fdf3ab]/10 dark:text-[#fdf3ab] dark:border-[#fdf3ab]/20',
};

const AUDIO_TYPE_BADGE: Record<string, string> = {
  dialogue:         'bg-[#4A3220]/10 text-[#4A3220] border-[#4A3220]/20',
  sound_effects:    'bg-[#C39C0F]/10 text-[#C39C0F] border-[#C39C0F]/20',
  background_music: 'bg-[#7CA0CB]/10 text-slate border-[#7CA0CB]/20',
  ambient:          'bg-[#6EA556]/10 text-leaf border-[#6EA556]/20',
  silence:          'bg-[#1D2F45]/50 text-cream-300 border-[#1D2F45]',
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
  const bpmDisplay = useCountUp(analysis.bpm);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);

  const handleSegmentClick = (i: number) => {
    setSelectedSegment(prev => (prev === i ? null : i));
  };

  return (
    <div className="panel-elevate animate-fade-in space-y-5 rounded-xl border border-navy-700 bg-navy-900 p-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-cream-300">
            Analysis Complete
          </p>
          <h3 className="text-lg font-semibold text-cream-50">Video Profile</h3>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums text-gold">{bpmDisplay}</p>
          <p className="mt-0.5 text-xs text-cream-300">
            BPM
            <InfoTooltip label="Beats per minute — the suggested tempo of the score, derived from the video's energy and pacing." />
          </p>
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
          className="border-[#7CA0CB]/20 bg-[#7CA0CB]/10 text-slate"
        />
        <Badge
          label={analysis.genre}
          className="border-navy-700 bg-navy-800 text-cream-100"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-navy-800/50 px-4 py-3">
          <p className="mb-1 text-xs text-cream-300">
            Est. Scene Cuts
            <InfoTooltip label="Approximate number of distinct shots or cuts detected across the video." />
          </p>
          <p className="text-xl font-semibold tabular-nums text-cream-50">{analysis.sceneCount}</p>
        </div>
        <div className="rounded-lg bg-navy-800/50 px-4 py-3">
          <p className="mb-2 text-xs text-cream-300">
            Motion Score
            <InfoTooltip label="How much visual movement and camera activity is in the video, from calm (0%) to highly dynamic (100%)." />
          </p>
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
          <div className="mb-2 flex flex-wrap gap-1.5">
            {analysis.audioContentTypes?.map((type) => (
              <Badge
                key={type}
                label={type.replace('_', ' ')}
                className={AUDIO_TYPE_BADGE[type] ?? 'border-navy-700 bg-navy-800 text-cream-100'}
              />
            ))}
            {analysis.soundTexture && (
              <Badge
                label={`${analysis.soundTexture} texture`}
                className="border-[#C39C0F]/20 bg-[#C39C0F]/10 text-[#C39C0F]"
              />
            )}
            {analysis.volumeDynamics && (
              <Badge
                label={`${analysis.volumeDynamics} volume`}
                className="border-[#7CA0CB]/20 bg-[#7CA0CB]/10 text-slate"
              />
            )}
            {analysis.dialogueTone && (
              <Badge
                label={`${analysis.dialogueTone} tone`}
                className="border-[#4A3220]/20 bg-[#4A3220]/10 text-[#4A3220]"
              />
            )}
            {analysis.dialogueSentiment && (
              <Badge
                label={`${analysis.dialogueSentiment} sentiment`}
                className="border-[#6EA556]/20 bg-[#6EA556]/10 text-leaf"
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
        <TimelineBar
          segments={analysis.timeline}
          selectedIndex={selectedSegment ?? undefined}
          onSegmentClick={handleSegmentClick}
        />
      </div>

      {/* Detailed analysis panel for the selected segment — the rich micro-score
          breakdown when available, otherwise the per-segment musical/audio detail. */}
      {selectedSegment !== null && analysis.timeline[selectedSegment] && (
        analysis.timeline[selectedSegment].microScores ? (
          <MicroScorePanel
            scores={analysis.timeline[selectedSegment].microScores!}
            label={analysis.timeline[selectedSegment].label}
          />
        ) : (
          <SegmentDetailPanel
            segment={analysis.timeline[selectedSegment]}
            index={selectedSegment}
          />
        )
      )}
    </div>
  );
}
