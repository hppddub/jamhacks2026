'use client';

import { SignInButton, UserButton, useUser } from '@clerk/nextjs';

/**
 * Header auth control. Rendered only when Clerk is configured (see SiteHeader),
 * so it can safely call Clerk hooks. In Clerk v7 the <SignedIn>/<SignedOut>
 * control components are server-only, so a client header branches on useUser().
 */
export function HeaderAuth() {
  const { isLoaded, isSignedIn } = useUser();

  // Reserve space while Clerk loads to avoid a layout shift.
  if (!isLoaded) {
    return <div className="h-8 w-16" aria-hidden />;
  }

  if (isSignedIn) {
    return <UserButton />;
  }

  return (
    <SignInButton mode="redirect">
      <button className="rounded-lg border border-navy-700 bg-navy-800 px-3 py-1.5 text-sm font-medium text-cream-100 transition-colors hover:bg-navy-700">
        Sign in
      </button>
    </SignInButton>
  );
}
