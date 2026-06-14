import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';
import { clerkEnabled } from '@/lib/auth';

export default function SignInPage() {
  return (
    <main className="flex min-h-[calc(100vh-9rem)] items-center justify-center px-6 py-12">
      {clerkEnabled ? (
        <SignIn />
      ) : (
        <div className="max-w-md rounded-xl border border-navy-700 bg-navy-900 p-8 text-center">
          <h1 className="text-xl font-semibold text-cream-50">Sign-in isn&apos;t configured yet</h1>
          <p className="mt-2 text-sm text-cream-300">
            Authentication is disabled because Clerk keys aren&apos;t set. You can still use the{' '}
            <Link href="/studio" className="text-[#ffcc18] underline-offset-2 hover:underline">
              Studio
            </Link>{' '}
            without an account.
          </p>
        </div>
      )}
    </main>
  );
}
