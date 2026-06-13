import { NextResponse } from 'next/server';
import { getMusicProvider } from '@/lib/providers/factory';
import type { AnalysisResult } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<AnalysisResult>;

    if (!body.analysis || !body.videoPath || !body.metadata) {
      return NextResponse.json(
        { error: 'Missing required analysis data.' },
        { status: 400 }
      );
    }

    const provider = getMusicProvider();
    const score = await provider.generate(body as AnalysisResult);

    return NextResponse.json(score);
  } catch (error) {
    console.error('[/api/generate]', error);
    const message = error instanceof Error ? error.message : 'Generation failed. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
