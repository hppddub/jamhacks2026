import { AboutSlideshow } from './AboutSlideshow';

export function AboutSection() {
  return (
    <section id="about" className="mx-auto max-w-3xl scroll-mt-[65px] space-y-6 px-6 pb-24 pt-12">
      <div className="space-y-5 text-center">
        <span className="inline-flex items-center rounded-full bg-[#243d5c] px-3 py-1 text-xs font-medium uppercase tracking-widest text-[#ffcc18] ring-1 ring-[#ffcc18]/25">
          About
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-cream-50">
          The right music, matched to your footage
        </h2>
        <p className="mx-auto max-w-2xl leading-relaxed text-cream-200">
          Finding a score that actually fits a video is slow and expensive. BananaMOV watches your
          clip the way a composer would, then turns that understanding into a bespoke instrumental
          track that lands every beat — analyze, compose, preview, and mix, all in one place.
        </p>
      </div>

      <AboutSlideshow />

      <div className="flex justify-center pt-6">
        <a
          href="#how-it-works"
          aria-label="Scroll to how it works"
          className="text-cream-400 transition-colors hover:text-cream-200"
        >
          <svg className="h-6 w-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </a>
      </div>
    </section>
  );
}
