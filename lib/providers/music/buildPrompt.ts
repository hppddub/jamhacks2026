import type { AnalysisResult } from '@/types';

const MOOD_CLOSINGS: Record<string, string> = {
  dramatic: 'Cinematic, powerful, and emotionally impactful.',
  calm: 'Peaceful, reflective, and serene.',
  energetic: 'Dynamic, driving, and high-energy.',
  emotional: 'Heartfelt, tender, and deeply moving.',
  inspirational: 'Uplifting, hopeful, and motivating.',
  suspenseful: 'Tense, mysterious, and full of anticipation.',
  corporate: 'Professional, polished, and confident.',
  happy: 'Bright, playful, and optimistic.',
};

export function buildPrompt(result: AnalysisResult): string {
  const { analysis } = result;
  const { timeline, genre, bpm, instrumentSuggestions, mood } = analysis;

  // Describe the arc segment by segment
  const arcClauses = timeline.map((seg, i) => {
    if (i === 0) return `beginning with a ${seg.energyLevel}-energy, ${seg.mood} feel`;
    if (i === timeline.length - 1) return `ending with a ${seg.energyLevel}-energy, ${seg.mood} resolution`;
    return `building through a ${seg.energyLevel}-energy, ${seg.mood} section`;
  });

  const arcDescription = arcClauses.join(', ');
  const instrumentList = instrumentSuggestions.slice(0, 4).join(', ');
  const closing = MOOD_CLOSINGS[mood] ?? 'Evocative and emotionally resonant.';

  const prompt =
    `${genre.charAt(0).toUpperCase() + genre.slice(1)} music score, approximately ${bpm} BPM, ` +
    `${arcDescription}. ` +
    `Features ${instrumentList}. ` +
    closing;

  // ElevenLabs description field allows max 1000 chars
  return prompt.slice(0, 1000);
}

export function buildTags(result: AnalysisResult): string[] {
  const { analysis } = result;
  const tags: string[] = [
    analysis.mood,
    analysis.genre,
    analysis.energyLevel + ' energy',
    analysis.pace + ' pace',
    ...analysis.instrumentSuggestions.slice(0, 3),
  ];
  // ElevenLabs allows max 10 tags
  return tags.slice(0, 10);
}
