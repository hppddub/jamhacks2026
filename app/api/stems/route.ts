import { NextResponse } from 'next/server';
import { getStemProvider } from '@/lib/providers/stems/factory';

// Allow up to 3 minutes — required for Replicate polling in serverless environments
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { audioUrl?: unknown };

    if (typeof body.audioUrl !== 'string' || !body.audioUrl.startsWith('/generated/')) {
      return NextResponse.json(
        { error: 'audioUrl must be a string starting with /generated/' },
        { status: 400 }
      );
    }

    const result = await getStemProvider().separate(body.audioUrl);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/stems]', error);
    const message = error instanceof Error ? error.message : 'Stem separation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
