import type { VideoAnalysisProvider, MusicGenerationProvider } from './types';
import { GeminiAnalyzer } from './analysis/GeminiAnalyzer';
import { MockMusicProvider } from './music/MockMusicProvider';
import { ElevenLabsProvider } from './music/ElevenLabsProvider';
import { ElevenMusicProvider } from './music/ElevenMusicProvider';

export function getAnalysisProvider(): VideoAnalysisProvider {
  return new GeminiAnalyzer();
}

export function getMusicProvider(): MusicGenerationProvider {
  const provider = process.env.MUSIC_PROVIDER;
  const hasKey = !!process.env.ELEVENLABS_API_KEY;

  // No key → always mock regardless of MUSIC_PROVIDER setting.
  if (!hasKey || provider === 'mock') return new MockMusicProvider();

  // MUSIC_PROVIDER=sound-generation opts in to the legacy 22s sound-effects endpoint.
  // Everything else (elevenlabs, elevenmusic, unset) uses the Music API, which generates
  // a single continuous track matched to the full clip length (up to 3 min, one API call).
  if (provider === 'sound-generation') return new ElevenLabsProvider();
  return new ElevenMusicProvider();
}
