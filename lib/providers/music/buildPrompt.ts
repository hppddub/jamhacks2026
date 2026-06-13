import type { AnalysisResult, TimelineSegment } from '@/types';

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

// Build the per-segment section. Each entry includes duration range, narrative role,
// musical description, and transition to the next segment.
// Format: [0s-12s, intro] soft piano, pp → crescendo. [12s-26s, climax] full brass, fff → decrescendo.
function buildSegmentSection(timeline: AnalysisResult['analysis']['timeline']): string {
  return timeline.map((seg, i) => {
    const start = Math.round(seg.startSeconds);
    const end = Math.round(seg.endSeconds);
    const role = seg.narrativeRole ? `, ${seg.narrativeRole}` : '';
    const t = `[${start}s-${end}s${role}]`;
    const desc = seg.musicalDescription && !VISUAL_LEAK.test(seg.musicalDescription)
      ? seg.musicalDescription
      : `${seg.energyLevel} energy, ${seg.mood}`;
    const isLast = i === timeline.length - 1;
    const trans = !isLast && seg.transitionToNext && !VISUAL_LEAK.test(seg.transitionToNext)
      ? ` → ${seg.transitionToNext}`
      : '';
    return `${t} ${desc}${trans}.`;
  }).join(' ');
}

export function buildPrompt(result: AnalysisResult): string {
  const { analysis } = result;
  const {
    genre, bpm, mood, energyLevel, instrumentSuggestions, timeline,
    colorPalette, settingType, emotionalArc,
    sonicTexture, musicalRecommendation,
    keyMode, rhythmicFeel, dynamicArc, musicRole,
  } = analysis;

  const genreLabel = genre.charAt(0).toUpperCase() + genre.slice(1);
  const instruments = instrumentSuggestions.slice(0, 3).join(', ');
  const closing = MOOD_CLOSING[mood] ?? 'Evocative and resonant.';

  // Core — genre, tempo, energy, key mode
  const keyStr = keyMode ? `, ${keyMode} key` : '';
  const core = `${genreLabel} score, ${bpm} BPM, ${energyLevel} energy${keyStr}.`;

  const roleStr = musicRole ? MUSIC_ROLE_DESCRIPTOR[musicRole] ?? '' : '';

  // Path S: Per-segment musical descriptions from Gemini — most detailed, highest priority.
  // Each segment contributes its own musical brief and transition to the next.
  const hasSegmentDescs = timeline.some(
    s => s.musicalDescription && !VISUAL_LEAK.test(s.musicalDescription)
  );
  if (hasSegmentDescs) {
    const segSection = buildSegmentSection(timeline);
    const parts = [core, roleStr, segSection, `Features ${instruments}.`, closing];
    return assemble(parts);
  }

  // Path A: Gemini gave a clean overall musical recommendation — use as centrepiece.
  if (musicalRecommendation && !VISUAL_LEAK.test(musicalRecommendation)) {
    const arc = emotionalArc && !VISUAL_LEAK.test(emotionalArc)
      ? emotionalArc
      : timeline
          .map((s, i) =>
            i === 0 ? `opens ${s.mood}` : i === timeline.length - 1 ? `resolves ${s.mood}` : `builds ${s.mood}`
          )
          .join(', ');

    const parts = [core, roleStr, musicalRecommendation, `Arc: ${arc}.`, `Features ${instruments}.`, closing];
    return assemble(parts);
  }

  // Path B: Fall back to translating visual properties into sonic descriptors.
  const extras: string[] = [];
  if (rhythmicFeel && !VISUAL_LEAK.test(rhythmicFeel)) extras.push(rhythmicFeel);
  if (dynamicArc && !VISUAL_LEAK.test(dynamicArc)) extras.push(dynamicArc);
  const extraStr = extras.length > 0 ? extras.join('. ') + '.' : '';

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

  const parts = [core, roleStr, sonic, extraStr, shape, `Features ${instruments}.`, closing];
  return assemble(parts);
}

