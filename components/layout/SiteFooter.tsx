import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-navy-800">
      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-10 sm:flex-row sm:justify-between">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/banana-logo.svg" alt="" className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold text-cream-100">BananaMOV</span>
        </Link>

        <nav className="flex items-center gap-5 text-sm text-cream-300 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
          <Link href="/" className="transition-colors hover:text-cream-50">Home</Link>
          <Link href="/studio" className="transition-colors hover:text-cream-50">Studio</Link>
          <a
            href="https://elevenlabs.io"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-cream-50"
          >
            ElevenLabs
          </a>
        </nav>

        <p className="text-xs text-cream-500">
          Built for JamHacks 2026 &middot; Powered by{' '}
          <span className="text-gold">ElevenLabs</span>
        </p>
      </div>
    </footer>
  );
}
