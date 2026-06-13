import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateId } from '@/lib/utils';

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

    return NextResponse.json({
      videoPath: fullPath,
      filename: file.name,
      sizeBytes: file.size,
    });
  } catch (error) {
    console.error('[/api/upload]', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
