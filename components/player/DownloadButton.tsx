'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import type { GeneratedScore } from '@/types';

interface DownloadButtonProps {
  score: GeneratedScore;
}

export function DownloadButton({ score }: DownloadButtonProps) {
  const { toast } = useToast();
  return (
    <a
      href={score.audioUrl}
      download={score.filename}
      className="block"
      onClick={() => toast('Download started')}
    >
      <Button
        size="lg"
        className="w-full gap-2 border border-navy-700 bg-navy-800 text-cream-50 hover:bg-navy-700"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Download {score.filename}
      </Button>
    </a>
  );
}
