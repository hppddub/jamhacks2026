'use client';

import { DropZone } from '@/components/upload/DropZone';
import { VideoPreview } from '@/components/upload/VideoPreview';
import { AnalysisCard } from '@/components/analysis/AnalysisCard';
import { AudioPlayer } from '@/components/player/AudioPlayer';
import { DownloadButton } from '@/components/player/DownloadButton';
import { StemPlayer } from '@/components/player/StemPlayer';
import { useWorkflow } from '@/hooks/useWorkflow';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  const { step, videoFile, videoObjectUrl, analysis, score, error, stemStep, stems, stemError } = state;

  const isUploading = step === 'uploading';
  const isAnalyzing = step === 'analyzing';
  const isGenerating = step === 'generating';
  const isLoading = isUploading || isAnalyzing || isGenerating;

  const currentOrder = STEP_ORDER[step] ?? -1;

  return (
    <div className="min-h-screen bg-navy-950 text-cream-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-navy-800 bg-navy-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/banana-logo.svg" alt="BananaMOV logo" className="h-8 w-8" />
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
        <section className="space-y-4">
          {!videoFile && !isLoading ? (
            <DropZone onFileSelect={selectFile} />
          ) : videoFile && videoObjectUrl ? (
            <div className="animate-fade-in">
              <VideoPreview
                file={videoFile}
                objectUrl={videoObjectUrl}
                onRemove={removeFile}
                disabled={isLoading}
              />
            </div>
          ) : null}

          {step === 'idle' && videoFile && (
            <div className="animate-fade-in">
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

            <AudioPlayer src={score.audioUrl} />
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
