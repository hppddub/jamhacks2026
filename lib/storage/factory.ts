import type { StorageProvider } from './types';
import { VercelBlobProvider } from './VercelBlobProvider';
import { LocalStorageProvider } from './LocalStorageProvider';

/**
 * Selects the durable storage backend. `STORAGE_PROVIDER=local` uses the on-disk
 * dev fallback; anything else (default) uses Vercel Blob. This is the only place
 * concrete storage providers are imported.
 */
export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? 'vercel-blob';
  if (provider === 'local') return new LocalStorageProvider();
  return new VercelBlobProvider();
}
