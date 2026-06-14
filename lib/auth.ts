/**
 * Whether Clerk authentication is configured.
 *
 * Read from the publishable key so the same constant works in both server and
 * client components (`NEXT_PUBLIC_*` is inlined by the bundler at build time).
 *
 * Phase B guard: when this is false (no Clerk keys set), the app renders WITHOUT
 * `<ClerkProvider>` and the auth UI is hidden, so the project still builds and runs
 * with zero Clerk configuration. The moment real keys are added to `.env.local`,
 * `<ClerkProvider>`, the sign-in/up pages, the header controls, and route
 * protection all activate automatically — no code changes required.
 */
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
