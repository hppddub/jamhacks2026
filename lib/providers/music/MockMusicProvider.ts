import path from 'path';
import type { MusicGenerationProvider } from '../types';
import type { AnalysisResult, GeneratedScore } from '@/types';
import { generateMp3 } from '@/lib/audio/generateTone';
import { buildPrompt } from './buildPrompt';
import { generateId, delay } from '@/lib/utils';

export class MockMusicProvider implements MusicGenerationProvider {
  async generate(result: AnalysisResult): Promise<GeneratedScore> {
    const { analysis, metadata } = result;
    const prompt = buildPrompt(result);
    const id = generateId();
    const outputPath = path.join(process.cwd(), 'public', 'generated', `${id}.mp3`);

    // Synthesise real PCM audio and encode to MP3, matching the video's actual duration
    const durationSeconds = generateMp3(analysis, outputPath, result.metadata.durationSeconds);

    // Simulate generation latency after synthesis
    await delay(3000 + Math.random() * 2000);

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
