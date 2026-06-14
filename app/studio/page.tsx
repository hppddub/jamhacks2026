'use client';

import Link from 'next/link';
import { DropZone } from '@/components/upload/DropZone';
import { VideoPreview } from '@/components/upload/VideoPreview';
import { AnalysisCard } from '@/components/analysis/AnalysisCard';
import { ScoreOutput } from '@/components/player/ScoreOutput';
import { DownloadButton } from '@/components/player/DownloadButton';
import { StemPlayer } from '@/components/player/StemPlayer';
import { SaveProjectControl } from '@/components/projects/SaveProjectControl';
import { useWorkflow } from '@/hooks/useWorkflow';
import type { GeneratedScore, StemResult } from '@/types';
import { clerkEnabled } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { validateVideoFile } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

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

function Spinner({ label, steps, hint }: { label: string; steps?: string[]; hint?: string }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!steps || steps.length <= 1) return;
    const id = setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length);
    }, 2600);
    return () => clearInterval(id);
  }, [steps]);

  return (
    <div
      className="animate-fade-in flex flex-col items-center gap-4 py-16"
      role="status"
      aria-live="polite"
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-navy-700 border-t-[#ffcc18]" />
      <p className="text-sm font-medium text-cream-100">{label}</p>

      {/* Indeterminate progress bar */}
      <div className="relative h-1 w-56 max-w-full overflow-hidden rounded-full bg-navy-800">
        <div className="animate-indeterminate absolute inset-y-0 left-0 w-1/4 rounded-full bg-[#ffcc18]" />
      </div>

      {steps && steps.length > 0 && (
        <p key={stepIndex} className="animate-fade-in text-xs text-cream-300">
          {steps[stepIndex]}
        </p>
      )}
      {hint && <p className="text-xs text-cream-500">{hint}</p>}
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
    <div role="alert" className="animate-fade-in rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800/60 dark:bg-red-950/40">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
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
          <p className="text-sm font-medium text-red-800 dark:text-red-300">Something went wrong</p>
          <p className="mt-1 text-sm text-red-700/90 dark:text-red-400/80">{message}</p>
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

export default function Studio() {
  const { state, selectFile, removeFile, upload, analyze, generate, separateStems, reset, goBack } = useWorkflow();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const {
    step, videoFile, videoObjectUrl, originalAudioUrl, uploadedVideoPath, uploadedMetadata,
    analysis, score, error, stemStep, stems, stemError,
  } = state;

  const isUploading = step === 'uploading';
  const isAnalyzing = step === 'analyzing';
  const isGenerating = step === 'generating';
  const isLoading = isUploading || isAnalyzing || isGenerating;
  const stemSeparating = stemStep === 'separating';
  const canGoBack = !isLoading && !stemSeparating && (step === 'uploaded' || step === 'analyzed' || step === 'completed');

  const currentOrder = STEP_ORDER[step] ?? -1;

  // Warn before leaving while work is in flight (state is in-memory only).
  useEffect(() => {
    if (!isLoading && !stemSeparating) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isLoading, stemSeparating]);

  // Full-window drag-and-drop overlay (only on the empty upload screen).
  const [isFileDragging, setIsFileDragging] = useState(false);
  const canDropGlobally = !videoFile && !isLoading;
  useEffect(() => {
    if (!canDropGlobally) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onEnter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setIsFileDragging(true); } };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onLeave = () => { depth = Math.max(0, depth - 1); if (depth === 0) setIsFileDragging(false); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setIsFileDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const err = validateVideoFile(file);
      if (err) { toast(err, 'error'); return; }
      selectFile(file);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [canDropGlobally, selectFile, toast]);

  // Celebrate completion and stem readiness with a toast.
  useEffect(() => {
    if (step === 'completed') toast('Your score is ready 🎵');
  }, [step, toast]);
  useEffect(() => {
    if (stemStep === 'stems_ready') toast('Stems separated');
  }, [stemStep, toast]);

  const copyPrompt = async () => {
    if (!score?.prompt) return;
    try {
      await navigator.clipboard.writeText(score.prompt);
      toast('Prompt copied to clipboard');
    } catch {
      toast('Could not copy prompt', 'error');
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      {/* Full-window drag overlay */}
      {isFileDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm">
          <div className="m-6 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-[#ffcc18] bg-navy-900/60 px-12 py-16 text-center">
            <span className="material-symbols-outlined !text-5xl text-[#ffcc18]">cloud_upload</span>
            <p className="text-lg font-semibold text-cream-50">Drop your video to upload</p>
            <p className="text-sm text-cream-300">MP4, MOV, or WEBM · up to 100 MB</p>
          </div>
        </div>
      )}

      {/* Hero — idle only */}
      {step === 'idle' && (
        <div className="animate-fade-in space-y-3 pb-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Score your video with AI</h1>
          <p className="mx-auto max-w-xl leading-relaxed text-cream-200">
            Upload any video and BananaMOV will analyze its mood, energy, and visual arc —
            then generate a custom music score perfectly matched to every scene.
          </p>
        </div>
      )}

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
                        ? 'border-2 border-[#ffcc18] text-[#ffcc18] ring-4 ring-[#ffcc18]/20 animate-pulse'
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
            <div className="ml-auto flex items-center gap-3">
              {canGoBack && (
                <button
                  onClick={goBack}
                  className="flex items-center gap-1 text-xs text-cream-400 transition-colors hover:text-cream-200"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
              <button
                onClick={reset}
                disabled={isLoading}
                className="text-xs text-cream-400 transition-colors hover:text-cream-200 disabled:cursor-not-allowed"
              >
                Start over
              </button>
            </div>
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
                <h1 className="font-display text-[clamp(2rem,7vw,3rem)] leading-[1.1] font-extrabold tracking-[-0.02em] text-[#4A3220] dark:text-cream-50 max-w-3xl mx-auto mb-4">
                  Score your video with AI
                </h1>
                <p className="text-lg leading-relaxed text-[#6B5240] dark:text-cream-200 max-w-2xl mx-auto mb-12">
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
                  {/* Decorative glow — dark mode only */}
                  <div className="hidden dark:block absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[140%] pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-56 h-56 bg-[#ffcc18] rounded-full blur-[120px] opacity-[0.12]" />
                    <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#7CA0CB] rounded-full blur-[120px] opacity-[0.14]" />
                  </div>
                </div>
              </div>

              {/* Feature grid — full-bleed band, content capped for large screens */}
              <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-6">
               <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Card 1 — Visual Arc Analysis */}
                <div className="bento-card bg-white dark:bg-navy-900 border border-[#d2c5ab] dark:border-navy-700 p-8 rounded-2xl flex flex-col items-start h-full">
                  <div className="w-12 h-12 bg-[#cfe1fe] dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[#4e6078] dark:text-blue-300">analytics</span>
                  </div>
                  <h4 className="font-display text-2xl font-bold text-[#4A3220] dark:text-cream-50 mb-2">Visual Arc Analysis</h4>
                  <p className="text-sm leading-relaxed text-[#6B5240] dark:text-cream-400 grow">
                    Our AI maps the emotional intensity of every frame, creating a dynamic energy profile for your entire sequence as well as key climax points.
                  </p>
                  <div className="mt-8 w-full h-24 rounded-lg overflow-hidden bg-gradient-to-br from-[#fff3e6] to-[#ffe2cc] dark:from-navy-800 dark:to-navy-950 border border-black/5 dark:border-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Energy arc analysis chart" className="w-full h-full object-cover" src="/feature-arc.svg" />
                  </div>
                </div>

                {/* Card 2 — Procedural Scoring */}
                <div className="bento-card bg-white dark:bg-navy-900 border border-[#d2c5ab] dark:border-navy-700 p-8 rounded-2xl flex flex-col items-start h-full">
                  <div className="w-12 h-12 bg-[#a7e28b] dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[#376a23] dark:text-green-300">memory</span>
                  </div>
                  <h4 className="font-display text-2xl font-bold text-[#4A3220] dark:text-cream-50 mb-2">Procedural Scoring</h4>
                  <p className="text-sm leading-relaxed text-[#6B5240] dark:text-cream-400 grow">
                    Generate unique, copyright-free musical compositions that evolve in real-time based on the pacing and cut-points of your video.
                  </p>
                  <div className="mt-8 w-full h-24 rounded-lg overflow-hidden bg-gradient-to-br from-[#fff3e6] to-[#ffe2cc] dark:from-navy-800 dark:to-navy-950 border border-black/5 dark:border-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Procedural music equalizer" className="w-full h-full object-cover" src="/feature-score.svg" />
                  </div>
                </div>

                {/* Card 3 — Instant Sync */}
                <div className="bento-card bg-white dark:bg-navy-900 border border-[#d2c5ab] dark:border-navy-700 p-8 rounded-2xl flex flex-col items-start h-full">
                  <div className="w-12 h-12 bg-[#ffcc18] dark:bg-[#ffcc18]/20 rounded-xl flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[#745b00] dark:text-[#ffcc18]">sync</span>
                  </div>
                  <h4 className="font-display text-2xl font-bold text-[#4A3220] dark:text-cream-50 mb-2">Post Generation Editing</h4>
                  <p className="text-sm leading-relaxed text-[#6B5240] dark:text-cream-400 grow">
                    Export your synchronized project or just the generated soundtrack after editing it in our own studio to create the perfect, personalized score.
                  </p>
                  <div className="mt-8 w-full h-24 rounded-lg overflow-hidden bg-gradient-to-br from-[#fff3e6] to-[#ffe2cc] dark:from-navy-800 dark:to-navy-950 border border-black/5 dark:border-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Audio mixing sliders" className="w-full h-full object-cover" src="/feature-edit.svg" />
                  </div>
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

        {isAnalyzing && (
          <Spinner
            label="Analyzing your video"
            steps={[
              'Reading frames and detecting scene cuts…',
              'Mapping the energy & emotional arc…',
              'Listening to the audio track…',
              'Composing musical recommendations…',
            ]}
            hint="This can take up to a minute for longer clips."
          />
        )}

        {/* Analysis result */}
        {analysis && (step === 'analyzed' || step === 'generating' || step === 'completed') && (
          <section className="animate-fade-in space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-navy-800" />
              <span className="text-xs font-medium uppercase tracking-widest text-[#BD9A1F] dark:text-[#ffcc18]">
                Your Analysis
              </span>
              <div className="h-px flex-1 bg-navy-800" />
            </div>

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

        {isGenerating && (
          <Spinner
            label="Composing your score"
            steps={[
              'Translating the arc into a composition plan…',
              'Generating audio with ElevenLabs…',
              'Mixing and mastering the track…',
            ]}
            hint="Crafting an original, copyright-free score."
          />
        )}

        {/* Score section */}
        {score && step === 'completed' && (
          <section className="animate-fade-in space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-navy-800" />
              <span className="text-xs font-medium uppercase tracking-widest text-[#BD9A1F] dark:text-[#ffcc18]">
                Your Score
              </span>
              <div className="h-px flex-1 bg-navy-800" />
            </div>

            <div className="panel-elevate animate-score-reveal space-y-3 rounded-xl border border-navy-800 bg-navy-900 p-5">
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
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-cream-400">
                      Generation Prompt
                    </p>
                    <button
                      onClick={copyPrompt}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-cream-400 transition-colors hover:bg-navy-800 hover:text-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcc18]"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <p className="text-xs italic leading-relaxed text-cream-200">{score.prompt}</p>
                </div>
              )}
            </div>

            <ScoreOutput
              score={score}
              videoSrc={videoObjectUrl ?? ''}
              originalAudioUrl={originalAudioUrl}
            />
            <DownloadButton score={score} />

            {/* Save to project (requires Clerk + a signed-in user) */}
            {clerkEnabled && analysis && uploadedVideoPath && uploadedMetadata && (
              <SaveProjectControl
                base={{
                  analysis,
                  score,
                  stems,
                  originalAudioUrl,
                  videoPath: uploadedVideoPath,
                  videoFilename: uploadedMetadata.filename,
                }}
                defaultName={`${score.mood.charAt(0).toUpperCase()}${score.mood.slice(1)} ${score.genre}`}
              />
            )}

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-navy-800" />
              <span className="text-xs font-medium uppercase tracking-widest text-[#BD9A1F] dark:text-[#ffcc18]">
                Your Stems
              </span>
              <div className="h-px flex-1 bg-navy-800" />
            </div>

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
                  className="text-[#BD9A1F] underline-offset-2 hover:underline dark:text-[#ffcc18]"
                >
                  Score another video
                </button>
              </p>
            </div>
          </section>
        )}
      </main>
  );
}
