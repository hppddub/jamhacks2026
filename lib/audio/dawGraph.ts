import type { Effect, EffectType, MixerInsert, DAWProject } from '@/types/daw';

// ─── Effect parameter defaults & metadata ────────────────────────────────────

export const EFFECT_LABELS: Record<EffectType, string> = {
  eq: 'EQ',
  reverb: 'Reverb',
  delay: 'Delay',
  compressor: 'Compressor',
  distortion: 'Distortion',
};

export const EFFECT_DEFAULTS: Record<EffectType, Record<string, number>> = {
  eq:         { low: 0, mid: 0, high: 0 },             // dB, -24..24
  reverb:     { mix: 0.3, decay: 2.0 },               // mix 0..1, decay s
  delay:      { time: 0.3, feedback: 0.3, mix: 0.3 }, // s / 0..0.9 / 0..1
  compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25 },
  distortion: { amount: 0.3, mix: 1 },                // 0..1 drive / wet
};

// Param UI descriptors: [key, label, min, max, step]
export const EFFECT_PARAM_SPECS: Record<EffectType, [string, string, number, number, number][]> = {
  eq: [
    ['low', 'Low', -24, 24, 0.5],
    ['mid', 'Mid', -24, 24, 0.5],
    ['high', 'High', -24, 24, 0.5],
  ],
  reverb: [
    ['mix', 'Mix', 0, 1, 0.01],
    ['decay', 'Decay', 0.2, 6, 0.1],
  ],
  delay: [
    ['time', 'Time', 0.02, 1.5, 0.01],
    ['feedback', 'Fbk', 0, 0.9, 0.01],
    ['mix', 'Mix', 0, 1, 0.01],
  ],
  compressor: [
    ['threshold', 'Thr', -60, 0, 1],
    ['ratio', 'Ratio', 1, 20, 0.5],
    ['attack', 'Atk', 0, 0.5, 0.005],
    ['release', 'Rel', 0.05, 1, 0.01],
  ],
  distortion: [
    ['amount', 'Drive', 0, 1, 0.01],
    ['mix', 'Mix', 0, 1, 0.01],
  ],
};

export function defaultEffectParams(type: EffectType): Record<string, number> {
  return { ...EFFECT_DEFAULTS[type] };
}

// ─── DSP helpers ──────────────────────────────────────────────────────────────

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const k = amount * 100;
  const n = 44100;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function makeImpulse(ctx: BaseAudioContext, decaySeconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * decaySeconds));
  const impulse = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
  }
  return impulse;
}

// ─── Built effect (live-updatable) ────────────────────────────────────────────

export interface BuiltEffect {
  input: AudioNode;
  output: AudioNode;
  update: (params: Record<string, number>) => void;
}

