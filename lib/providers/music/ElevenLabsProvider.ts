import fs from 'fs';
import path from 'path';
import type { MusicGenerationProvider } from '../types';
import type { AnalysisResult, GeneratedScore } from '@/types';
import { buildPrompt, buildChunkPrompt } from './buildPrompt';
import { generateId } from '@/lib/utils';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/sound-generation';
const MAX_SEGMENT_SECONDS = 22;   // ElevenLabs Sound Generation hard cap per call
const CROSSFADE_SAMPLES = 88200;  // 2s — long enough for musical blending without audible seams
const FADE_IN_SAMPLES  = 22050;   // 0.5s fade-in on the full composition
const FADE_OUT_SAMPLES = 44100;   // 1s fade-out on the full composition

const WAV_SAMPLE_RATE = 44100;
const WAV_CHANNELS = 1;
const WAV_BIT_DEPTH = 16;

// Equal-power (cosine) crossfade — preserves perceived loudness at every seam.
// Output length = Σ(lengths) − (N−1) × fade.
function crossfadeSegments(segments: Int16Array[], fadeSamples: number): Int16Array {
  if (segments.length === 1) return segments[0];

  const fade = segments.reduce(
    (min, s) => Math.min(min, Math.floor(s.length / 2)),
    fadeSamples
  );

  const totalSamples =
    segments.reduce((sum, s) => sum + s.length, 0) - (segments.length - 1) * fade;
  const out = new Int16Array(totalSamples);
  let writePos = 0;

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    const isFirst = si === 0;
    const isLast = si === segments.length - 1;

    const bodyStart = isFirst ? 0 : fade;
    const bodyEnd = isLast ? seg.length : seg.length - fade;
    for (let i = bodyStart; i < bodyEnd; i++) out[writePos++] = seg[i];

    if (!isLast) {
      const next = segments[si + 1];
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        const tOut = Math.cos(t * Math.PI / 2);  // equal-power fade-out
        const tIn  = Math.sin(t * Math.PI / 2);  // equal-power fade-in
        const a = seg[seg.length - fade + i] * tOut;
        const b = next[i] * tIn;
        out[writePos++] = Math.round(Math.max(-32768, Math.min(32767, a + b)));
      }
    }
  }

  return out;
}

// Apply equal-power fade-in and fade-out to the final composition in-place.
function applyFades(pcm: Int16Array, fadeInSamples: number, fadeOutSamples: number): Int16Array {
  const out = new Int16Array(pcm);
  const fi = Math.min(fadeInSamples, Math.floor(pcm.length / 4));
  const fo = Math.min(fadeOutSamples, Math.floor(pcm.length / 4));
  for (let i = 0; i < fi; i++) {
    out[i] = Math.round(pcm[i] * Math.sin((i / fi) * Math.PI / 2));
  }
  for (let i = 0; i < fo; i++) {
    const idx = pcm.length - fo + i;
    out[idx] = Math.round(pcm[idx] * Math.cos((i / fo) * Math.PI / 2));
  }
  return out;
}

// Write a standard 44-byte WAV header + raw 16-bit signed LE mono PCM.
function pcmToWav(pcm: Int16Array): Buffer {
  const dataBytes = pcm.length * 2;
  const buf = Buffer.allocUnsafe(44 + dataBytes);

  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);                                               // PCM
  buf.writeUInt16LE(WAV_CHANNELS, 22);
  buf.writeUInt32LE(WAV_SAMPLE_RATE, 24);
  buf.writeUInt32LE(WAV_SAMPLE_RATE * WAV_CHANNELS * (WAV_BIT_DEPTH / 8), 28);
  buf.writeUInt16LE(WAV_CHANNELS * (WAV_BIT_DEPTH / 8), 32);
  buf.writeUInt16LE(WAV_BIT_DEPTH, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < pcm.length; i++) {
    buf.writeInt16LE(pcm[i], 44 + i * 2);
  }

  return buf;
}

// Trim PCM to exact target duration. No-op if already at or under target.
function trimToDuration(pcm: Int16Array, targetSeconds: number): Int16Array {
  const targetSamples = Math.round(targetSeconds * WAV_SAMPLE_RATE);
  return pcm.length <= targetSamples ? pcm : pcm.slice(0, targetSamples);
}

