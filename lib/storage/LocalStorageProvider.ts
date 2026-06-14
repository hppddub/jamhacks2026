import fs from 'fs';
import path from 'path';
import type { StorageProvider } from './types';

/**
 * Dev fallback that copies artifacts into `public/projects/{key}` and serves them
 * from the relative URL `/projects/{key}`. Not durable on serverless (ephemeral
 * disk) — use Vercel Blob in production. Selected by STORAGE_PROVIDER=local.
 */
export class LocalStorageProvider implements StorageProvider {
  async upload(localPath: string, key: string): Promise<string> {
    const dest = this.destFor(key);
    fs.copyFileSync(localPath, dest);
    return `/projects/${key}`;
  }

  async uploadBytes(data: Buffer, key: string): Promise<string> {
    fs.writeFileSync(this.destFor(key), data);
    return `/projects/${key}`;
  }

  private destFor(key: string): string {
    const dest = path.join(process.cwd(), 'public', 'projects', key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    return dest;
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith('/projects/')) return;
    const target = path.join(process.cwd(), 'public', url);
    fs.rmSync(target, { force: true });
  }
}
