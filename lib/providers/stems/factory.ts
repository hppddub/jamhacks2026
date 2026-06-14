import { spawnSync } from 'child_process';
import type { StemSeparationProvider } from './types';
import { MockStemProvider } from './MockStemProvider';
import { ReplicateProvider } from './ReplicateProvider';
import { LocalDemucsProvider } from './LocalDemucsProvider';
import { resolvedPath } from '@/lib/audio/ffmpegEnv';

/** Returns true when ffmpeg resolves on the system PATH (including registry-merged paths on Windows). */
function isFfmpegAvailable(): boolean {
  const cmd = process.env.FFMPEG_CMD ?? 'ffmpeg';
  const result = spawnSync(cmd, ['-version'], {
    stdio: 'ignore',
    env: { ...process.env, PATH: resolvedPath() },
  });
  return !result.error;
}

export function getStemProvider(): StemSeparationProvider {
  const provider = process.env.STEM_PROVIDER ?? 'mock';

  if (provider === 'replicate') return new ReplicateProvider();

  if (provider === 'local') {
    if (isFfmpegAvailable()) return new LocalDemucsProvider();
    // ffmpeg is required by Demucs. When it's absent, fall back to mock stems
    // rather than crashing — the user gets playable (synthesised) stems instead
    // of an error banner. They can install ffmpeg and restart to get real separation.
    console.warn(
      '[stems/factory] STEM_PROVIDER=local but ffmpeg is not in PATH. ' +
      'Falling back to MockStemProvider. Install ffmpeg or set FFMPEG_CMD in .env.local.'
    );
    return new MockStemProvider();
  }

  return new MockStemProvider();
}
