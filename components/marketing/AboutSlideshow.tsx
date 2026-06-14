'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Per-slide visuals (palette-only, no external assets) ───────────────────

/** Animated energy arc with a sweeping playhead, mirroring the analysis TimelineBar. */
function ArcVisual() {
  const bars = Array.from({ length: 30 }, (_, i) => 0.32 + 0.6 * Math.abs(Math.sin(i * 0.5)));
  return (
    <div className="relative h-full">
      <div className="flex h-full items-end justify-center gap-[3px] px-6 pb-2">
        {bars.map((h, i) => {
          const color = h > 0.74 ? '#FFCC18' : h > 0.5 ? '#fdf3ab' : '#6EA556';
          return (
            <div
              key={i}
              className="w-2 rounded-t-sm"
              style={{ height: `${h * 100}%`, backgroundColor: color }}
            />
          );
        })}
      </div>
      {/* Playhead scrubbing across the arc */}
      <div className="animate-sweep pointer-events-none absolute inset-y-3 w-0.5 rounded-full bg-[#ffcc18] shadow-[0_0_8px_#ffcc18]" />
    </div>
  );
}

/** Live equalizer for the "Compose" step. */
function EqVisual() {
  const bars = Array.from({ length: 34 }, (_, i) => i);
  return (
    <div className="flex h-full items-center justify-center gap-[3px] px-6">
      {bars.map((i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-[#ffcc18] animate-eq"
          style={{ height: '64%', animationDelay: `${(i % 9) * 0.09}s`, opacity: 0.55 + ((i % 5) * 0.09) }}
        />
      ))}
    </div>
  );
}

/** Mock video frame with a play button, a sweeping playhead, and a live waveform. */
function PreviewVisual() {
  const bars = Array.from({ length: 26 }, (_, i) => 0.3 + 0.6 * Math.abs(Math.sin(i * 0.7)));
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="relative aspect-video w-full max-w-[18rem] overflow-hidden rounded-xl bg-navy-950 ring-1 ring-navy-700">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ffcc18] shadow-lg">
            <svg className="ml-0.5 h-5 w-5 text-navy-950" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {/* Sweeping playhead */}
        <div className="animate-sweep pointer-events-none absolute inset-y-0 w-0.5 bg-[#ffcc18]/70" />
        {/* Live waveform along the bottom */}
        <div className="absolute inset-x-3 bottom-3 flex h-6 items-end gap-[2px]">
          {bars.map((h, i) => (
            <div
              key={i}
              className="animate-eq flex-1 rounded-full bg-[#ffcc18]/80"
              style={{ height: `${h * 100}%`, transformOrigin: 'bottom', animationDelay: `${(i % 7) * 0.11}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Stem channels for the "Mix & master" step. */
function StemsVisual() {
  const stems = [
    { c: '#ee4444', l: 'Drums', w: 82 },
    { c: '#6EA556', l: 'Bass', w: 64 },
    { c: '#FFCC18', l: 'Melody', w: 73 },
    { c: '#7CA0CB', l: 'Vocals', w: 48 },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-8">
      {stems.map((s) => (
        <div key={s.l} className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: s.c }} />
          <span className="w-14 flex-shrink-0 text-xs text-cream-200">{s.l}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-800">
            <div
              className="animate-meter h-full rounded-full"
              style={{ width: `${s.w}%`, backgroundColor: s.c, animationDelay: `${stems.indexOf(s) * 0.2}s` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface Slide {
  n: string;
  title: string;
  desc: string;
  visual: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    n: '01',
    title: 'Analyze',
    desc: 'Gemini watches your clip and maps its mood, energy, pace, and the shape of its emotional arc across the whole timeline.',
    visual: <ArcVisual />,
  },
  {
    n: '02',
    title: 'Compose',
    desc: 'The ElevenLabs Music API composes a sectioned, copyright-free instrumental score aligned to that arc.',
    visual: <EqVisual />,
  },
  {
    n: '03',
    title: 'Preview in sync',
    desc: 'Play the generated score against your footage — with or without the original audio — before you commit.',
    visual: <PreviewVisual />,
  },
  {
    n: '04',
    title: 'Mix & master',
    desc: 'Split the score into drums, bass, melody, and vocals, then mix and master it in the built-in studio.',
    visual: <StemsVisual />,
  },
];

export function AboutSlideshow() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  const go = useCallback((i: number) => setIndex((i + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // Respect reduced-motion: no autoplay, instant transitions.
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);

  // Autoplay, paused on hover/focus.
  useEffect(() => {
    if (reduce || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 4500);
    return () => clearInterval(id);
  }, [reduce, paused]);

  return (
    <div
      ref={regionRef}
      role="group"
      aria-roledescription="carousel"
      aria-label="How BananaMOV works"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!regionRef.current?.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      }}
    >
      <div className="overflow-hidden rounded-2xl border border-navy-700 bg-navy-900 shadow-sm">
        <div
          className={`flex ${reduce ? '' : 'transition-transform duration-500 ease-out'}`}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((s, i) => (
            <div
              key={s.n}
              className="w-full flex-shrink-0"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}: ${s.title}`}
              aria-hidden={i !== index}
            >
              <div className="h-44 border-b border-navy-800 bg-navy-950/40">{s.visual}</div>
              <div className="space-y-2 p-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-bold tabular-nums text-gold">{s.n}</span>
                  <h3 className="text-xl font-bold text-cream-50">{s.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-cream-300">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          onClick={prev}
          aria-label="Previous slide"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-cream-300 transition-colors hover:bg-navy-800 hover:text-cream-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.n}
              onClick={() => go(i)}
              aria-label={`Go to ${s.title}`}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-[#ffcc18]' : 'w-2 bg-navy-700 hover:bg-navy-600'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          aria-label="Next slide"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-cream-300 transition-colors hover:bg-navy-800 hover:text-cream-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
