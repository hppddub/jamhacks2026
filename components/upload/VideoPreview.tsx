'use client';

import { type RefObject } from 'react';
import { formatFileSize } from '@/lib/utils';

interface VideoPreviewProps {
  file: File;
  objectUrl: string;
  onRemove: () => void;
  disabled?: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
  hideControls?: boolean;
}

export function VideoPreview({ file, objectUrl, onRemove, disabled, videoRef, hideControls }: VideoPreviewProps) {
  const filename = file.name;
  const sizeBytes = file.size;
  const displayName = filename.length > 42 ? `${filename.slice(0, 39)}…` : filename;

  return (
    <div className="animate-fade-in overflow-hidden rounded-xl border border-navy-700 bg-navy-900">
      <video
        ref={videoRef}
        src={objectUrl}
        controls={!hideControls}
        preload="metadata"
        className="w-full max-h-64 bg-black"
      />
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-navy-800">
            <svg
              className="h-4 w-4 text-[#ffcc18]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-cream-50">{displayName}</p>
            <p className="text-xs text-cream-300">{formatFileSize(sizeBytes)}</p>
          </div>
        </div>
        <button
          onClick={onRemove}
          disabled={disabled}
          className="ml-4 flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-cream-200 transition-colors hover:bg-navy-800 hover:text-cream-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
