'use client';

import type { DAWProject, Effect, EffectType, MixerInsert } from '@/types/daw';
import { EFFECT_LABELS, EFFECT_PARAM_SPECS } from '@/lib/audio/dawGraph';
import { Knob } from './Knob';

interface MixerProps {
  project: DAWProject;
  selectedInsertId: string;
  onSelectInsert: (id: string) => void;
  onSetInsertVolume: (id: string, vol: number) => void;
  onSetInsertPan: (id: string, pan: number) => void;
  onToggleInsertMute: (id: string) => void;
  onToggleInsertSolo: (id: string) => void;
  onAddInsert: () => void;
  onRemoveEffect: (insertId: string, effectId: string) => void;
  onToggleEffect: (insertId: string, effectId: string) => void;
  onUpdateEffectParam: (insertId: string, effectId: string, key: string, value: number) => void;
  onClose: () => void;
}

function trackCountForInsert(project: DAWProject, insertId: string): number {
  return project.tracks.filter(t => t.insertId === insertId).length;
}

function InsertStrip({
  insert, selected, routedCount, onSelect, onVolume, onPan, onMute, onSolo,
}: {
  insert: MixerInsert;
  selected: boolean;
  routedCount: number;
  onSelect: () => void;
  onVolume: (v: number) => void;
  onPan: (v: number) => void;
  onMute: () => void;
  onSolo: () => void;
}) {
  const isMaster = insert.id === 'master';
  return (
    <div
      onClick={onSelect}
      className={`flex h-full w-[88px] flex-shrink-0 cursor-pointer flex-col items-center gap-1.5 border-r border-navy-800 px-2 py-2 transition-colors ${
        selected ? 'bg-navy-800' : 'hover:bg-navy-900'
      } ${isMaster ? 'bg-navy-900/80' : ''}`}
    >
      <span className={`truncate text-[10px] font-semibold ${isMaster ? 'text-gold' : 'text-cream-200'}`}>
        {insert.name}
      </span>
      <span className="text-[8px] text-cream-500">{insert.effects.length} fx · {routedCount} trk</span>

      {/* Pan */}
      <input
        type="range" min={-1} max={1} step={0.01} value={insert.pan}
        onClick={e => e.stopPropagation()}
        onChange={e => onPan(parseFloat(e.target.value))}
        title={`Pan ${insert.pan === 0 ? 'center' : insert.pan < 0 ? 'L' : 'R'}`}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-navy-700 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cream-300"
      />

      {/* Vertical volume fader */}
      <div className="flex flex-1 items-center justify-center py-1">
        <input
          type="range" min={0} max={1.5} step={0.01} value={insert.volume}
          onClick={e => e.stopPropagation()}
          onChange={e => onVolume(parseFloat(e.target.value))}
          title={`Volume ${Math.round(insert.volume * 100)}%`}
          className="h-1 w-16 -rotate-90 cursor-pointer appearance-none rounded-full bg-navy-700 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ffcc18]"
        />
      </div>

      {/* Mute / Solo */}
      <div className="flex w-full items-center justify-center gap-1">
        <button
          onClick={e => { e.stopPropagation(); onMute(); }}
          className={`rounded px-1.5 text-[9px] font-bold ${insert.muted ? 'bg-[#ee4444]/80 text-cream-100' : 'bg-navy-800 text-cream-500 hover:text-cream-200'}`}
        >M</button>
        {!isMaster && (
          <button
            onClick={e => { e.stopPropagation(); onSolo(); }}
            className={`rounded px-1.5 text-[9px] font-bold ${insert.solo ? 'bg-[#ffcc18] text-navy-950' : 'bg-navy-800 text-cream-500 hover:text-cream-200'}`}
          >S</button>
        )}
      </div>
    </div>
  );
}

/** Small live preview of an A-D-S-R contour. */
function AdsrCurve({ params }: { params: Record<string, number> }) {
  const W = 150, H = 44, pad = 3;
  const a = params.attack ?? 0.1, d = params.decay ?? 0.2, s = params.sustain ?? 0.5, r = params.release ?? 0.3;
  const hold = 0.35; // fixed visual sustain-hold width (in "seconds")
  const total = a + d + hold + r || 1;
  const yFor = (lvl: number) => H - pad - lvl * (H - 2 * pad);
  const xa = (a / total) * W;
  const xd = ((a + d) / total) * W;
  const xs = ((a + d + hold) / total) * W;
  const pts = [
    [0, yFor(0)],
    [xa, yFor(1)],
    [xd, yFor(s)],
    [xs, yFor(s)],
    [W, yFor(0)],
  ];
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="rounded bg-navy-950">
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none" stroke="#ffcc18" strokeWidth={1.5} strokeLinejoin="round"
      />
    </svg>
  );
}

