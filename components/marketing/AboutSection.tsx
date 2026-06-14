export function AboutSection() {
  return (
    <section id="about" className="mx-auto max-w-3xl scroll-mt-24 space-y-5 px-6 py-24">
      <span className="text-xs font-medium uppercase tracking-widest text-[#ffcc18]">About</span>
      <h2 className="text-3xl font-bold tracking-tight text-cream-50">
        The right music, matched to your footage
      </h2>
      <p className="leading-relaxed text-cream-200">
        Finding a score that actually fits a video is slow and expensive. BananaMOV watches your
        clip the way a composer would — reading its mood, pacing, energy, and the shape of its
        emotional arc across the timeline — and turns that understanding into a bespoke instrumental
        track that lands every beat.
      </p>
      <p className="leading-relaxed text-cream-200">
        Under the hood, Google Gemini performs a structured visual and audio analysis, and the
        ElevenLabs Music API composes a sectioned score aligned to your video&apos;s arc. You can
        preview the score against your footage, split it into stems, and download the result — all in
        one place.
      </p>
    </section>
  );
}
