'use client';

import type { TimelineSegment } from '@/types';

interface SegmentDetailPanelProps {
  segment: TimelineSegment;
  index: number;
}

const ENERGY_BADGE: Record<string, string> = {
  low: 'border-[#6EA556]/30 bg-[#6EA556]/10 text-leaf',
  medium: 'border-[#ffcc18]/30 bg-[#ffcc18]/10 text-gold dark:text-gold',
  high: 'border-[#ee4444]/30 bg-[#ee4444]/10 text-[#ee4444]',
};

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium capitalize ${
        className ?? 'border-navy-700 bg-navy-800 text-cream-100'
      }`}
    >
      {label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-cream-400">{label}</p>
      <p className="text-sm italic leading-relaxed text-cream-200">{value}</p>
    </div>
  );
}

export function SegmentDetailPanel({ segment, index }: SegmentDetailPanelProps) {
  const start = Math.round(segment.startSeconds);
  const end = Math.round(segment.endSeconds);

  return (
    <div className="animate-fade-in mt-4 space-y-4 rounded-xl border border-navy-700 bg-navy-800/40 p-5">
      <div className="flex items-start justify-between gap-3 border-b border-navy-700/60 pb-3">
        <div>
          <p className="text-sm font-semibold text-cream-50">{segment.label}</p>
          <p className="text-xs text-cream-400">
            Section {index + 1} · {start}s – {end}s
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge label={segment.mood} className="border-[#7CA0CB]/30 bg-[#7CA0CB]/10 text-slate" />
        <Badge label={`${segment.energyLevel} energy`} className={ENERGY_BADGE[segment.energyLevel]} />
        {segment.narrativeRole && <Badge label={segment.narrativeRole} />}
      </div>

      <div className="space-y-3">
        {segment.musicalDescription && (
          <Field label="Musical direction" value={segment.musicalDescription} />
        )}
        {segment.audioNote && <Field label="Audio in this section" value={segment.audioNote} />}
        {segment.transitionToNext && (
          <Field label="Transition to next" value={segment.transitionToNext} />
        )}
        {!segment.musicalDescription && !segment.audioNote && !segment.transitionToNext && (
          <p className="text-sm italic leading-relaxed text-cream-400">
            A {segment.energyLevel}-energy {segment.mood} moment in the video&apos;s arc.
          </p>
        )}
      </div>
    </div>
  );
}
