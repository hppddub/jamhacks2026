import type { AnalysisResult, InstrumentSpec, DrumStyle } from '@/types';

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

// ─── Backend prompt (sent to ElevenLabs) ─────────────────────────────────────
// ElevenLabs enforces a hard 450-character limit on the text field.
// All descriptions are intentionally compact (no Hz ranges).
// Demucs htdemucs_ft separates: drums | bass | vocals | other(melody).
// Instrument names must match what Demucs was trained on so stems route correctly.

const MAX_BACKEND_CHARS = 440; // 10-char safety margin below ElevenLabs' 450 limit

// Budget-aware assembler: adds sections in order, skips any that would exceed budget.
function assembleBackend(sections: (string | null)[]): string {
  let result = '';
  for (const s of sections) {
    if (!s) continue;
    const candidate = result ? `${result}\n${s}` : s;
    if (candidate.length <= MAX_BACKEND_CHARS) result = candidate;
  }
  return result;
}

interface StemSpec {
  instruments: string[];  // short names surfaced in InstrumentSpec / StemPlayer
  description: string;    // compact text used in the ElevenLabs prompt line
}

// DrumStyle → compact Demucs-compatible drum descriptions
const DRUM_SPEC: Record<DrumStyle, StemSpec> = {
  'none':                 { instruments: [], description: '' },
  'acoustic-kit':         { instruments: ['kick drum', 'acoustic snare', 'hi-hat', 'cymbals'],
    description: 'kick drum, acoustic snare, closed hi-hat, crash cymbal' },
  'brushed-jazz':         { instruments: ['brushed snare drum', 'ride cymbal', 'kick drum'],
    description: 'jazz brushes on snare, ride cymbal swing pattern, light kick' },
  'lo-fi-compressed':     { instruments: ['kick drum', 'snare drum', 'hi-hat'],
    description: 'compressed kick drum, dry lo-fi snare, closed hi-hat 8th notes' },
  'electronic-808':       { instruments: ['electronic kick drum', 'electronic clap', 'hi-hat'],
    description: 'electronic kick drum, electronic clap, hi-hat 16th notes' },
  'orchestral-bass-drum': { instruments: ['orchestral bass drum', 'timpani'],
    description: 'orchestral bass drum on downbeats, timpani rolls at climaxes' },
};

// Genre → compact Demucs-compatible bass descriptions.
// ALWAYS electric/upright bass — never cello or bass synth pad.
// null = no dedicated bass instrument for this genre.
const BASS_SPEC: Record<string, StemSpec | null> = {
  'lo-fi-hip-hop': { instruments: ['electric bass guitar'],
    description: 'electric bass guitar, warm plucked tone' },
  'hip-hop':       { instruments: ['electric bass guitar'],
    description: 'electric bass guitar, punchy attack' },
  'pop':           { instruments: ['electric bass guitar'],
    description: 'electric bass guitar, clean bright fingerstyle' },
  'rock':          { instruments: ['electric bass guitar'],
    description: 'electric bass guitar, slightly gritty picked' },
  'indie':         { instruments: ['electric bass guitar'],
    description: 'electric bass guitar, clean fingerstyle' },
  'jazz':          { instruments: ['upright bass'],
    description: 'upright bass, plucked pizzicato' },
  'blues':         { instruments: ['electric bass guitar'],
    description: 'electric bass guitar, warm groove' },
  'r-and-b':       { instruments: ['electric bass guitar'],
    description: 'electric bass guitar, smooth round tone' },
  'electronic':    { instruments: ['synthesizer sub-bass'],
    description: 'synthesizer sub-bass, sustained root notes' },
  'dance':         { instruments: ['synthesizer sub-bass'],
    description: 'synthesizer sub-bass, punchy sustained root' },
  // Bass guitar carries all bass lines — cellos reserved for harmony in melody layer
  'orchestral':    { instruments: ['electric bass guitar'],
    description: 'electric bass guitar deep notes — NOT cello, carries bass lines' },
  'cinematic':     { instruments: ['electric bass guitar'],
    description: 'electric bass guitar, deep sustained notes' },
  'classical':     null,
  'acoustic':      null,
  'folk':          null,
  'ambient':       null,
  'world':         { instruments: ['upright bass'],
    description: 'upright bass, sparse root notes' },
  'punk':          { instruments: ['electric bass guitar'],
    description: 'electric bass guitar, fast driven notes' },
};

// VocalPresence → compact Demucs-compatible vocal descriptions
const VOCAL_SPEC: Record<string, StemSpec> = {
  'none':              { instruments: [], description: '' },
  'choir-pads':        { instruments: ['full choir'],
    description: 'SATB choir, sustained open vowels on chord tones' },
  'backing-harmonies': { instruments: ['backing vocals'],
    description: 'soft backing harmonies, ooh/aah vowels' },
  'vocal-chops':       { instruments: ['vocal samples'],
    description: 'chopped pitched vocal samples, rhythmic' },
  'humming':           { instruments: ['solo voice'],
    description: 'single voice humming continuous melody' },
  'scat':              { instruments: ['scat vocals'],
    description: 'jazz scat singing, rhythmic doo-wah syllables' },
};

// Compact melody instrument translations — no Hz ranges.
// null = belongs in another stem (bass/drums/vocals).
const MELODY_TRANSLATE: Record<string, string | null> = {
  'strings':        'strings section',
  'cello':          'cellos (harmony voices, not bass lines)',
  'violin':         'violin section',
  'viola':          'viola section',
  'piano':          'piano',
  'guitar':         'acoustic guitar',
  'acoustic guitar':'acoustic guitar',
  'electric guitar':'electric guitar',
  'synth':          'synth pad',
  'synthesizer':    'synth pad',
  'flute':          'flute',
  'horn':           'French horn',
  'brass':          'brass section',
  'trumpet':        'trumpet',
  'trombone':       'trombone',
  'organ':          'organ',
  'harp':           'harp',
  'saxophone':      'saxophone',
  'clarinet':       'clarinet',
  'oboe':           'oboe',
  'accordion':      'accordion',
  'marimba':        'marimba',
  'percussion':     'hand percussion',
  'bass':           null,
  'bass guitar':    null,
  'choir':          null,
  'vocals':         null,
  'drums':          null,
  'drum kit':       null,
};

