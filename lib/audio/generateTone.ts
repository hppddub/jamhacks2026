import fs from 'fs';
import path from 'path';
import type { VideoAnalysis } from '@/types';

interface LameMp3Encoder {
  encodeBuffer(left: Int16Array): Int8Array;
  flush(): Int8Array;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const lamejs = require('lamejs') as {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => LameMp3Encoder;
};

const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BITRATE = 128;
const CHUNK_SIZE = 1152; // lamejs processes in multiples of 576

const MOOD_ROOT_FREQ: Record<string, number> = {
  calm: 261.63,         // C4
  happy: 329.63,        // E4
  energetic: 392.0,     // G4
  dramatic: 220.0,      // A3
  suspenseful: 246.94,  // B3
  inspirational: 349.23,// F4
  emotional: 293.66,    // D4
  corporate: 311.13,    // Eb4
};

const ENERGY_DURATION: Record<string, number> = { low: 15, medium: 18, high: 22 };
const MAX_MOCK_DURATION = 120; // cap mock synthesis at 2 min to avoid excessive memory use
const ENERGY_AMPLITUDE: Record<string, number> = { low: 0.25, medium: 0.45, high: 0.65 };

// I–IV–V–I chord progression as frequency ratios relative to root
const CHORD_PROGRESSION = [
  [1.0, 1.25, 1.5],     // I  major triad
  [1.333, 1.667, 2.0],  // IV major triad
  [1.5, 1.875, 2.25],   // V  major triad
  [1.0, 1.25, 1.5],     // I  return
];

export function generateMp3(analysis: VideoAnalysis, outputPath: string, targetDurationSeconds?: number): number {
  const rootFreq = MOOD_ROOT_FREQ[analysis.mood] ?? 261.63;
  const baseDuration = ENERGY_DURATION[analysis.energyLevel] ?? 18;
  const durationSeconds = Math.min(
    Math.max(targetDurationSeconds ?? baseDuration, 1),
    MAX_MOCK_DURATION
  );
  const amplitude = ENERGY_AMPLITUDE[analysis.energyLevel] ?? 0.45;

  const totalSamples = Math.round(SAMPLE_RATE * durationSeconds);
  const barSamples = Math.round((60 / analysis.bpm) * 4 * SAMPLE_RATE);

  const pcm = new Int16Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const barIndex = Math.floor(i / barSamples) % CHORD_PROGRESSION.length;
    const chord = CHORD_PROGRESSION[barIndex];
    const posInBar = (i % barSamples) / barSamples;

    // Per-bar envelope: short attack, sustain, brief release before next bar
    let env: number;
    if (posInBar < 0.02) {
      env = posInBar / 0.02;
    } else if (posInBar > 0.85) {
      env = (1.0 - posInBar) / 0.15;
    } else {
      env = 1.0;
    }

    // Sum sine waves for each chord note, then normalise
    let sample = 0;
    for (const ratio of chord) {
      sample += Math.sin(2 * Math.PI * rootFreq * ratio * t);
    }
    sample = (sample / chord.length) * env * amplitude;

    // Light noise texture at high energy
    if (analysis.energyLevel === 'high') {
      sample += (Math.random() - 0.5) * 0.015;
    }

    pcm[i] = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
  }

  encodePcmToMp3(pcm, outputPath);

  return Math.round(durationSeconds * 10) / 10;
}

// ── Stem generation ─────────────────────────────────────────────────────────

export interface StemConfig {
  frequency: number;
  amplitude: number;
  durationSeconds: number;
  bpm: number;
  /** continuous = harmonic sine (bass/melody), percussive = noise bursts (drums), sparse = near-silent sporadic tones (vocals) */
  pattern: 'continuous' | 'percussive' | 'sparse';
}

export function generateStemMp3(config: StemConfig, outputPath: string): void {
  const { frequency, amplitude, durationSeconds, bpm, pattern } = config;
  const totalSamples = Math.round(SAMPLE_RATE * durationSeconds);
  const beatSamples = Math.round((60 / bpm) * SAMPLE_RATE);
  const barSamples = beatSamples * 4;

  const pcm = new Int16Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;

    if (pattern === 'continuous') {
      const posInBar = (i % barSamples) / barSamples;
      const env = posInBar < 0.02 ? posInBar / 0.02 : posInBar > 0.9 ? (1 - posInBar) / 0.1 : 1.0;
      // Fundamental + first harmonic for musicality
      sample = (Math.sin(2 * Math.PI * frequency * t) + Math.sin(2 * Math.PI * frequency * 2 * t) * 0.3) / 1.3 * env * amplitude;

    } else if (pattern === 'percussive') {
      const posInBeat = (i % beatSamples) / beatSamples;
      // Snare-like noise burst on every beat
      const snareEnv = posInBeat < 0.005 ? 1.0 : posInBeat < 0.06 ? 1.0 - (posInBeat - 0.005) / 0.055 : 0;
      sample = (Math.random() - 0.5) * 2 * snareEnv * amplitude * 0.7;
      // Kick thump on beats 1 and 3 of each bar
      const beatInBar = Math.floor((i % barSamples) / beatSamples);
      if (beatInBar === 0 || beatInBar === 2) {
        const kickEnv = posInBeat < 0.06 ? 1.0 - posInBeat / 0.06 : 0;
        // Pitch-dropping sine for kick body
        sample += Math.sin(2 * Math.PI * 80 * t * Math.max(0.1, 1 - posInBeat * 8)) * kickEnv * amplitude;
      }

    } else {
      // sparse: occasional quiet tone bursts — simulates near-silent vocals on instrumental
      const beatIndex = Math.floor(i / beatSamples);
      // Deterministic per-beat activation (no Math.random so result is stable)
      const active = Math.abs(Math.sin(beatIndex * 7.3 + 1.2)) > 0.92;
      if (active) {
        const posInBeat = (i % beatSamples) / beatSamples;
        const env = posInBeat < 0.1 ? posInBeat / 0.1 : posInBeat > 0.7 ? (1 - posInBeat) / 0.3 : 1.0;
        sample = Math.sin(2 * Math.PI * frequency * t) * env * amplitude * 0.12;
      }
    }

    pcm[i] = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
  }

  encodePcmToMp3(pcm, outputPath);
}

// ── Shared PCM → MP3 encoder ─────────────────────────────────────────────────

function encodePcmToMp3(pcm: Int16Array, outputPath: string): void {
  const encoder = new lamejs.Mp3Encoder(CHANNELS, SAMPLE_RATE, BITRATE);
  const chunks: Int8Array[] = [];

  for (let i = 0; i < pcm.length; i += CHUNK_SIZE) {
    const chunk = pcm.subarray(i, Math.min(i + CHUNK_SIZE, pcm.length));
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) chunks.push(mp3buf);
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(flushed);

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const buffer = Buffer.allocUnsafe(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}