function AdsrEffectBody({
  insert, eff, onUpdateEffectParam,
}: {
  insert: MixerInsert;
  eff: Effect;
  onUpdateEffectParam: (insertId: string, effectId: string, key: string, value: number) => void;
}) {
  const specs = EFFECT_PARAM_SPECS['filter-adsr'];
  const fmt = (key: string) => (v: number) =>
    key === 'cutoff' ? `${Math.round(v)}` : key === 'resonance' ? v.toFixed(1) : `${Math.round(v * 1000)}`;
  return (
    <div className="space-y-2">
      <AdsrCurve params={eff.params} />
      <div className="flex flex-wrap justify-between gap-1">
        {specs.map(([key, label, min, max, step]) => (
          <Knob
            key={key}
            label={label}
            value={eff.params[key]}
            min={min} max={max} step={step}
            format={fmt(key)}
            onChange={(v) => onUpdateEffectParam(insert.id, eff.id, key, v)}
          />
        ))}
      </div>
      <p className="text-[8px] text-cream-600">Envelope re-triggers each bar; A/D/S/R/Amount apply on next play.</p>
    </div>
  );
}

function EffectRack({
  insert, onRemoveEffect, onToggleEffect, onUpdateEffectParam,
}: {
  insert: MixerInsert;
  onRemoveEffect: (insertId: string, effectId: string) => void;
  onToggleEffect: (insertId: string, effectId: string) => void;
  onUpdateEffectParam: (insertId: string, effectId: string, key: string, value: number) => void;
}) {
  return (
    <div className="flex h-full w-[360px] flex-shrink-0 flex-col overflow-y-auto border-l border-navy-700 bg-navy-950 p-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-cream-400">
          {insert.name} · Effects
        </span>
        <span className="text-[9px] text-cream-500">(add from Plugins, left)</span>
      </div>

      {insert.effects.length === 0 && (
        <p className="px-1 py-4 text-center text-[10px] text-cream-600">
          No effects. Select a plugin in the left panel to add it here.
        </p>
      )}

      <div className="space-y-2">
        {insert.effects.map((eff: Effect) => {
          const specs = EFFECT_PARAM_SPECS[eff.type as EffectType];
          return (
            <div key={eff.id} className={`rounded-lg border border-navy-700 bg-navy-900 p-2 ${eff.enabled ? '' : 'opacity-50'}`}>
              <div className="mb-1.5 flex items-center gap-2">
                <button
                  onClick={() => onToggleEffect(insert.id, eff.id)}
                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${eff.enabled ? 'bg-[#ffcc18]' : 'bg-navy-600'}`}
                  title={eff.enabled ? 'Bypass' : 'Enable'}
                />
                <span className="flex-1 text-[11px] font-medium text-cream-100">{EFFECT_LABELS[eff.type]}</span>
                <button
                  onClick={() => onRemoveEffect(insert.id, eff.id)}
                  className="text-cream-600 hover:text-[#ee4444]"
                  title="Remove effect"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {eff.type === 'filter-adsr' ? (
                <AdsrEffectBody insert={insert} eff={eff} onUpdateEffectParam={onUpdateEffectParam} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {specs.map(([key, label, min, max, step]) => (
                    <label key={key} className="flex items-center gap-2">
                      <span className="w-12 flex-shrink-0 text-[9px] text-cream-500">{label}</span>
                      <input
                        type="range" min={min} max={max} step={step} value={eff.params[key]}
                        onChange={e => onUpdateEffectParam(insert.id, eff.id, key, parseFloat(e.target.value))}
                        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-navy-700 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ffcc18]"
                      />
                      <span className="w-12 flex-shrink-0 text-right text-[9px] tabular-nums text-cream-300">
                        {parseFloat(eff.params[key].toFixed(3))}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Mixer({
  project, selectedInsertId, onSelectInsert,
  onSetInsertVolume, onSetInsertPan, onToggleInsertMute, onToggleInsertSolo, onAddInsert,
  onRemoveEffect, onToggleEffect, onUpdateEffectParam, onClose,
}: MixerProps) {
  const selected = project.inserts.find(i => i.id === selectedInsertId) ?? project.inserts[0];

  return (
    <div className="flex h-[240px] flex-shrink-0 flex-col border-t border-navy-700 bg-navy-950">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-navy-800 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-cream-400">Mixer</span>
        <button
          onClick={onAddInsert}
          className="rounded border border-navy-700 bg-navy-900 px-2 py-0.5 text-[10px] text-cream-300 hover:bg-navy-800"
        >+ Insert</button>
        <button
          onClick={onClose}
          className="ml-auto text-cream-500 hover:text-cream-200"
          title="Close mixer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Body: strips + selected effect rack */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 overflow-x-auto">
          {project.inserts.map(insert => (
            <InsertStrip
              key={insert.id}
              insert={insert}
              selected={insert.id === selected.id}
              routedCount={trackCountForInsert(project, insert.id)}
              onSelect={() => onSelectInsert(insert.id)}
              onVolume={v => onSetInsertVolume(insert.id, v)}
              onPan={v => onSetInsertPan(insert.id, v)}
              onMute={() => onToggleInsertMute(insert.id)}
              onSolo={() => onToggleInsertSolo(insert.id)}
            />
          ))}
        </div>

        <EffectRack
          insert={selected}
          onRemoveEffect={onRemoveEffect}
          onToggleEffect={onToggleEffect}
          onUpdateEffectParam={onUpdateEffectParam}
        />
      </div>
    </div>
  );
}
