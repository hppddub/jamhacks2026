'use client';

import { useState } from 'react';
import type { GeneratedScore } from '@/types';
import { AudioPlayer } from './AudioPlayer';
import { CombinedVideoPlayer } from './CombinedVideoPlayer';

interface ScoreOutputProps {
  score: GeneratedScore;
  /** Object URL of the original video; empty string falls back to audio-only. */
  videoSrc: string;
  /** Browser-playable MP3 of the video's original audio; null when unavailable. */
  originalAudioUrl: string | null;
}

type Tab = 'audio' | 'combined';

/**
 * Tabbed output panel for the generated score:
 *  - "Generated Score" → the score audio on its own (AudioPlayer).
 *  - "Video + Score"   → the original video synced with the generated audio
 *                        (CombinedVideoPlayer), with a bottom-right toggle that
 *                        layers the video's own audio in or mutes it.
 *
 * The toggle only applies to the combined view, so it is hidden on the audio tab.
 * Only the active tab is mounted, which guarantees the inactive player's media is
 * torn down (no overlapping audio when switching tabs).
 */
export function ScoreOutput({ score, videoSrc, originalAudioUrl }: ScoreOutputProps) {
  const hasVideo = videoSrc.length > 0;
  const hasOriginalAudio = originalAudioUrl !== null && originalAudioUrl.length > 0;
  const [tab, setTab] = useState<Tab>('audio');
  const [includeOriginalAudio, setIncludeOriginalAudio] = useState(false);

  // Without a video source the combined tab is unavailable — render audio only.
  if (!hasVideo) {
    return <AudioPlayer src={score.audioUrl} />;
  }

  return (
    <div className="animate-fade-in space-y-4 rounded-xl border border-navy-700 bg-navy-900 p-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-lg border border-navy-700 bg-navy-950/50 p-1">
        {([
          { id: 'audio', label: 'Generated Score' },
          { id: 'combined', label: 'Video + Score' },
        ] as const).map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={active}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#ffcc18] text-navy-950'
                  : 'text-cream-300 hover:bg-navy-800 hover:text-cream-100'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      {tab === 'audio' ? (
        <AudioPlayer src={score.audioUrl} />
      ) : (
        <CombinedVideoPlayer
          videoSrc={videoSrc}
          audioSrc={score.audioUrl}
          originalAudioUrl={hasOriginalAudio ? originalAudioUrl : null}
          includeOriginalAudio={hasOriginalAudio && includeOriginalAudio}
        />
      )}

      {/* Bottom-right toggle — only meaningful for the combined view */}
      {tab === 'combined' && (
        <div className="flex items-center justify-end gap-3 border-t border-navy-800 pt-3">
          <span className={`text-xs ${hasOriginalAudio ? 'text-cream-300' : 'text-cream-500'}`}>
            {hasOriginalAudio ? 'Include original audio' : 'Original video has no usable audio track'}
          </span>
          <button
            role="switch"
            aria-checked={hasOriginalAudio && includeOriginalAudio}
            aria-label="Include original video audio"
            disabled={!hasOriginalAudio}
            onClick={() => setIncludeOriginalAudio((v) => !v)}
            className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              hasOriginalAudio && includeOriginalAudio ? 'bg-[#ffcc18]' : 'bg-navy-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-navy-950 transition-transform ${
                hasOriginalAudio && includeOriginalAudio ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
}
