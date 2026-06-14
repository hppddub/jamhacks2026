'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { DAWProject } from '@/types/daw';

interface SaveMasterArgs {
  projectId: string;
  blob: Blob; // rendered master (WAV)
  mixState: DAWProject; // full DAW project, persisted to projects.mix_state
}

async function postMaster({ projectId, blob, mixState }: SaveMasterArgs): Promise<void> {
  const form = new FormData();
  form.append('master', blob, 'master.wav');
  form.append('mixState', JSON.stringify(mixState));
  const res = await fetch(`/api/projects/${projectId}/master`, { method: 'POST', body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Failed to save master.');
  }
}

/** Renders→saves the master mix to a project and persists the DAW session to mix_state. */
export function useSaveMaster() {
  const router = useRouter();
  return useMutation({ mutationFn: postMaster, onSuccess: () => router.refresh() });
}
