import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { resolvedPath } from './ffmpegEnv';

const FFMPEG_CMD = process.env.FFMPEG_CMD ?? 'ffmpeg';
const EXTRACT_TIMEOUT_MS = 120_000;

/**
 * Extracts the original audio track of an uploaded video and transcodes it to a
 * browser-playable MP3 using ffmpeg. Browsers ship only a small set of audio
 * decoders, so a video whose audio is e.g. AC-3/E-AC-3 or PCM-in-MOV plays its
 * video track but stays silent. ffmpeg can decode those, so we re-encode the
 * audio to MP3 and serve it as a separate, synced track in the combined player.
 *
 * Best-effort and non-fatal: returns the public URL on success, or `undefined`
 * when the video has no audio stream, ffmpeg is unavailable, or anything fails.
 * The caller must treat `undefined` as "no usable original audio" — never an error.
 *
 * @param videoPath absolute filesystem path to the saved upload
 * @param id        the upload id (the MP3 is written next to the video as `${id}-original.mp3`)
 * @returns `/uploads/${id}-original.mp3` or `undefined`
 */
export function extractOriginalAudio(videoPath: string, id: string): string | undefined {
  if (!fs.existsSync(videoPath)) return undefined;

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  const outName = `${id}-original.mp3`;
  const outPath = path.join(uploadDir, outName);

  try {
    fs.mkdirSync(uploadDir, { recursive: true });

    const result = spawnSync(
      FFMPEG_CMD,
      [
        '-y',                 // overwrite without prompting
        '-i', videoPath,
        '-vn',                // drop video
        '-map', '0:a:0?',     // first audio stream, optional (no error if absent)
        '-ac', '1',           // mono — half the data, faster encode (preview track only)
        '-c:a', 'libmp3lame',
        '-b:a', '96k',        // lower bitrate — this is a reference/preview track
        '-threads', '0',      // use all cores
        outPath,
      ],
      { timeout: EXTRACT_TIMEOUT_MS, env: { ...process.env, PATH: resolvedPath() } }
    );

    if ((result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      console.warn('[extractOriginalAudio] ffmpeg not found in PATH — original audio unavailable.');
      return undefined;
    }

    // ffmpeg errors out when the source has no audio stream; treat that as "no audio".
    const ok = result.status === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
    if (!ok) {
      const stderr = result.stderr?.toString() ?? '';
      console.warn('[extractOriginalAudio] no usable audio extracted:', stderr.slice(-300).trim());
      fs.rmSync(outPath, { force: true });
      return undefined;
    }

    return `/uploads/${outName}`;
  } catch (err) {
    console.warn('[extractOriginalAudio] extraction failed:', err);
    fs.rmSync(outPath, { force: true });
    return undefined;
  }
}
