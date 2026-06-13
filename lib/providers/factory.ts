import type { VideoAnalysisProvider, MusicGenerationProvider } from './types';
import { GeminiAnalyzer } from './analysis/GeminiAnalyzer';
import { MockMusicProvider } from './music/MockMusicProvider';
import { ElevenLabsProvider } from './music/ElevenLabsProvider';
import { ElevenMusicProvider } from './music/ElevenMusicProvider';

export function getAnalysisProvider(): VideoAnalysisProvider {
  return new GeminiAnalyzer();
}

export function getMusicProvider(): MusicGenerationProvider {
  const provider = process.env.MUSIC_PROVIDER ?? 'mock';
  if (provider === 'elevenmusic') return new ElevenMusicProvider();
  if (provider === 'elevenlabs') return new ElevenLabsProvider();
  return new MockMusicProvider();
}
