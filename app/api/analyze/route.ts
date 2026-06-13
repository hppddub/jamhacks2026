import { NextResponse } from 'next/server';
import { getAnalysisProvider } from '@/lib/providers/factory';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      videoPath?: unknown;
      filename?: unknown;
      sizeBytes?: unknown;
    };

    if (!body.videoPath || typeof body.videoPath !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid videoPath.' }, { status: 400 });
    }
    if (!body.filename || typeof body.filename !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid filename.' }, { status: 400 });
    }
    if (typeof body.sizeBytes !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid sizeBytes.' }, { status: 400 });
    }

    const provider = getAnalysisProvider();
    const result = await provider.analyze(body.videoPath, {
      filename: body.filename,
      sizeBytes: body.sizeBytes,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed. Please try again.';
    console.error('[/api/analyze]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
