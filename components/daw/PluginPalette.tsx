'use client';

import type { EffectType, MixerInsert } from '@/types/daw';
import { EFFECT_LABELS } from '@/lib/audio/dawGraph';

const EFFECT_ORDER: EffectType[] = ['eq', 'reverb', 'delay', 'compressor', 'distortion', 'filter-adsr'];

const EFFECT_DESC: Record<EffectType, string> = {
  eq: '3-band shelving/peak EQ',
  reverb: 'Convolution room reverb',
  delay: 'Feedback delay / echo',
  compressor: 'Dynamics compressor',
  distortion: 'Waveshaper drive',
  'filter-adsr': 'ADSR filter envelope (knobs)',
};

interface PluginPaletteProps {
  selectedInsert: MixerInsert | undefined;
  onAddEffect: (insertId: string, type: EffectType) => void;
  onOpenMixer: () => void;
}

export function PluginPalette({ selectedInsert, onAddEffect, onOpenMixer }: PluginPaletteProps) {
  return (
    <div className="border-b border-navy-800/60">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-cream-500">Plugins</p>
        <button onClick={onOpenMixer} className="text-[9px] text-cream-500 hover:text-[#ffcc18]" title="Open mixer">
          Mixer ↕
        </button>
      </div>

      <p className="px-4 pb-1 text-[9px] text-cream-600">
        Adds to{' '}
        <span className="text-cream-400">{selectedInsert?.name ?? 'Master'}</span>
        {' '}(select an insert in the mixer)
      </p>

      {EFFECT_ORDER.map(type => (
        <button
          key={type}
          onClick={() => selectedInsert && onAddEffect(selectedInsert.id, type)}
          disabled={!selectedInsert}
          className="group flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-navy-900 disabled:opacity-40"
          title={`Add ${EFFECT_LABELS[type]} to ${selectedInsert?.name ?? 'insert'}`}
        >
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-navy-800 text-[9px] font-bold text-[#ffcc18]">
            fx
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-cream-200">{EFFECT_LABELS[type]}</span>
            <span className="block truncate text-[9px] text-cream-600">{EFFECT_DESC[type]}</span>
          </span>
          <svg className="h-3.5 w-3.5 flex-shrink-0 text-cream-600 opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      ))}
    </div>
  );
}
