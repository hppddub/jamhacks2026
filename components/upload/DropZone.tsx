'use client';

import { useCallback, useRef, useState } from 'react';
import { cn, formatFileSize } from '@/lib/utils';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
}

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_BYTES = 100 * 1024 * 1024;

export function DropZone({ onFileSelect }: DropZoneProps) {
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
        tabIndex={0}
        aria-label="Upload video file"
        className={cn(
          'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer p-16 md:p-[80px]',
          /* Light mode — exact from HTML */
          'bg-[#efe3ca] border-[#d2c5ab]',
          /* Light mode hover */
          'hover:border-[#ffcc18] hover:bg-[#fcf6eb]',
          /* Dark mode overrides */
          'dark:bg-navy-900 dark:border-navy-700 dark:hover:border-navy-600 dark:hover:bg-navy-800',
          isDragging && 'border-[#ffcc18] bg-[#ffcc18]/5 scale-[1.01]'
        )}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        {/* Icon circle */}
        <div className={cn(
          'flex h-20 w-20 items-center justify-center rounded-full mb-6',
          isDragging ? 'bg-[#ffcc18]/30' : 'bg-[#ffcc18] dark:bg-navy-800'
        )}>
          <span
            className={cn(
              'material-symbols-outlined !text-4xl select-none',
              isDragging ? 'text-[#ffcc18]' : 'text-[#6f5700] dark:text-cream-300'
            )}
          >
            cloud_upload
          </span>
        </div>

        <h3 className="text-2xl font-semibold text-[#4A3220] dark:text-cream-50 mb-2">
          {isDragging ? 'Drop to upload' : 'Drop your master edit here'}
        </h3>
        <p className="text-base text-[#6B5240] dark:text-cream-300 mb-8">
          MP4, MOV, or ProRes up to 100 MB
        </p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          className="bg-[#ffcc18] text-[#1d2f45] px-12 py-4 rounded-xl text-sm font-bold shadow-lg shadow-[#ffcc18]/20 hover:scale-[1.02] transition-transform"
        >
          Browse Files
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="sr-only"
          onChange={onInputChange}
        />
      </div>

      {validationError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-800/50 bg-red-950/50 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-400">{validationError}</p>
        </div>
      )}
    </div>
  );
}
