import fs from 'fs';
import path from 'path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { MusicGenerationProvider } from '../types';
import type { AnalysisResult, GeneratedScore } from '@/types';
import { buildPrompt, buildTags } from './buildPrompt';
import { generateId } from '@/lib/utils';

// Derive MIME type from video file extension
function videoContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
  };
  return map[ext] ?? 'video/mp4';
}

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
    const { analysis, videoPath, metadata } = result;
    const prompt = buildPrompt(result);
    const tags = buildTags(result);

    // Send the actual video file to ElevenLabs — it analyses the visual content
    // and generates music that matches the video's energy and pacing.
    // description + tags guide the style without overriding ElevenLabs' own analysis.
    const response = await this.client.music.videoToMusic({
      videos: [
        {
          path: videoPath,
          contentType: videoContentType(videoPath),
          contentLength: metadata.sizeBytes,
        },
      ],
      description: prompt,
      tags,
      outputFormat: 'mp3_44100_128',
    });

    // Collect the ReadableStream<Uint8Array> into a single Buffer
    const chunks: Buffer[] = [];
    const reader = response.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      throw new Error('ElevenLabs returned an empty audio response.');
    }

    const id = generateId();
    const outputDir = path.join(process.cwd(), 'public', 'generated');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `${id}.mp3`), buffer);

    // Approximate duration from video metadata; ElevenLabs matches video length
    const durationSeconds = metadata.durationSeconds ?? 20;

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