// Build a detailed, full-budget prompt for a single semantic segment.
// Instruments are listed first so ElevenLabs anchors on them across all segments.
// Setting, palette, and emotional arc provide cross-segment tonal consistency.
export function buildSegmentPrompt(
  result: AnalysisResult,
  seg: TimelineSegment,
  isLast: boolean
): string {
  const { analysis } = result;
  const {
    genre, bpm, keyMode, instrumentSuggestions, musicRole,
    rhythmicFeel, settingType, colorPalette, emotionalArc,
  } = analysis;

  const genreLabel = genre.charAt(0).toUpperCase() + genre.slice(1);
  const instruments = instrumentSuggestions.slice(0, 3).join(', ');
  const keyStr = keyMode ? `, ${keyMode} key` : '';
  const roleStr = musicRole ? MUSIC_ROLE_DESCRIPTOR[musicRole] ?? '' : '';

  const segSecs = Math.round(Math.max(seg.endSeconds - seg.startSeconds, 0));
  const narrativeStr = seg.narrativeRole ? ` ${seg.narrativeRole}` : '';

  const musDesc = seg.musicalDescription && !VISUAL_LEAK.test(seg.musicalDescription)
    ? seg.musicalDescription
    : `${seg.energyLevel} energy, ${seg.mood} feel`;

  const transStr = !isLast && seg.transitionToNext && !VISUAL_LEAK.test(seg.transitionToNext)
    ? `Transition: ${seg.transitionToNext}.`
    : '';

  const rhythmStr = rhythmicFeel && !VISUAL_LEAK.test(rhythmicFeel) ? rhythmicFeel + '.' : '';
  const segClosing = MOOD_CLOSING[seg.mood] ?? MOOD_CLOSING[analysis.mood] ?? 'Evocative.';

  // Spatial + tonal anchors — same across all segments for consistency
  const spaceParts: string[] = [];
  if (settingType && SETTING_SONIC[settingType]) spaceParts.push(SETTING_SONIC[settingType]);
  if (colorPalette && PALETTE_SONIC[colorPalette]) spaceParts.push(PALETTE_SONIC[colorPalette]);
  const spaceStr = spaceParts.length > 0 ? spaceParts.join(', ') + '.' : '';

  // Truncated arc context — helps ElevenLabs understand this segment's role in the story
  const arcStr = emotionalArc && !VISUAL_LEAK.test(emotionalArc)
    ? `Arc: ${emotionalArc.slice(0, 60)}.`
    : '';

  const core = `${genreLabel} score, ${bpm} BPM, ${seg.energyLevel} energy${keyStr}.`;
  const featuresStr = `Features ${instruments}. Consistent key throughout.`;
  const section = `${segSecs}s${narrativeStr}: ${musDesc}.`;

  // Priority: core → instruments (anchor) → segment detail → space/mood context → transitions
  const parts = [core, featuresStr, section, spaceStr, roleStr, transStr, arcStr, rhythmStr, segClosing];
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

// Build a prompt for one duration-based chunk of the full score.
// chunkIndex/chunkCount describe the position in the sequence; chunkStart/End are seconds.
// The prompt anchors BPM, key, and instruments consistently across all chunks so the
// ElevenLabs-generated audio can be crossfaded without key/tempo clashes.
export function buildChunkPrompt(
  result: AnalysisResult,
  chunkIndex: number,
  chunkCount: number,
  chunkStartSecs: number,
  chunkEndSecs: number,
): string {
  const { analysis } = result;
  const { timeline, genre, bpm, keyMode, instrumentSuggestions, musicRole, settingType, colorPalette } = analysis;

  const genreLabel = genre.charAt(0).toUpperCase() + genre.slice(1);
  const instruments = instrumentSuggestions.slice(0, 3).join(', ');
  const keyStr = keyMode ? `, ${keyMode} key` : '';
  const chunkSecs = Math.round(chunkEndSecs - chunkStartSecs);

  const overlapping = timeline.filter(
    s => s.endSeconds > chunkStartSecs && s.startSeconds < chunkEndSecs
  );
  const fallback = timeline[Math.floor(timeline.length / 2)] ?? timeline[0];
  const dominant = overlapping.reduce((best, seg) => {
    const ov = Math.min(seg.endSeconds, chunkEndSecs) - Math.max(seg.startSeconds, chunkStartSecs);
    const bv = Math.min(best.endSeconds, chunkEndSecs) - Math.max(best.startSeconds, chunkStartSecs);
    return ov > bv ? seg : best;
  }, overlapping[0] ?? fallback);

  const arcInChunk = overlapping.length > 1
    ? overlapping.map((s, i) => {
        const d = s.musicalDescription && !VISUAL_LEAK.test(s.musicalDescription)
          ? s.musicalDescription
          : `${s.energyLevel} energy ${s.mood}`;
        return i === 0 ? d : `building to ${d}`;
      }).join(', then ')
    : (dominant.musicalDescription && !VISUAL_LEAK.test(dominant.musicalDescription)
        ? dominant.musicalDescription
        : `${dominant.energyLevel} energy, ${dominant.mood} feel`);

  const posLabel = chunkIndex === 0 ? 'opening' : chunkIndex === chunkCount - 1 ? 'closing' : 'development';
  const continuity = chunkCount > 1 ? ' Maintain identical key and BPM across all sections.' : '';
  const roleStr = musicRole ? MUSIC_ROLE_DESCRIPTOR[musicRole] ?? '' : '';

  const spaceParts: string[] = [];
  if (settingType && SETTING_SONIC[settingType]) spaceParts.push(SETTING_SONIC[settingType]);
  if (colorPalette && PALETTE_SONIC[colorPalette]) spaceParts.push(PALETTE_SONIC[colorPalette]);
  const spaceStr = spaceParts.length > 0 ? spaceParts.join(', ') + '.' : '';

  const closing = MOOD_CLOSING[dominant.mood] ?? MOOD_CLOSING[analysis.mood] ?? 'Evocative.';

  const core = `${genreLabel} score, ${bpm} BPM${keyStr}.`;
  const featStr = `Features ${instruments}.${continuity}`;
  const sectionStr = `${chunkSecs}s ${posLabel}: ${arcInChunk}.`;

  return assemble([core, featStr, sectionStr, spaceStr, roleStr, closing]);
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