// Display names for genres that need formatting
const GENRE_DISPLAY: Partial<Record<string, string>> = {
  'lo-fi-hip-hop': 'lo-fi hip-hop',
  'hip-hop':       'hip-hop',
  'r-and-b':       'R&B',
};

// Genres with no rhythm section — used when Gemini didn't return drumsAppropriate
const NO_DRUM_GENRES = new Set(['folk', 'acoustic', 'classical', 'ambient']);

// Genre → default drum style (fallback when Gemini omits drumStyle)
const GENRE_DEFAULT_DRUM: Partial<Record<string, DrumStyle>> = {
  'lo-fi-hip-hop': 'lo-fi-compressed',
  'hip-hop':       'electronic-808',
  'pop':           'acoustic-kit',
  'rock':          'acoustic-kit',
  'indie':         'acoustic-kit',
  'blues':         'acoustic-kit',
  'r-and-b':       'acoustic-kit',
  'jazz':          'brushed-jazz',
  'electronic':    'electronic-808',
  'dance':         'electronic-808',
  'punk':          'acoustic-kit',
  'world':         'acoustic-kit',
  'orchestral':    'orchestral-bass-drum',
  'cinematic':     'orchestral-bass-drum',
};

export function buildBackendPrompt(result: AnalysisResult): {
  backendPrompt: string;
  instrumentSpec: InstrumentSpec;
} {
  const { analysis } = result;
  const {
    genre, bpm, mood, energyLevel, keyMode, dynamicArc,
    emotionalArc, timeline, instrumentSuggestions,
    drumsAppropriate, drumStyle: rawDrumStyle, vocalPresence: rawVocalPresence,
    audioDialogueDominant,
  } = analysis;

  // ── Resolve drum style ───────────────────────────────────────────────────────
  const resolvedDrumStyle: DrumStyle | null = (() => {
    if (drumsAppropriate === false) return null;
    if (rawDrumStyle && rawDrumStyle !== 'none') return rawDrumStyle;
    if (rawDrumStyle === 'none') return null;
    if (NO_DRUM_GENRES.has(genre)) return null;
    return GENRE_DEFAULT_DRUM[genre] ?? 'acoustic-kit';
  })();

  const vocalPresence = rawVocalPresence ?? 'none';
  const drumSpec  = resolvedDrumStyle ? DRUM_SPEC[resolvedDrumStyle] : null;
  const bassSpec  = Object.prototype.hasOwnProperty.call(BASS_SPEC, genre)
    ? BASS_SPEC[genre]
    : BASS_SPEC['cinematic'];
  const vocalSpec = VOCAL_SPEC[vocalPresence] ?? VOCAL_SPEC['none'];

  // ── Build melody instrument list ─────────────────────────────────────────────
  const NON_MELODY_KEYS = new Set(['bass', 'bass guitar', 'choir', 'vocals', 'drums', 'drum kit']);
  const melodyNames = instrumentSuggestions
    .filter(s => !NON_MELODY_KEYS.has(s.toLowerCase()))
    .slice(0, 4);
  const melodyDescriptions = melodyNames
    .map(name => {
      const t = MELODY_TRANSLATE[name.toLowerCase()];
      return t === null ? null : (t ?? name);
    })
    .filter((s): s is string => s !== null);

  // ── Build InstrumentSpec (short names for StemPlayer) ───────────────────────
  const instrumentSpec: InstrumentSpec = {
    drums:  drumSpec?.instruments ?? [],
    bass:   bassSpec?.instruments ?? [],
    vocals: vocalSpec.instruments,
    melody: melodyNames,
  };

  // ── Assemble prompt within 440-char budget ───────────────────────────────────
  // Priority order: header → genre/mood → bass (Demucs critical) → drums →
  //   vocals → melody → dynamics → dialogue note → arc
  const genreDisplay = GENRE_DISPLAY[genre] ?? genre;
  const keyStr = keyMode ?? (energyLevel === 'high' ? 'major' : 'minor');
  const header = `[BPM:${bpm}|KEY:${keyStr}]`;

  const arc = emotionalArc
    ?? timeline.map((s, i) =>
        i === 0                     ? `opens ${s.mood}`
        : i === timeline.length - 1 ? `resolves ${s.mood}`
        :                             `builds ${s.mood}`
      ).join(', ');

  const dynLine = dynamicArc
    ?? (energyLevel === 'low' ? 'pp, subtle' : energyLevel === 'high' ? 'mp to ff climax' : 'steady mf');

  const backendPrompt = assembleBackend([
    header,
    `${genreDisplay}, ${mood}, ${energyLevel} energy`,
    bassSpec    ? `BASS: ${bassSpec.description}`                     : null,
    drumSpec?.description ? `DRUMS: ${drumSpec.description}`          : null,
    vocalSpec.description ? `VOCALS: ${vocalSpec.description}`        : null,
    melodyDescriptions.length > 0 ? `MELODY: ${melodyDescriptions.join(', ')}` : null,
    audioDialogueDominant ? 'NOTE: understated, must not compete with dialogue' : null,
    `DYN: ${dynLine}`,
    `ARC: ${arc}`,
  ]);

  return { backendPrompt, instrumentSpec };
}
