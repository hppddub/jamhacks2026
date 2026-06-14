'use client';

import { useState } from 'react';
import { StemPlayer } from '@/components/player/StemPlayer';
import type { StemResult } from '@/types';

type StemStep = 'idle' | 'separating' | 'done' | 'error';

interface Props {
  projectId: string;
  initialStems: StemResult | null;
}

export function ProjectStemSection({ projectId, initialStems }: Props) {
  const [step, setStep] = useState<StemStep>(initialStems ? 'done' : 'idle');
  const [stems, setStems] = useState<StemResult | null>(initialStems);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function separate() {
    setStep('separating');
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/stems`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Stem separation failed.');
      setStems(data as StemResult);
      setStep('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Stem separation failed.');
      setStep('error');
    }
  }

  if (step === 'done' && stems) {
    return <StemPlayer result={stems} />;
  }

  return (
    <div className="space-y-3">
      {step === 'error' && errorMsg && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          <span>{errorMsg}</span>
          <button
            onClick={separate}
            className="shrink-0 rounded-lg border border-red-700/60 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
          >
            Retry
          </button>
        </div>
      )}

      {step === 'separating' ? (
        <div className="flex items-center gap-3 rounded-xl border border-navy-700 bg-navy-900 px-5 py-4 text-sm text-cream-300">
          <svg
            className="h-4 w-4 animate-spin text-[#ffcc18]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Separating audio stems…
        </div>
      ) : (
        <button
          onClick={separate}
          className="w-full rounded-xl border border-navy-700 bg-navy-900 py-3 text-sm font-semibold text-cream-200 transition-all hover:border-navy-600 hover:bg-navy-800 active:scale-[0.99]"
        >
          Split into Stems →
        </button>
      )}
    </div>
  );
}
