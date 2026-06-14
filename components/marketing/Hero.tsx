import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-9rem)] max-w-4xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="animate-fade-in flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900 px-4 py-1.5">
        <div className="h-2 w-2 rounded-full bg-[#ffcc18]" />
        <span className="text-xs font-medium text-cream-300">AI video scoring &middot; Powered by ElevenLabs</span>
      </div>

      <h1 className="animate-fade-in text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
        Score your video
        <br />
        with <span className="text-[#ffcc18]">AI</span>
      </h1>

      <p className="animate-fade-in max-w-xl text-lg leading-relaxed text-cream-200">
        BananaMOV analyzes your footage&apos;s mood, energy, and visual arc — then composes a
        custom music score matched to every scene.
      </p>

      <div className="animate-fade-in flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/studio"
          className="rounded-xl bg-[#ffcc18] px-6 py-3 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99]"
        >
          Open the Studio →
        </Link>
        <a
          href="#about"
          className="rounded-xl border border-navy-700 bg-navy-800 px-6 py-3 text-sm font-semibold text-cream-100 transition-colors hover:bg-navy-700"
        >
          Learn more
        </a>
      </div>

      <a
        href="#about"
        aria-label="Scroll to learn more"
        className="absolute bottom-8 text-cream-400 transition-colors hover:text-cream-200"
      >
        <svg className="h-6 w-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </a>
    </section>
  );
}
