import type { StemSeparationProvider } from './types';
import { MockStemProvider } from './MockStemProvider';
import { ReplicateProvider } from './ReplicateProvider';
import { LocalDemucsProvider } from './LocalDemucsProvider';

export function getStemProvider(): StemSeparationProvider {
  const provider = process.env.STEM_PROVIDER ?? 'mock';
  if (provider === 'replicate') return new ReplicateProvider();
  if (provider === 'local') return new LocalDemucsProvider();
  return new MockStemProvider();
}
