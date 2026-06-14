import fs from 'fs';
import path from 'path';
import type { MusicGenerationProvider } from '../types';
import type { AnalysisResult, GeneratedScore } from '@/types';
import { buildPrompt, buildBackendPrompt } from './buildPrompt';
import { generateId } from '@/lib/utils';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/sound-generation';

// ElevenLabs Sound Generation produces best-quality output at or below 22s.
// Above that, the model tends to repeat or drift. For full-length continuous
// scores, use MUSIC_PROVIDER=elevenmusic (single /v1/music request, up to 3 min).
const MAX_DURATION_SECONDS = 22;

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

    // Narrative prompt — ElevenLabs Sound Generation works best with natural
    // language music briefs, not technical specs.
    const prompt = buildPrompt(result);
    const { instrumentSpec } = buildBackendPrompt(result);

    console.log('[ElevenLabs] prompt (%d chars):', prompt.length, prompt);

    const rawDuration = metadata.durationSeconds;
    // Cap at MAX_DURATION_SECONDS — beyond this the Sound Generation endpoint
    // repeats content. For longer videos set MUSIC_PROVIDER=elevenmusic.
    const durationSeconds =
      rawDuration != null && rawDuration >= 0.5
        ? Math.min(rawDuration, MAX_DURATION_SECONDS)
        : undefined;

    const buffer = await this.fetchWithRetry(prompt, durationSeconds);

    const id = generateId();
    const outputDir = path.join(process.cwd(), 'public', 'generated');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `${id}.mp3`), buffer);

    return {
      audioUrl: `/generated/${id}.mp3`,
      durationSeconds: durationSeconds ?? 20,
      bpm: analysis.bpm,
      genre: analysis.genre,
      mood: analysis.mood,
      filename: `score-${analysis.mood}-${analysis.bpm}bpm.mp3`,
      prompt,
      backendPrompt: prompt,
      instrumentSpec,
    };
  }

  private async fetchWithRetry(prompt: string, durationSeconds?: number): Promise<Buffer> {
    const body: Record<string, unknown> = { text: prompt, prompt_influence: 0.3 };
    if (durationSeconds !== undefined) body.duration_seconds = durationSeconds;

    console.log('[ElevenLabs] request:', JSON.stringify(body));

    const MAX_RETRIES = 4;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const response = await fetch(ELEVENLABS_API, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        if (attempt === MAX_RETRIES - 1) {
          const errorText = await response.text();
          throw new Error(`ElevenLabs 429 (rate limit): ${errorText || 'system busy'}`);
        }
        const retryAfterHeader = response.headers.get('Retry-After');
        const waitMs = retryAfterHeader
          ? Math.max(parseInt(retryAfterHeader, 10) * 1000, 1000)
          : Math.pow(2, attempt + 3) * 1000;
        console.warn(`[ElevenLabs] 429 — waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ElevenLabs] error body:', errorText);
        throw new Error(`ElevenLabs ${response.status}: ${errorText || '(empty response)'}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) throw new Error('ElevenLabs returned an empty audio response.');
      return buffer;
    }

    throw new Error('ElevenLabs: max retries exceeded (persistent rate limit).');
  }
}
