'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { WorkflowState, VideoMetadata, AnalysisResult, GeneratedScore, StemResult, InstrumentSpec } from '@/types';

const defaultState: WorkflowState = {
  step: 'idle',
  videoFile: null,
  videoObjectUrl: null,
  videoDurationSeconds: null,
  uploadedVideoPath: null,
  uploadedMetadata: null,
  originalAudioUrl: null,
  analysis: null,
  score: null,
  error: null,
  stemStep: 'idle',
  stems: null,
  stemError: null,
};

async function extractVideoDuration(file: File): Promise<number | undefined> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const dur = video.duration;
      resolve(Number.isFinite(dur) && dur > 0 ? dur : undefined);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
    video.src = url;
  });
}

async function apiFetch<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as { error?: string } & T;
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed');
  return data;
}

export function useWorkflow() {
  const [state, setState] = useState<WorkflowState>(defaultState);

  // ── Upload ───────────────────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const durationSeconds = await extractVideoDuration(file);
      const form = new FormData();
      form.append('video', file);
      if (durationSeconds !== undefined) form.append('durationSeconds', String(durationSeconds));
      return apiFetch<{
        videoPath: string;
        filename: string;
        sizeBytes: number;
        durationSeconds?: number;
        originalAudioUrl?: string;
      }>('/api/upload', { method: 'POST', body: form });
    },
    onSuccess: (data) => {
      setState((prev) => ({
        ...prev,
        step: 'uploaded',
        uploadedVideoPath: data.videoPath,
        uploadedMetadata: {
          filename: data.filename,
          sizeBytes: data.sizeBytes,
          durationSeconds: data.durationSeconds,
        },
        originalAudioUrl: data.originalAudioUrl ?? null,
        error: null,
      }));
    },
    onError: (err: Error) => {
      setState((prev) => ({ ...prev, step: 'idle', error: err.message }));
    },
  });

  // ── Analyze ──────────────────────────────────────────────────────────────────
  const analyzeMutation = useMutation({
    mutationFn: async (payload: { videoPath: string } & VideoMetadata) => {
      return apiFetch<AnalysisResult>('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      setState((prev) => ({ ...prev, step: 'analyzed', analysis: data, error: null }));
    },
    onError: (err: Error) => {
      setState((prev) => ({ ...prev, step: 'uploaded', error: err.message }));
    },
  });

  // ── Stems ────────────────────────────────────────────────────────────────────
  const stemsMutation = useMutation({
    mutationFn: async (payload: { audioUrl: string; instrumentSpec?: InstrumentSpec }) =>
      apiFetch<StemResult>('/api/stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setState((prev) => ({ ...prev, stemStep: 'stems_ready', stems: data, stemError: null }));
    },
    onError: (err: Error) => {
      setState((prev) => ({ ...prev, stemStep: 'stems_error', stemError: err.message }));
    },
  });

  // ── Generate ─────────────────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async (analysis: AnalysisResult) => {
      return apiFetch<GeneratedScore>('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysis),
      });
    },
    onSuccess: (data) => {
      setState((prev) => ({ ...prev, step: 'completed', score: data, error: null }));
    },
    onError: (err: Error) => {
      setState((prev) => ({ ...prev, step: 'analyzed', error: err.message }));
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  /** Store file in state (preview); does NOT start upload. */
  const selectFile = useCallback((file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setState((prev) => ({
      ...prev,
      step: 'idle',
      videoFile: file,
      videoObjectUrl: objectUrl,
      videoDurationSeconds: null,
      error: null,
    }));

    // Read duration from the video file before upload
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.onloadedmetadata = () => {
      const dur = isFinite(tempVideo.duration) ? tempVideo.duration : null;
      setState((prev) => ({ ...prev, videoDurationSeconds: dur }));
    };
    tempVideo.src = objectUrl;
  }, []);

  /** Clear the selected file and return to empty idle state. */
  const removeFile = useCallback(() => {
    setState((prev) => {
      if (prev.videoObjectUrl) URL.revokeObjectURL(prev.videoObjectUrl);
      return { ...defaultState };
    });
  }, []);

  /** Begin upload of the currently selected file. */
  const upload = useCallback(() => {
    setState((prev) => {
      if (!prev.videoFile) return prev;
      uploadMutation.mutate(prev.videoFile);
      return { ...prev, step: 'uploading', error: null };
    });
  }, [uploadMutation]);

  const analyze = useCallback(() => {
    if (!state.uploadedVideoPath || !state.uploadedMetadata) return;
    setState((prev) => ({ ...prev, step: 'analyzing', error: null }));
    analyzeMutation.mutate({
      videoPath: state.uploadedVideoPath!,
      filename: state.uploadedMetadata!.filename,
      sizeBytes: state.uploadedMetadata!.sizeBytes,
      durationSeconds: state.uploadedMetadata!.durationSeconds,
    });
  }, [state.uploadedVideoPath, state.uploadedMetadata, analyzeMutation]);

  const generate = useCallback(() => {
    if (!state.analysis) return;
    setState((prev) => ({ ...prev, step: 'generating', error: null }));
    generateMutation.mutate(state.analysis!);
  }, [state.analysis, generateMutation]);

  const separateStems = useCallback(() => {
    if (!state.score) return;
    setState((prev) => ({ ...prev, stemStep: 'separating', stemError: null }));
    stemsMutation.mutate({
      audioUrl: state.score.audioUrl,
      instrumentSpec: state.score.instrumentSpec,
    });
  }, [state.score, stemsMutation]);

  const reset = useCallback(() => {
    if (state.videoObjectUrl) URL.revokeObjectURL(state.videoObjectUrl);
    setState(defaultState);
  }, [state.videoObjectUrl]);

  /** Step back one stage, keeping captured data so the user can redo a step. */
  const goBack = useCallback(() => {
    setState((prev) => {
      const back: Partial<Record<WorkflowState['step'], WorkflowState['step']>> = {
        completed: 'analyzed',
        analyzed: 'uploaded',
        uploaded: 'idle',
      };
      const target = back[prev.step];
      if (!target) return prev;
      return { ...prev, step: target, error: null };
    });
  }, []);

  return { state, selectFile, removeFile, upload, analyze, generate, separateStems, reset, goBack };
}
