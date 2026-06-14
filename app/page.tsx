'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { DropZone } from '@/components/upload/DropZone';
import { VideoPreview } from '@/components/upload/VideoPreview';
import { AnalysisCard } from '@/components/analysis/AnalysisCard';
import { AudioPlayer } from '@/components/player/AudioPlayer';
import { ScoreOutput } from '@/components/player/ScoreOutput';
import { DownloadButton } from '@/components/player/DownloadButton';
import { StemPlayer } from '@/components/player/StemPlayer';
import { useWorkflow } from '@/hooks/useWorkflow';
import { ThemeToggle } from '@/components/ThemeToggle';
import { VideoScorePlayer } from '@/components/player/VideoScorePlayer';
import type { GeneratedScore, StemResult } from '@/types';

function buildDAWUrl(
  score: GeneratedScore,
  originalAudioUrl: string | null,
  stems: StemResult | null,
): string {
  const p = new URLSearchParams();
  p.set('score', score.audioUrl);
  if (originalAudioUrl) p.set('original', originalAudioUrl);
  if (stems) {
    const stemsStr = stems.stems
      .map(s => `${s.id}:${s.audioUrl}`)
      .join(',');
    p.set('stems', stemsStr);
  }
  return `/daw?${p.toString()}`;
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-4 py-16">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-navy-700 border-t-[#ffcc18]" />
      <p className="text-sm text-cream-200">{label}</p>
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
  onReset,
}: {
  message: string;
  onRetry?: () => void;
  onReset: () => void;
}) {
  return (
    <div className="animate-fade-in rounded-xl border border-red-800/60 bg-red-950/40 p-4">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-300">Something went wrong</p>
          <p className="mt-1 text-sm text-red-400/80">{message}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg border border-navy-700 bg-navy-800 px-4 py-2 text-sm text-cream-100 transition-colors hover:bg-navy-700"
          >
            Retry
          </button>
        )}
        <button
          onClick={onReset}
          className="rounded-lg border border-navy-700 bg-navy-800 px-4 py-2 text-sm text-cream-200 transition-colors hover:bg-navy-700 hover:text-cream-100"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}

const STEP_ORDER: Record<string, number> = {
  idle: -1,
  uploading: 0,
  uploaded: 1,
  analyzing: 1.5,
  analyzed: 2,
  generating: 2.5,
  completed: 3,
};

