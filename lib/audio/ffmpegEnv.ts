import { execFileSync } from 'child_process';

/**
 * Returns a PATH string that, on Windows, also includes the user-level registry
 * PATH. Tools installed after the dev server started (e.g. ffmpeg via winget) are
 * then visible to spawned subprocesses without restarting the server.
 *
 * Shared by the Demucs stem provider and the original-audio extractor.
 */
export function resolvedPath(): string {
  const base = process.env.PATH ?? '';
  if (process.platform !== 'win32') return base;
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'PATH'], { encoding: 'utf8' });
    const match = out.match(/PATH\s+REG_(?:SZ|EXPAND_SZ)\s+(.+)/i);
    if (match) return `${base};${match[1].trim()}`;
  } catch {
    /* best-effort — fall back to the process PATH */
  }
  return base;
}
