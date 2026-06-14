import fs from 'fs';
import { put, del } from '@vercel/blob';
import type { StorageProvider } from './types';

/**
 * Stores artifacts in Vercel Blob (durable, public CDN URLs).
 * Requires `BLOB_READ_WRITE_TOKEN` (read automatically from the environment by
 * `@vercel/blob`, passed explicitly here for clarity).
 */
export class VercelBlobProvider implements StorageProvider {
  private token = process.env.BLOB_READ_WRITE_TOKEN;

  async upload(localPath: string, key: string, contentType: string): Promise<string> {
    return this.uploadBytes(fs.readFileSync(localPath), key, contentType);
  }

  async uploadBytes(data: Buffer, key: string, contentType: string): Promise<string> {
    if (!this.token) {
      throw new Error(
        'BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local or set STORAGE_PROVIDER=local.'
      );
    }
    const blob = await put(key, data, {
      access: 'public',
      contentType,
      addRandomSuffix: false, // deterministic key per project artifact
      allowOverwrite: true,
      token: this.token,
    });
    return blob.url;
  }

  async delete(url: string): Promise<void> {
    if (!this.token) return;
    await del(url, { token: this.token });
  }
}
