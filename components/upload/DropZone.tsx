'use client';

import { useCallback, useRef, useState } from 'react';
import { cn, formatFileSize } from '@/lib/utils';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
}

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_BYTES = 100 * 1024 * 1024;

export function DropZone({ onFileSelect }: DropZoneProps) {
  const isUploading = false;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type))
      return 'Please upload an MP4, MOV, or WEBM video file.';
    if (file.size > MAX_BYTES)
      return `File too large (${formatFileSize(file.size)}). Maximum is 100 MB.`;
    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) { setValidationError(err); return; }
      setValidationError(null);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-label="Upload video file"
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-16 text-center transition-all duration-200 cursor-pointer',
          isDragging
            ? 'border-[#ffcc18] bg-[#ffcc18]/5 scale-[1.01]'
            : 'border-navy-700 hover:border-navy-600 hover:bg-navy-900/50',
          isUploading && 'opacity-60 cursor-not-allowed pointer-events-none'
        )}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading)
            inputRef.current?.click();
        }}
      >
        {/* Icon circle */}
        <div
          className={cn(
            'mb-5 flex h-16 w-16 items-center justify-center rounded-full transition-colors',
            isDragging ? 'bg-[#ffcc18]/20' : 'bg-navy-800'
          )}
        >
          <svg
            className={cn('h-8 w-8', isDragging ? 'text-[#ffcc18]' : 'text-cream-300')}
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

        {isUploading ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#ffcc18] border-t-transparent" />
              <p className="text-base font-semibold text-cream-50">Uploading…</p>
            </div>
            <p className="text-sm text-cream-200">Please wait</p>
          </>
        ) : (
          <>
            <p className="mb-1.5 text-base font-semibold text-cream-50">
              {isDragging ? 'Drop to upload' : 'Drop your video here'}
            </p>
            <p className="text-sm text-cream-200">or click to browse</p>
            <p className="mt-3 text-xs text-cream-400">MP4 · MOV · WEBM &mdash; up to 100 MB</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="sr-only"
          onChange={onInputChange}
          disabled={isUploading}
        />
      </div>

      {validationError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-800/50 bg-red-950/50 px-4 py-3">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-red-400">{validationError}</p>
        </div>
      )}
    </div>
  );
}
