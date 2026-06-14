import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { clerkEnabled } from '@/lib/auth';

// Routes that require a signed-in user. These pages arrive in later phases
// (Projects in Phase D, Mix in Phase E); protecting their paths now is harmless.
const isProtectedRoute = createRouteMatcher([
  '/projects(.*)',
  '/mix(.*)',
  '/api/projects(.*)',
  '/api/folders(.*)',
]);

// When Clerk is not configured, fall back to a no-op so the app still runs.
const middleware = clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    })
  : function passthrough() {
      // No Clerk keys set — let every request through unmodified.
    };

export default middleware;

// Canonical Clerk matcher: run on every route except Next internals and static
// files. Protection is still scoped to gated routes via `isProtectedRoute` above,
// and the whole middleware is a no-op when Clerk is unconfigured. (A narrower
// matcher missed the *bare* /projects path, leaving the page unprotected.)
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|map)).*)',
    '/(api|trpc)(.*)',
  ],
};
