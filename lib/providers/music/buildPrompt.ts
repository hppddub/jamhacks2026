import type { AnalysisResult } from '@/types';

// Sonic shorthand for visual properties — fallback only when Gemini's recommendation is unavailable
const SETTING_SONIC: Record<string, string> = {
  nature:      'acoustic, natural reverb, open space',
  urban:       'electronic, dry urban texture',
  intimate:    'close, dry, intimate room sound',
  cinematic:   'orchestral, spacious hall reverb',
  abstract:    'ambient, atmospheric, textural',
  sports:      'driving percussion, energetic, punchy',
  documentary: 'understated, realistic, subtle score',
};

const PALETTE_SONIC: Record<string, string> = {
  warm:    'warm, lush tones',
  cool:    'cool, crystalline tones',
  dark:    'dark, shadowy timbre',
  bright:  'bright, vibrant timbre',
  neutral: 'balanced, neutral timbre',
};

const MUSIC_ROLE_DESCRIPTOR: Record<string, string> = {
  'background-underscore': 'Composed as a subtle background underscore — restrained, supportive.',
  'featured-score':        'Composed as a featured score — full presence, emotionally centred.',
  'sync-to-action':        'Composed to sync with action beats — rhythmically tight, punchy hits.',
  'ambient-complement':    'Composed as ambient complement — airy, unobtrusive, blends with natural sound.',
};

const MOOD_CLOSING: Record<string, string> = {
  dramatic:     'Powerful and cinematic.',
  calm:         'Peaceful and serene.',
  energetic:    'Driving and propulsive.',
  emotional:    'Tender and moving.',
  inspirational:'Uplifting and hopeful.',
  suspenseful:  'Tense and anticipatory.',
  corporate:    'Polished and confident.',
  happy:        'Bright and optimistic.',
};

// Phrases that indicate Gemini described the scene visually instead of musically
const VISUAL_LEAK = /\b(video|scene|shot|frame|footage|depicts|shows|we see|camera|figure|person|man|woman|people|viewer)\b/i;

const MAX_CHARS = 450;

export function buildPrompt(result: AnalysisResult): string {
  const { analysis } = result;
  const {
    genre, bpm, mood, energyLevel, instrumentSuggestions, timeline,
    colorPalette, settingType, emotionalArc,
    sonicTexture, musicalRecommendation,
    keyMode, rhythmicFeel, dynamicArc, musicRole,
    audioDialogueDominant, soundTexture, volumeDynamics,
  } = analysis;

  const genreLabel = genre.charAt(0).toUpperCase() + genre.slice(1);
  const instruments = instrumentSuggestions.slice(0, 3).join(', ');
  const closing = MOOD_CLOSING[mood] ?? 'Evocative and resonant.';

  // Core — genre, tempo, energy, key mode
  const keyStr = keyMode ? `, ${keyMode} key` : '';
  const core = `${genreLabel} score, ${bpm} BPM, ${energyLevel} energy${keyStr}.`;

  // Musical detail — rhythmic feel + dynamic arc (clean strings only)
  const extras: string[] = [];
  if (rhythmicFeel && !VISUAL_LEAK.test(rhythmicFeel)) extras.push(rhythmicFeel);
  if (dynamicArc && !VISUAL_LEAK.test(dynamicArc)) extras.push(dynamicArc);
  const extraStr = extras.length > 0 ? extras.join('. ') + '.' : '';

  const roleStr = musicRole ? MUSIC_ROLE_DESCRIPTOR[musicRole] ?? '' : '';

  // Audio context — inform ElevenLabs how to coexist with the video's existing audio
  const audioContextParts: string[] = [];
  if (audioDialogueDominant) {
    audioContextParts.push('understated — must not compete with spoken word');
  }
  if (soundTexture === 'sharp') {
    audioContextParts.push('leave space for sharp audio transients');
  } else if (soundTexture === 'layered') {
    audioContextParts.push('blend into a dense, layered audio environment');
  } else if (soundTexture === 'sparse') {
    audioContextParts.push('minimal texture — sparse audio environment');
  }
  if (volumeDynamics === 'building') {
    audioContextParts.push('mirror the building volume arc');
  } else if (volumeDynamics === 'erratic') {
    audioContextParts.push('maintain steady underscoring through erratic audio changes');
  } else if (volumeDynamics === 'dropping') {
    audioContextParts.push('gently fade alongside the dropping audio energy');
  }
  const audioContextStr = audioContextParts.length > 0
    ? `Audio context: ${audioContextParts.join(', ')}.`
    : '';

  // Path A: Gemini gave a clean musical recommendation — use it as the centrepiece.
  // extraStr is intentionally excluded here: musicalRecommendation already carries
  // rhythmic and dynamic detail, and including it would consume budget needed for
  // arc, instruments, and closing.
  if (musicalRecommendation && !VISUAL_LEAK.test(musicalRecommendation)) {
    const arc = emotionalArc && !VISUAL_LEAK.test(emotionalArc)
      ? emotionalArc
      : timeline
          .map((s, i) =>
            i === 0 ? `opens ${s.mood}` : i === timeline.length - 1 ? `resolves ${s.mood}` : `builds ${s.mood}`
          )
          .join(', ');

    const parts = [core, roleStr, audioContextStr, musicalRecommendation, `Arc: ${arc}.`, `Features ${instruments}.`, closing];
    return assemble(parts);
  }

  // Path B: Fall back to translating visual properties into sonic descriptors
  const sonicParts: string[] = [];
  if (sonicTexture && !VISUAL_LEAK.test(sonicTexture)) sonicParts.push(sonicTexture);
  if (settingType && SETTING_SONIC[settingType]) sonicParts.push(SETTING_SONIC[settingType]);
  if (colorPalette && PALETTE_SONIC[colorPalette]) sonicParts.push(PALETTE_SONIC[colorPalette]);
  const sonic = sonicParts.length > 0 ? `Texture: ${sonicParts.join(', ')}.` : '';

  const arcClauses = timeline.map((s, i) =>
    i === 0
      ? `begins ${s.energyLevel}-energy ${s.mood}`
      : i === timeline.length - 1
        ? `resolves ${s.mood}`
        : `builds to ${s.energyLevel}-energy ${s.mood}`
  );
  const shape = `Arc: ${arcClauses.join(', ')}.`;

  const parts = [core, roleStr, audioContextStr, sonic, extraStr, shape, `Features ${instruments}.`, closing];
  return assemble(parts);
}

// Joins parts in order, skipping any part that would push the total over the limit.
// Uses skip-not-break so a single oversized part doesn't silently discard everything after it.
function assemble(parts: string[]): string {
  let result = '';
  for (const part of parts) {
    if (!part) continue;
    const next = result ? `${result} ${part}` : part;
    if (next.length <= MAX_CHARS) result = next;
  }
  return result;
}

export function buildTags(result: AnalysisResult): string[] {
  const { analysis } = result;
  return [
    analysis.mood,
    analysis.genre,
    `${analysis.energyLevel} energy`,
    `${analysis.pace} pace`,
    ...analysis.instrumentSuggestions.slice(0, 3),
  ].slice(0, 10);
}