export function buildEffect(ctx: BaseAudioContext, effect: Effect): BuiltEffect {
  const p = effect.params;
  switch (effect.type) {
    case 'eq': {
      const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 320;
      const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 1;
      const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 3200;
      low.connect(mid); mid.connect(high);
      low.gain.value = p.low; mid.gain.value = p.mid; high.gain.value = p.high;
      return {
        input: low, output: high,
        update: (np) => { low.gain.value = np.low; mid.gain.value = np.mid; high.gain.value = np.high; },
      };
    }
    case 'compressor': {
      const c = ctx.createDynamicsCompressor();
      c.knee.value = 30;
      c.threshold.value = p.threshold; c.ratio.value = p.ratio;
      c.attack.value = p.attack; c.release.value = p.release;
      return {
        input: c, output: c,
        update: (np) => {
          c.threshold.value = np.threshold; c.ratio.value = np.ratio;
          c.attack.value = np.attack; c.release.value = np.release;
        },
      };
    }
    case 'distortion': {
      const inNode = ctx.createGain();
      const out = ctx.createGain();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(p.amount);
      shaper.oversample = '2x';
      inNode.connect(dry); dry.connect(out);
      inNode.connect(shaper); shaper.connect(wet); wet.connect(out);
      dry.gain.value = 1 - p.mix; wet.gain.value = p.mix;
      return {
        input: inNode, output: out,
        update: (np) => {
          shaper.curve = makeDistortionCurve(np.amount);
          dry.gain.value = 1 - np.mix; wet.gain.value = np.mix;
        },
      };
    }
    case 'delay': {
      const inNode = ctx.createGain();
      const out = ctx.createGain();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const delay = ctx.createDelay(2.0);
      const fb = ctx.createGain();
      delay.delayTime.value = p.time; fb.gain.value = p.feedback; wet.gain.value = p.mix;
      inNode.connect(dry); dry.connect(out);
      inNode.connect(delay); delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(out);
      return {
        input: inNode, output: out,
        update: (np) => {
          delay.delayTime.value = np.time; fb.gain.value = np.feedback; wet.gain.value = np.mix;
        },
      };
    }
    case 'reverb': {
      const inNode = ctx.createGain();
      const out = ctx.createGain();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const conv = ctx.createConvolver();
      conv.buffer = makeImpulse(ctx, p.decay);
      wet.gain.value = p.mix;
      inNode.connect(dry); dry.connect(out);
      inNode.connect(conv); conv.connect(wet); wet.connect(out);
      let lastDecay = p.decay;
      return {
        input: inNode, output: out,
        update: (np) => {
          wet.gain.value = np.mix;
          if (np.decay !== lastDecay) { conv.buffer = makeImpulse(ctx, np.decay); lastDecay = np.decay; }
        },
      };
    }
  }
}

// ─── Built insert ─────────────────────────────────────────────────────────────

export interface BuiltInsert {
  input: GainNode;
  volume: GainNode;
  panner: StereoPannerNode;
  effects: Map<string, BuiltEffect>;
}

/** Insert is audible unless muted; if any insert is soloed, only soloed inserts play. */
export function insertActive(insert: MixerInsert, anySolo: boolean): boolean {
  return anySolo ? insert.solo : !insert.muted;
}

/** Track is audible unless muted; if any track is soloed, only soloed tracks play. */
export function trackActive(muted: boolean, solo: boolean, anyTrackSolo: boolean): boolean {
  return anyTrackSolo ? solo : !muted;
}

/**
 * Build master + every insert's effect chain. Connects each insert's output to
 * masterGain, and masterGain to the context destination. Returns the structures
 * needed for live updates and for routing track gains.
 */
export function buildMixGraph(ctx: BaseAudioContext, project: DAWProject): {
  master: GainNode;
  inserts: Map<string, BuiltInsert>;
} {
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const anyInsertSolo = project.inserts.some(i => i.solo && i.id !== 'master');
  const inserts = new Map<string, BuiltInsert>();

  // Pass 1 — build each strip's chain (input → effects → volume → panner).
  for (const insert of project.inserts) {
    const input = ctx.createGain();
    let node: AudioNode = input;
    const builtEffects = new Map<string, BuiltEffect>();

    for (const eff of insert.effects) {
      if (eff.enabled === false) continue;
      const be = buildEffect(ctx, eff);
      node.connect(be.input);
      node = be.output;
      builtEffects.set(eff.id, be);
    }

    const volume = ctx.createGain();
    const panner = ctx.createStereoPanner();

    const active = insert.id === 'master' ? !insert.muted : insertActive(insert, anyInsertSolo);
    volume.gain.value = active ? insert.volume : 0;
    panner.pan.value = insert.pan;

    node.connect(volume);
    volume.connect(panner);
    inserts.set(insert.id, { input, volume, panner, effects: builtEffects });
  }

  // Pass 2 — wire strip outputs: master → destination chain; others → master input.
  const masterBuilt = inserts.get('master');
  for (const insert of project.inserts) {
    const bi = inserts.get(insert.id);
    if (!bi) continue;
    if (insert.id === 'master' || !masterBuilt) {
      bi.panner.connect(master);
    } else {
      bi.panner.connect(masterBuilt.input);
    }
  }

  return { master, inserts };
}