export default function Home() {
  const { state, selectFile, removeFile, upload, analyze, generate, separateStems, reset } = useWorkflow();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { step, videoFile, videoObjectUrl, originalAudioUrl, analysis, score, error, stemStep, stems, stemError } = state;

  const isUploading = step === 'uploading';
  const isAnalyzing = step === 'analyzing';
  const isGenerating = step === 'generating';
  const isLoading = isUploading || isAnalyzing || isGenerating;

  const currentOrder = STEP_ORDER[step] ?? -1;
  const [scoreTab, setScoreTab] = useState<'score' | 'video'>('score');

  return (
    <div className="min-h-screen bg-navy-950 text-cream-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-navy-800 bg-navy-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/banana-logo.svg" alt="BananaMOV logo" width={32} height={32} />
            <span className="text-lg font-bold tracking-tight">BananaMOV</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900 px-3 py-1">
              <div className="h-2 w-2 rounded-full bg-[#ffcc18]" />
              <span className="text-xs font-medium text-cream-300">Powered by ElevenLabs</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">

        {/* Step indicator */}
        {step !== 'idle' && (
          <div className="animate-fade-in flex items-center gap-2">
            {(['Upload', 'Analyze', 'Generate'] as const).map((label, i) => {
              const stepThreshold = i + 1;
              const done = currentOrder > stepThreshold;
              const active = currentOrder >= stepThreshold && currentOrder < stepThreshold + 1;
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && (
                    <div className={`h-px w-8 transition-colors ${done ? 'bg-[#ffcc18]' : 'bg-navy-700'}`} />
                  )}
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      done
                        ? 'bg-[#ffcc18] text-navy-950'
                        : active
                        ? 'border-2 border-[#ffcc18] text-[#ffcc18]'
                        : 'border border-navy-700 text-cream-400'
                    }`}
                  >
                    {done ? (
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-sm transition-colors ${
                      done ? 'text-[#ffcc18]' : active ? 'text-cream-50' : 'text-cream-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
            <button
              onClick={reset}
              disabled={isLoading}
              className="ml-auto text-xs text-cream-400 transition-colors hover:text-cream-200 disabled:cursor-not-allowed"
            >
              Start over
            </button>
          </div>
        )}

        {/* Error banner */}
        {error && !isLoading && (
          <ErrorBanner
            message={error}
            onRetry={step === 'uploaded' ? analyze : step === 'analyzed' ? generate : undefined}
            onReset={reset}
          />
        )}

        {/* Upload section */}
        <section>
          {!videoFile && !isLoading ? (
            <div className="animate-fade-in">
              {/* Hero — exact from HTML reference */}
              <div className="text-center mb-16">
                <h1 className="text-[48px] leading-[1.1] font-bold tracking-[-0.02em] text-[#7CA0CB] dark:text-cream-50 max-w-3xl mx-auto mb-4">
                  Score your video with AI
                </h1>
                <p className="text-lg leading-relaxed text-[#1D2F45] dark:text-cream-200 max-w-2xl mx-auto mb-12">
                  Intelligent energy analysis and mood mapping for cinematic audio synchronization.
                  Transform your visual narrative with procedural scoring that breathes.
                </p>
                {/* Upload zone + decorative blobs */}
                <div className="relative group">
                  <DropZone onFileSelect={selectFile} />
                  {/* Decorative blobs — light mode only */}
                  <div className="dark:hidden absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[120%] opacity-20 pointer-events-none">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-[#745b00] rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#376a23] rounded-full blur-3xl" />
                  </div>
                </div>
              </div>

              {/* Feature grid — exact from HTML reference */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Card 1 — Visual Arc Analysis */}
                <div className="bento-card bg-white dark:bg-navy-900 border border-[#d2c5ab] dark:border-navy-700 p-8 rounded-2xl flex flex-col items-start h-full">
                  <div className="w-12 h-12 bg-[#cfe1fe] dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[#4e6078] dark:text-blue-300">analytics</span>
                  </div>
                  <h4 className="text-2xl font-semibold text-[#1D2F45] dark:text-cream-50 mb-2">Visual Arc Analysis</h4>
                  <p className="text-sm leading-relaxed text-[#7CA0CB] dark:text-cream-400 grow">
                    Our AI maps the emotional intensity of every frame, creating a dynamic energy profile for your entire sequence as well as key climax points.
                  </p>
                  <div className="mt-8 w-full h-24 rounded-lg overflow-hidden bg-[#ffeadd] dark:bg-navy-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Data Analytics" className="w-full h-full object-cover opacity-80" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBIT8OYFoMZ2hPbJ-iUZvPBWeajLUqhnoAfs4qlOUpLJ2h7D_gXpnxKdZbJxb0sy3X7iWva6Js9qpNzVZ9rrUi_OApWfxHT2B-zSBoEHf8zR2B1ERZv0kPXUQt-j9lqQauH4Nwj8d4n4KKCbG5nnmQgkEEUrZrETBlXGeaucPUzuQIJvtY1ZR_BsoSU6wTvL6N4_10TVOxVY9-M3J2P7VfCxW82fjO1X7qJqaN1FSmF-K8RmYwnLK_b4IFxvXw8KbYIedJx_Jph8qg" />
                  </div>
                </div>

                {/* Card 2 — Procedural Scoring */}
                <div className="bento-card bg-white dark:bg-navy-900 border border-[#d2c5ab] dark:border-navy-700 p-8 rounded-2xl flex flex-col items-start h-full">
                  <div className="w-12 h-12 bg-[#a7e28b] dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[#376a23] dark:text-green-300">memory</span>
                  </div>
                  <h4 className="text-2xl font-semibold text-[#1D2F45] dark:text-cream-50 mb-2">Procedural Scoring</h4>
                  <p className="text-sm leading-relaxed text-[#7CA0CB] dark:text-cream-400 grow">
                    Generate unique, copyright-free musical compositions that evolve in real-time based on the pacing and cut-points of your video.
                  </p>
                  <div className="mt-8 w-full h-24 rounded-lg overflow-hidden bg-[#ffeadd] dark:bg-navy-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Procedural Music" className="w-full h-full object-cover opacity-80" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDHCWDaIlIcr345tKhbLWWbqh2xlHmk13E6jtinl2OqCNshOaXzC24vyVYpnvtQmg6-vWu8uhSQHoplStIbjN5HpXeSPjGcCHOnt-2fje_6iM3457immqX3Zi41kgZVv5_2dzicyJa_4iUtMKxUaez5XcuKNe2ZxU-HP5YqGVavRtAa0wqFtkdwHvdvKJJ-5UcFE8fOzzjXrw2cTwTApMIJ7MbR9YddVwk-nUbdkwWty9CAS2558Sp2scytZkrB5U3WHHtufg-b2M" />
                  </div>
                </div>

                {/* Card 3 — Instant Sync */}
                <div className="bento-card bg-white dark:bg-navy-900 border border-[#d2c5ab] dark:border-navy-700 p-8 rounded-2xl flex flex-col items-start h-full">
                  <div className="w-12 h-12 bg-[#ffcc18] dark:bg-[#ffcc18]/20 rounded-xl flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[#745b00] dark:text-[#ffcc18]">sync</span>
                  </div>
                  <h4 className="text-2xl font-semibold text-[#1D2F45] dark:text-cream-50 mb-2">Post Generation Editing</h4>
                  <p className="text-sm leading-relaxed text-[#7CA0CB] dark:text-cream-400 grow">
                    Export your synchronized project or just the generated soundtrack after editing it in our own studio to create the perfect, personalized score.
                  </p>
                  <div className="mt-8 w-full h-24 rounded-lg overflow-hidden bg-[#ffeadd] dark:bg-navy-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Video Sync" className="w-full h-full object-cover opacity-80" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA52cN4XKy7nF49wvsqDuTgvdqDBP9MIs6OCOAm9QezFayG_JAkDbRGvsAz05OVyJREJ1lZt2qC8lqfMaKkAsFlFPCMgPzWaIMc2dsQg8DIxLydLVvxXt65CgNTg2QxHdYLFAtyjHcbb6uaiooQJ8YCkEBnx4TMb6z88OEBk4jjUC1XhMc2uY-hOQEaaHSSmBzR-muiyh27LrhTM_WAJoSyhrFiWxvhc4OG8EmevIqZapkYtxAuvPRb-kyXofMzEYy0WzziKcCTCq0" />
                  </div>
                </div>

              </div>
            </div>
          ) : videoFile && videoObjectUrl ? (
            <div className="animate-fade-in">
              <VideoPreview
                file={videoFile}
                objectUrl={videoObjectUrl}
                onRemove={removeFile}
                disabled={isLoading}
                videoRef={videoRef}
                hideControls={step === 'completed'}
              />
            </div>
          ) : null}

          {step === 'idle' && videoFile && (
            <div className="animate-fade-in mt-4">
              <button
                onClick={upload}
                className="w-full rounded-xl bg-[#ffcc18] py-3 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99]"
              >
                Upload &amp; Continue →
              </button>
            </div>
          )}

          {isUploading && <Spinner label="Uploading video…" />}
        </section>

        {/* Analyze trigger */}
        {step === 'uploaded' && !error && (
          <section className="animate-fade-in">
            <button
              onClick={analyze}
              className="w-full rounded-xl bg-[#ffcc18] py-3 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99]"
            >
              Analyze Video →
            </button>
          </section>
        )}

        {isAnalyzing && <Spinner label="Analyzing video mood, energy & arc…" />}

        {/* Analysis result */}
        {analysis && (step === 'analyzed' || step === 'generating' || step === 'completed') && (
          <section className="animate-fade-in space-y-4">
            <AnalysisCard result={analysis} />

            {step === 'analyzed' && !error && (
              <button
                onClick={generate}
                className="w-full rounded-xl bg-[#ffcc18] py-3 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99]"
              >
                Generate Score →
              </button>
            )}
          </section>
        )}

        {isGenerating && <Spinner label="Composing your score with ElevenLabs…" />}

        {/* Score section */}
        {score && step === 'completed' && (
          <section className="animate-fade-in space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-navy-800" />
              <span className="text-xs font-medium uppercase tracking-widest text-[#ffcc18]">
                Your Score
              </span>
              <div className="h-px flex-1 bg-navy-800" />
            </div>

            <div className="space-y-3 rounded-xl border border-navy-800 bg-navy-900 p-5">
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Mood', value: score.mood },
                  { label: 'Genre', value: score.genre },
                  { label: 'BPM', value: String(score.bpm) },
                  { label: 'Duration', value: `${Math.round(score.durationSeconds)}s` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-navy-700 bg-navy-800 px-3 py-1.5">
                    <span className="text-xs text-cream-300">{label}: </span>
                    <span className="text-xs font-medium capitalize text-cream-100">{value}</span>
                  </div>
                ))}
              </div>

              {score.prompt && (
                <div className="rounded-lg border border-navy-800 bg-navy-950/50 p-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-cream-400">
                    Generation Prompt
                  </p>
                  <p className="text-xs italic leading-relaxed text-cream-200">{score.prompt}</p>
                </div>
              )}
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-lg border border-navy-700 bg-navy-900 p-1">
              <button
                onClick={() => setScoreTab('score')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  scoreTab === 'score'
                    ? 'bg-[#ffcc18] text-navy-950'
                    : 'text-cream-300 hover:text-cream-100'
                }`}
              >
                Score Only
              </button>
              <button
                onClick={() => setScoreTab('video')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  scoreTab === 'video'
                    ? 'bg-[#ffcc18] text-navy-950'
                    : 'text-cream-300 hover:text-cream-100'
                }`}
              >
                Score + Video
              </button>
            </div>

            {scoreTab === 'score' ? (
              <AudioPlayer src={score.audioUrl} />
            ) : (
              videoObjectUrl && (
                <VideoScorePlayer videoUrl={videoObjectUrl} audioSrc={score.audioUrl} />
              )
            )}
            <ScoreOutput
              score={score}
              videoSrc={videoObjectUrl ?? ''}
              originalAudioUrl={originalAudioUrl}
            />
            <DownloadButton score={score} />

            {/* Stem separation */}
            {stemStep === 'idle' && (
              <button
                onClick={separateStems}
                className="w-full rounded-xl border border-navy-700 bg-navy-800 py-3 text-sm font-semibold text-cream-100 transition-all hover:bg-navy-700 active:scale-[0.99]"
              >
                Split into Stems →
              </button>
            )}

            {stemStep === 'separating' && <Spinner label="Separating audio stems…" />}

            {stemStep === 'stems_error' && stemError && (
              <ErrorBanner
                message={stemError}
                onRetry={separateStems}
                onReset={reset}
              />
            )}

            {stemStep === 'stems_ready' && stems && (
              <StemPlayer result={stems} />
            )}

            {stemStep === 'stems_ready' && stems && score && (
              <Link
                href={buildDAWUrl(score, originalAudioUrl, stems)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#ffcc18]/40 bg-[#ffcc18]/10 py-3 text-sm font-semibold text-[#ffcc18] transition-all hover:bg-[#ffcc18]/20 active:scale-[0.99]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Open in BananaMOV Studio →
              </Link>
            )}

            <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-4 text-center">
              <p className="text-sm text-cream-300">
                Happy with your score?{' '}
                <button
                  onClick={reset}
                  className="text-[#ffcc18] underline-offset-2 hover:underline"
                >
                  Score another video
                </button>
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-navy-800 py-8 text-center">
        <p className="text-xs text-cream-500">
          Built for JamHacks 2026 &middot; Powered by{' '}
          <span className="text-cream-400">ElevenLabs</span>
        </p>
      </footer>
    </div>
  );
}
