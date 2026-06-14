'use client';

import { useState } from 'react';
import { SignInButton, useUser } from '@clerk/nextjs';
import { SaveProjectDialog } from './SaveProjectDialog';
import type { SaveProjectPayload } from '@/types';

interface SaveProjectControlProps {
  base: Omit<SaveProjectPayload, 'name'>;
  defaultName: string;
}

/**
 * Studio-side "Save to project" control. Rendered only when Clerk is configured
 * (see studio page). Signed-out users get a MODAL sign-in so the in-memory
 * generation isn't lost to a full-page redirect; signed-in users open the save
 * dialog.
 */
export function SaveProjectControl({ base, defaultName }: SaveProjectControlProps) {
  const { isLoaded, isSignedIn } = useUser();
  const [dialog, setDialog] = useState<null | 'project' | 'mix'>(null);

  if (!isLoaded) {
    return <div className="h-12" aria-hidden />;
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className="w-full rounded-xl border border-navy-700 bg-navy-800 py-3 text-sm font-semibold text-cream-100 transition-all hover:bg-navy-700 active:scale-[0.99]">
          Sign in to save this project
        </button>
      </SignInButton>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => setDialog('project')}
          className="flex-1 rounded-xl bg-[#ffcc18] py-3 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99]"
        >
          Save to project →
        </button>
        <button
          onClick={() => setDialog('mix')}
          className="flex-1 rounded-xl border border-navy-700 bg-navy-800 py-3 text-sm font-semibold text-cream-100 transition-all hover:bg-navy-700 active:scale-[0.99]"
        >
          Save &amp; open mixing →
        </button>
      </div>
      {dialog && (
        <SaveProjectDialog
          base={base}
          defaultName={defaultName}
          redirectTo={dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
