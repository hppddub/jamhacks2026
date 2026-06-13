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
const ENERGY_AMPLITUDE: Record<string, number> = { low: 0.25, medium: 0.45, high: 0.65 };

// I–IV–V–I chord progression as frequency ratios relative to root
const CHORD_PROGRESSION = [
  [1.0, 1.25, 1.5],     // I  major triad
  [1.333, 1.667, 2.0],  // IV major triad
  [1.5, 1.875, 2.25],   // V  major triad
  [1.0, 1.25, 1.5],     // I  return
];

export function generateMp3(analysis: VideoAnalysis, outputPath: string, targetDuration?: number): number {
  const rootFreq = MOOD_ROOT_FREQ[analysis.mood] ?? 261.63;
  const durationSeconds = targetDuration ?? ENERGY_DURATION[analysis.energyLevel] ?? 18;
  const amplitude = ENERGY_AMPLITUDE[analysis.energyLevel] ?? 0.45;

  const totalSamples = SAMPLE_RATE * durationSeconds;
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

  // Encode PCM → MP3 via lamejs
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

  return durationSeconds;
}
