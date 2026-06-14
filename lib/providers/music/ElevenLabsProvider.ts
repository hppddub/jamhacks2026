import fs from 'fs';
import path from 'path';
import type { MusicGenerationProvider } from '../types';
import type { AnalysisResult, GeneratedScore } from '@/types';
import { buildPrompt, buildBackendPrompt } from './buildPrompt';
import { generateId } from '@/lib/utils';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/sound-generation';
const MAX_SEGMENT_SECONDS = 30;

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
    const prompt = buildPrompt(result);
    const { backendPrompt, instrumentSpec } = buildBackendPrompt(result);

    console.log('[ElevenLabs] frontend prompt (%d chars):', prompt.length, prompt);
    console.log('[ElevenLabs] backend prompt (%d chars):\n%s', backendPrompt.length, backendPrompt);
    console.log('[ElevenLabs] instrument spec:', JSON.stringify(instrumentSpec));

    const rawDuration = metadata.durationSeconds;
    const totalDuration =
      typeof rawDuration === 'number' && rawDuration >= 0.5 ? rawDuration : undefined;

    const buffer = await (totalDuration !== undefined && totalDuration > MAX_SEGMENT_SECONDS
      ? this.fetchMultiSegment(backendPrompt, totalDuration)
      : this.fetchSegment(backendPrompt, totalDuration));

    const id = generateId();
    const outputDir = path.join(process.cwd(), 'public', 'generated');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `${id}.mp3`), buffer);

    return {
      audioUrl: `/generated/${id}.mp3`,
      durationSeconds: totalDuration ?? 20,
      bpm: analysis.bpm,
      genre: analysis.genre,
      mood: analysis.mood,
      filename: `score-${analysis.mood}-${analysis.bpm}bpm.mp3`,
      prompt,
      backendPrompt,
      instrumentSpec,
    };
  }

  // Splits a long duration into ≤30s segments, fetches them ALL IN PARALLEL,
  // then concatenates the raw MP3 buffers in original order.
  private async fetchMultiSegment(prompt: string, totalDuration: number): Promise<Buffer> {
    const segCount = Math.ceil(totalDuration / MAX_SEGMENT_SECONDS);
    const durations = Array.from({ length: segCount }, (_, i) =>
      Math.min(totalDuration - i * MAX_SEGMENT_SECONDS, MAX_SEGMENT_SECONDS)
    );

    console.log(`[ElevenLabs] multi-segment (parallel): ${segCount} × ≤${MAX_SEGMENT_SECONDS}s for ${totalDuration}s video`);

    // Promise.all preserves array order, so concat order matches the timeline.
    const buffers = await Promise.all(durations.map((d, i) => {
      console.log(`[ElevenLabs] segment ${i + 1}/${segCount}: ${d}s`);
      return this.fetchSegment(prompt, d);
    }));

    return Buffer.concat(buffers);
  }

  private async fetchSegment(prompt: string, durationSeconds?: number): Promise<Buffer> {
    const body: Record<string, unknown> = { text: prompt, prompt_influence: 0.5 };
    if (durationSeconds !== undefined) body.duration_seconds = durationSeconds;

    console.log('[ElevenLabs] segment body:', JSON.stringify(body));

    const response = await fetch(ELEVENLABS_API, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ElevenLabs] error body:', errorText);
      throw new Error(`ElevenLabs ${response.status}: ${errorText || '(empty response)'}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) throw new Error('ElevenLabs returned an empty audio response.');
    return buffer;
  }
}
