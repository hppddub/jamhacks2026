import fs from 'fs';
import path from 'path';
import { spawnSync, execFileSync } from 'child_process';
import type { StemSeparationProvider } from './types';
import type { Stem, StemId, StemResult } from '@/types';
import { generateId } from '@/lib/utils';

// On Windows, merge the user-level registry PATH so tools installed after the server started
// (e.g. ffmpeg via winget) are visible to subprocesses without a server restart.
function resolvedPath(): string {
  const base = process.env.PATH ?? '';
  if (process.platform !== 'win32') return base;
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'PATH'], { encoding: 'utf8' });
    const match = out.match(/PATH\s+REG_(?:SZ|EXPAND_SZ)\s+(.+)/i);
    if (match) return `${base};${match[1].trim()}`;
  } catch { /* best-effort */ }
  return base;
}

const STEM_LABELS: Record<StemId, string> = {
  drums:  'Drums & Percussion',
  bass:   'Bass',
  melody: 'Melody & Harmony',
  vocals: 'Vocals',
};

// Demucs output filenames → our StemId ('other' is the non-bass/drum/vocal melody layer)
const DEMUCS_KEY_MAP: Record<string, StemId> = {
  drums:  'drums',
  bass:   'bass',
  other:  'melody',
  vocals: 'vocals',
};

const STEM_ORDER: StemId[] = ['drums', 'bass', 'melody', 'vocals'];

export class LocalDemucsProvider implements StemSeparationProvider {
  async separate(sourceAudioUrl: string): Promise<StemResult> {
    const pythonCmd = process.env.DEMUCS_PYTHON_CMD ?? 'python';
    const localPath = path.join(process.cwd(), 'public', sourceAudioUrl);

    if (!fs.existsSync(localPath)) {
      throw new Error(`Audio file not found: ${localPath}`);
    }

    const jobId = generateId();
    const demucsOutputDir = path.join(process.cwd(), '.tmp-demucs', jobId);
    const stemOutputDir = path.join(process.cwd(), 'public', 'stems', jobId);

    fs.mkdirSync(demucsOutputDir, { recursive: true });
    fs.mkdirSync(stemOutputDir, { recursive: true });

    try {
      const result = spawnSync(
        pythonCmd,
        ['-m', 'demucs', '--mp3', '--mp3-bitrate', '128', '-n', 'htdemucs', '--out', demucsOutputDir, localPath],
        { timeout: 300_000, env: { ...process.env, PATH: resolvedPath() } }
      );

      if (result.status !== 0 || result.error) {
        const stderr = result.stderr?.toString() ?? '';
        const stdout = result.stdout?.toString() ?? '';
        const combined = stderr + stdout;
        const combinedLower = combined.toLowerCase();

        // Log full output server-side for debugging
        console.error('[demucs] stderr tail:', stderr.slice(-2000));
        console.error('[demucs] stdout tail:', stdout.slice(-500));

        if ((result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
          throw new Error(
            `Python not found. Ensure Python is in PATH, or set DEMUCS_PYTHON_CMD=python3 in .env.local.`
          );
        }
        if (combinedLower.includes('no module named demucs')) {
          throw new Error(`Demucs is not installed. Run: ${pythonCmd} -m pip install demucs`);
        }
        if (
          combinedLower.includes('ffmpeg') ||
          combinedLower.includes('command not found') ||
          combinedLower.includes('encodernotfounderror')
        ) {
          throw new Error(
            `ffmpeg not found in PATH. If you just installed ffmpeg, restart the dev server (npm run dev) so the new PATH is picked up.`
          );
        }
        // Show the tail of combined output — actual error comes after the model download progress
        const tail = combined.slice(-800).trim();
        throw new Error(`Demucs failed (exit ${result.status ?? '?'}): ${tail}`);
      }
    } catch (err) {
      fs.rmSync(demucsOutputDir, { recursive: true, force: true });
      throw err;
    }

    // Demucs writes: {demucsOutputDir}/htdemucs/{trackName}/{stem}.mp3
    const trackName = path.basename(localPath, path.extname(localPath));
    const demucsTrackDir = path.join(demucsOutputDir, 'htdemucs', trackName);

    if (!fs.existsSync(demucsTrackDir)) {
      fs.rmSync(demucsOutputDir, { recursive: true, force: true });
      throw new Error(`Demucs output not found at ${demucsTrackDir}. Separation may have failed silently.`);
    }

    const stems: Stem[] = [];

    for (const [demucsKey, stemId] of Object.entries(DEMUCS_KEY_MAP)) {
      const srcPath = path.join(demucsTrackDir, `${demucsKey}.mp3`);
      if (!fs.existsSync(srcPath)) continue;
      const destPath = path.join(stemOutputDir, `${stemId}.mp3`);
      fs.copyFileSync(srcPath, destPath);
      stems.push({ id: stemId, label: STEM_LABELS[stemId], audioUrl: `/stems/${jobId}/${stemId}.mp3` });
    }

    fs.rmSync(demucsOutputDir, { recursive: true, force: true });

    if (stems.length === 0) {
      throw new Error('Demucs produced no stem files. Check that the audio file is valid.');
    }

    stems.sort((a, b) => STEM_ORDER.indexOf(a.id) - STEM_ORDER.indexOf(b.id));

    return { jobId, stems, sourceAudioUrl };
  }
}
