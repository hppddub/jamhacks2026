'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { DAW } from '@/components/daw/DAW';
import type { DAWLibraryItem } from '@/types/daw';

// Stem colors mirrored from StemPlayer's STEM_STYLE
const STEM_COLORS: Record<string, string> = {
  drums: '#ee4444',
  bass: '#6EA556',
  melody: '#FFCC18',
  vocals: '#7CA0CB',
};

const STEM_LABELS: Record<string, string> = {
  drums: 'Drums Stem',
  bass: 'Bass Stem',
  melody: 'Melody Stem',
  vocals: 'Vocals Stem',
};

export default function DAWPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-navy-950 text-sm text-cream-400">
        Loading Studio…
      </div>
    }>
      <DAWContent />
    </Suspense>
  );
}

function DAWContent() {
  const params = useSearchParams();

  // Parse seed library items from URL query params:
  // ?score=/generated/x.mp3&original=/uploads/x.mp3&stems=drums:/stems/id/drums.mp3,...
  const seedItems = useMemo<DAWLibraryItem[]>(() => {
    const items: DAWLibraryItem[] = [];

    const scoreUrl = params.get('score');
    if (scoreUrl) {
      items.push({ id: 'score', label: 'Generated Score', group: 'score', audioUrl: scoreUrl, color: '#ffcc18' });
    }
    const originalUrl = params.get('original');
    if (originalUrl) {
      items.push({ id: 'original', label: 'Original Audio', group: 'original', audioUrl: originalUrl, color: '#7ca0cb' });
    }
    const stemsParam = params.get('stems');
    if (stemsParam) {
      for (const part of stemsParam.split(',')) {
        const idx = part.indexOf(':');
        if (idx < 0) continue;
        const stemId = part.slice(0, idx);
        const url = part.slice(idx + 1);
        items.push({
          id: `stem-${stemId}`,
          label: STEM_LABELS[stemId] ?? `${stemId} Stem`,
          group: 'stems',
          audioUrl: url,
          color: STEM_COLORS[stemId] ?? '#7ca0cb',
        });
      }
    }
    return items;
  }, [params]);

  return <DAW seedItems={seedItems} />;
}