export class ElevenLabsProvider implements MusicGenerationProvider {
  private apiKey: string;

  constructor() {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) {
      throw new Error(
        'ELEVENLABS_API_KEY is not set. Add it to .env.local or set MUSIC_PROVIDER=mock.'
      );
    }
    this.apiKey = key;
  }

  async generate(result: AnalysisResult): Promise<GeneratedScore> {
    const { analysis, metadata } = result;
    const displayPrompt = buildPrompt(result);

    console.log('[ElevenLabs] overall prompt (%d chars):', displayPrompt.length, displayPrompt);

    const totalDuration =
      typeof metadata.durationSeconds === 'number' && metadata.durationSeconds >= 0.5
        ? metadata.durationSeconds
        : undefined;

    let pcm = await this.fetchByTimeline(result, totalDuration);

    // Trim to exact clip duration — ElevenLabs consistently over-generates
    if (totalDuration !== undefined) {
      pcm = trimToDuration(pcm, totalDuration);
    }

    const buffer = pcmToWav(pcm);
    const id = generateId();
    const outputDir = path.join(process.cwd(), 'public', 'generated');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `${id}.wav`), buffer);

    return {
      audioUrl: `/generated/${id}.wav`,
      durationSeconds: totalDuration ?? (pcm.length / WAV_SAMPLE_RATE),
      bpm: analysis.bpm,
      genre: analysis.genre,
      mood: analysis.mood,
      filename: `score-${analysis.mood}-${analysis.bpm}bpm.wav`,
      prompt: displayPrompt,
    };
  }

  // Split the video duration into equal chunks (each ≤ MAX_SEGMENT_SECONDS), generate
  // sequentially to stay within ElevenLabs concurrent-request limits, then blend with a 2s
  // equal-power crossfade + global fades so the result flows as one continuous piece.
  private async fetchByTimeline(
    result: AnalysisResult,
    totalDuration?: number
  ): Promise<Int16Array> {
    if (!totalDuration || totalDuration < 0.5) {
      const prompt = buildPrompt(result);
      const pcm = await this.fetchSegmentPcm(prompt, undefined);
      return applyFades(pcm, FADE_IN_SAMPLES, FADE_OUT_SAMPLES);
    }

    const chunkCount = Math.ceil(totalDuration / MAX_SEGMENT_SECONDS);
    const chunkDur = totalDuration / chunkCount;

    console.log(
      `[ElevenLabs] generating ${chunkCount} chunk(s) sequentially, each ~${chunkDur.toFixed(1)}s`
    );

    const chunkPcms: Int16Array[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkDur;
      const end   = Math.min((i + 1) * chunkDur, totalDuration);
      const prompt = buildChunkPrompt(result, i, chunkCount, start, end);
      console.log(
        `[ElevenLabs] chunk ${i + 1}/${chunkCount} (${(end - start).toFixed(1)}s, ${prompt.length} chars): ${prompt.slice(0, 80)}…`
      );
      const pcm = await this.fetchSegmentPcm(prompt, end - start);
      chunkPcms.push(pcm);
    }

    const merged = chunkCount === 1
      ? chunkPcms[0]
      : crossfadeSegments(chunkPcms, CROSSFADE_SAMPLES);

    return applyFades(merged, FADE_IN_SAMPLES, FADE_OUT_SAMPLES);
  }

  // Fetch raw 16-bit signed LE mono PCM at 44100 Hz from ElevenLabs Sound Generation.
  private async fetchSegmentPcm(prompt: string, durationSeconds?: number): Promise<Int16Array> {
    const body: Record<string, unknown> = { text: prompt, prompt_influence: 0.3 };
    if (durationSeconds !== undefined) {
      body.duration_seconds = Math.min(durationSeconds, MAX_SEGMENT_SECONDS);
    }

    const response = await fetch(`${ELEVENLABS_API}?output_format=pcm_44100`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/octet-stream',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ElevenLabs] error:', errorText);
      throw new Error(`ElevenLabs PCM ${response.status}: ${errorText || '(empty response)'}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error('ElevenLabs returned empty PCM response.');
    return new Int16Array(arrayBuffer);
  }
}
