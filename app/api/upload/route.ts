import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateId } from '@/lib/utils';
import { extractOriginalAudio } from '@/lib/audio/extractOriginalAudio';

const ACCEPTED_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No video file provided.' }, { status: 400 });
    }

    const ext = ACCEPTED_MIME[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload MP4, MOV, or WEBM.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100 MB.' },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });

    const id = generateId();
    const filename = `${id}.${ext}`;
    const fullPath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buffer);

    const rawDuration = formData.get('durationSeconds');
    const durationSeconds = rawDuration !== null ? parseFloat(String(rawDuration)) : undefined;
    const validDuration =
      typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
        ? durationSeconds
        : undefined;

    // Extract a browser-playable copy of the original audio track (best-effort).
    // The browser often can't decode the source's audio codec; ffmpeg can.
    const originalAudioUrl = extractOriginalAudio(fullPath, id);

    return NextResponse.json({
      videoPath: fullPath,
      filename: file.name,
      sizeBytes: file.size,
      durationSeconds: validDuration,
      originalAudioUrl,
    });
  } catch (error) {
    console.error('[/api/upload]', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
