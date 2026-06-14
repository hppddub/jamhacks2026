import Link from 'next/link';

interface Feature {
  title: string;
  body: string;
  soon?: boolean;
}

const FEATURES: Feature[] = [
  {
    title: 'Analyze',
    body: "Gemini reads your video's mood, energy, pace, and emotional arc across the full timeline.",
  },
  {
    title: 'Compose',
    body: 'The ElevenLabs Music API generates a sectioned instrumental score aligned to that arc.',
  },
  {
    title: 'Preview in sync',
    body: 'Play the score against your footage — with or without the original audio — before you commit.',
  },
  {
    title: 'Split into stems',
    body: 'Separate the score into drums, bass, melody, and vocals for full creative control.',
  },
  {
    title: 'Save your projects',
    body: 'Keep every generation, named and organized, ready to revisit or refine.',
    soon: true,
  },
  {
    title: 'Mix & master',
    body: 'Shape your track with mixing, mastering, and filter envelopes — coming soon.',
    soon: true,
  },
];

export function FeatureSection() {
  return (
    <section className="mx-auto max-w-5xl space-y-10 px-6 py-24">
      <div className="space-y-3 text-center">
        <span className="text-xs font-medium uppercase tracking-widest text-[#ffcc18]">How it works</span>
        <h2 className="text-3xl font-bold tracking-tight text-cream-50">From clip to score in minutes</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ title, body, soon }) => (
          <div
            key={title}
            className="rounded-xl border border-navy-700 bg-navy-900 p-6 transition-colors hover:border-navy-600"
          >
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-lg font-semibold text-cream-50">{title}</h3>
              {soon && (
                <span className="rounded-full border border-navy-700 bg-navy-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cream-400">
                  Soon
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-cream-300">{body}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <Link
          href="/studio"
          className="rounded-xl bg-[#ffcc18] px-6 py-3 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99]"
        >
          Start scoring →
        </Link>
      </div>
    </section>
  );
}
