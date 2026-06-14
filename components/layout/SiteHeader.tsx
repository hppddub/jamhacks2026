'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeaderAuth } from '@/components/layout/HeaderAuth';
import { clerkEnabled } from '@/lib/auth';
import { cn } from '@/lib/utils';

// Global navigation menu. The Projects link only appears when Clerk is configured
// (it is a gated route); signed-out users clicking it are redirected to sign-in.
const NAV_LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/studio', label: 'Studio' },
  ...(clerkEnabled ? [{ href: '/projects', label: 'Projects' }] : []),
];

export function SiteHeader() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 border-b border-navy-800 bg-navy-950/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/banana-logo.svg" alt="BananaMOV logo" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight text-cream-50">BananaMOV</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                isActive(href)
                  ? 'text-[#ffcc18]'
                  : 'text-cream-300 hover:text-cream-50'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-navy-700 bg-navy-900 px-3 py-1 sm:flex">
            <div className="h-2 w-2 rounded-full bg-[#ffcc18]" />
            <span className="text-xs font-medium text-cream-300">Powered by ElevenLabs</span>
          </div>

          {clerkEnabled && <HeaderAuth />}

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
