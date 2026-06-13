import type { VideoAnalysisProvider, MusicGenerationProvider } from './types';
import { MockAnalyzer } from './analysis/MockAnalyzer';
import { MockMusicProvider } from './music/MockMusicProvider';
import { ElevenLabsProvider } from './music/ElevenLabsProvider';
import { GeminiAnalyzer } from './analysis/GeminiAnalyzer';

export function getAnalysisProvider(): VideoAnalysisProvider {
  const provider = process.env.ANALYSIS_PROVIDER ?? 'mock';
  if (provider === 'gemini') return new GeminiAnalyzer();
  return new MockAnalyzer();
}

export function getMusicProvider(): MusicGenerationProvider {
  const provider = process.env.MUSIC_PROVIDER ?? 'mock';
  if (provider === 'elevenlabs') return new ElevenLabsProvider();
  return new MockMusicProvider();
}
