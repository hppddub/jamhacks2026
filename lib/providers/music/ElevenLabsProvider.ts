import fs from 'fs';
import path from 'path';
import { ElevenLabsClient } from 'elevenlabs';
import type { MusicGenerationProvider } from '../types';
import type { AnalysisResult, GeneratedScore } from '@/types';
import { buildPrompt } from './buildPrompt';
import { generateId } from '@/lib/utils';

export class ElevenLabsProvider implements MusicGenerationProvider {
  private client: ElevenLabsClient;

  constructor() {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error(
        'ELEVENLABS_API_KEY is not set. Add it to .env.local or set MUSIC_PROVIDER=mock to use the mock provider.'
      );
    }
    this.client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  }

  async generate(result: AnalysisResult): Promise<GeneratedScore> {
    const { analysis, metadata } = result;
    const prompt = buildPrompt(result);

    const durationSeconds = Math.min(metadata.durationSeconds ?? 20, 22);

    const audioStream = await this.client.textToSoundEffects.convert({
      text: prompt,
      duration_seconds: durationSeconds,
      prompt_influence: 0.5,
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      throw new Error('ElevenLabs returned an empty audio response.');
    }

    const id = generateId();
    const outputDir = path.join(process.cwd(), 'public', 'generated');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `${id}.mp3`), buffer);

    return {
      audioUrl: `/generated/${id}.mp3`,
      durationSeconds,
      bpm: analysis.bpm,
      genre: analysis.genre,
      mood: analysis.mood,
      filename: `score-${analysis.mood}-${analysis.bpm}bpm.mp3`,
      prompt,
    };
  }
}
