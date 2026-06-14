import type {
  AnalysisResult,
  VideoAnalysis,
  CompositionPlan,
  MusicSection,
  TimelineSegment,
  EnergyLevel,
} from '@/types';

// ── Constraints (ElevenLabs Music, model music_v1) ───────────────────────────
// Each section must be 3–120s; total track capped at 3 minutes for now.
const MAX_TOTAL_SECONDS = 180;
const MIN_SECTION_SECONDS = 3;
const MAX_SECTION_SECONDS = 120;
const MIN_MS = MIN_SECTION_SECONDS * 1000;
const MAX_MS = MAX_SECTION_SECONDS * 1000;

// Reject any Gemini free-text that describes the picture instead of the sound.
const VISUAL_LEAK =
  /\b(video|scene|shot|frame|footage|depicts|shows|we see|camera|figure|person|man|woman|people|viewer)\b/i;

const ENERGY_RANK: Record<EnergyLevel, number> = { low: 0, medium: 1, high: 2 };

const MAX_GLOBAL_STYLES = 20;
const MAX_STYLE_CHARS = 100;
const MAX_NAME_CHARS = 100;

/** Returns a trimmed, length-capped string only if it is non-empty and sound-only. */
function clean(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (!t || VISUAL_LEAK.test(t)) return undefined;
  return t.length > MAX_STYLE_CHARS ? t.slice(0, MAX_STYLE_CHARS) : t;
}

/**
 * Splits a long style string into ≤2 chunks at a natural comma/semicolon
 * boundary so both pieces stay within MAX_STYLE_CHARS. Used for the
 * musicalRecommendation field which can exceed 100 chars.
 */
function splitStyle(s: string): string[] {
  if (s.length <= MAX_STYLE_CHARS) return [s];
  const mid = Math.floor(s.length / 2);
  const commaIdx = s.lastIndexOf(',', mid);
  const semiIdx = s.lastIndexOf(';', mid);
  const splitAt = Math.max(commaIdx, semiIdx);
  if (splitAt > 10) {
    const a = s.slice(0, splitAt).trim();
    const b = s.slice(splitAt + 1).trim();
    if (a.length <= MAX_STYLE_CHARS && b.length <= MAX_STYLE_CHARS && b.length > 0) {
      return [a, b];
    }
  }
  return [s.slice(0, MAX_STYLE_CHARS)];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Case-insensitive de-duplication, preserving first-seen order; drops empties. */
function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    if (!x) continue;
    const key = x.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(x);
    }
  }
  return out;
}

interface Block {
  durationMs: number;
  seg: TimelineSegment;
}

/**
 * Translates a Gemini AnalysisResult into an ElevenLabs Music composition plan.
 *
 * Idea 1 (structural alignment): one section per timeline arc segment, scaled to
 * the real video length (capped at MAX_TOTAL_SECONDS), with short segments merged
 * and long ones split to satisfy the 3–120s per-section bounds.
 *
 * Idea 3 (richer direction): global + per-section style arrays derived from the
 * existing Gemini fields (no changes to the analyze step). Always instrumental.
 */
export function buildCompositionPlan(result: AnalysisResult): CompositionPlan {
  const { analysis, metadata } = result;
  const { timeline } = analysis;
  const globals = buildGlobalStyles(analysis);

  // 1. Resolve the target total duration (seconds), clamped to [3, MAX_TOTAL].
  const timelineSpan = timeline.reduce(
    (sum, s) => sum + Math.max(0, s.endSeconds - s.startSeconds),
    0
  );
  const rawDuration =
    metadata.durationSeconds && metadata.durationSeconds > 0
      ? metadata.durationSeconds
      : timelineSpan > 0
        ? timelineSpan
        : 30;
  const targetMs = clamp(Math.round(rawDuration), MIN_SECTION_SECONDS, MAX_TOTAL_SECONDS) * 1000;

  // No usable timeline → a single section spanning the whole track.
  if (timeline.length === 0) {
    return {
      positive_global_styles: globals.positive,
      negative_global_styles: globals.negative,
      sections: [
        singleSection('Full score', analysis.mood, analysis.energyLevel, targetMs, 'full arrangement'),
      ],
    };
  }

  // 2. Scale each segment's real duration to the target total.
  let blocks: Block[] = timeline.map((seg) => {
    const segMs = Math.max(0, seg.endSeconds - seg.startSeconds) * 1000;
    const dur = timelineSpan > 0 ? segMs * (targetMs / (timelineSpan * 1000)) : targetMs / timeline.length;
    return { durationMs: Math.round(dur), seg };
  });

  // 3a. Merge sub-3s sections into a neighbour (handles Gemini's short openings).
  const merged: Block[] = [];
  for (const b of blocks) {
    if (b.durationMs < MIN_MS && merged.length > 0) {
      merged[merged.length - 1].durationMs += b.durationMs;
    } else {
      merged.push({ durationMs: b.durationMs, seg: b.seg });
    }
  }
  if (merged.length > 1 && merged[0].durationMs < MIN_MS) {
    merged[1].durationMs += merged[0].durationMs;
    merged.shift();
  }
  blocks = merged;

  // 3b. Split sections over 120s into equal sub-sections sharing the same styles.
  const split: Block[] = [];
  for (const b of blocks) {
    if (b.durationMs > MAX_MS) {
      const parts = Math.ceil(b.durationMs / MAX_MS);
      const each = Math.round(b.durationMs / parts);
      for (let k = 0; k < parts; k++) split.push({ durationMs: each, seg: b.seg });
    } else {
      split.push(b);
    }
  }
  blocks = split;

  // 4. Correct rounding drift onto the last section, keeping it within bounds.
  if (blocks.length > 0) {
    const sum = blocks.reduce((s, b) => s + b.durationMs, 0);
    const last = blocks[blocks.length - 1];
    last.durationMs = clamp(last.durationMs + (targetMs - sum), MIN_MS, MAX_MS);
  }

  // 5. Emit sections with per-section styles (intro / peak / outro hints).
  const peakIdx = blocks.reduce(
    (best, b, i) => (ENERGY_RANK[b.seg.energyLevel] > ENERGY_RANK[blocks[best].seg.energyLevel] ? i : best),
    0
  );
  const sections: MusicSection[] = blocks.map((b, i) => {
    const posHint =
      i === 0
        ? 'gentle introduction, sparse texture'
        : i === blocks.length - 1
          ? 'resolving, settling cadence'
          : i === peakIdx
            ? 'full arrangement, climactic'
            : undefined;
    // transitionToNext from the previous block tells this section how it arrives musically.
    const incomingTransition = i > 0 ? blocks[i - 1].seg.transitionToNext : undefined;
    return buildSection(b.seg, b.durationMs, posHint, i, incomingTransition);
  });

  return {
    positive_global_styles: globals.positive,
    negative_global_styles: globals.negative,
    sections,
  };
}

// Genres that have no rhythm section.
const NO_DRUM_GENRES = new Set(['folk', 'acoustic', 'classical', 'ambient']);

/** A genre-appropriate BASS layer descriptor (always present — never cello as bass). */
function bassLayer(genre: string): string {
  if (genre === 'electronic' || genre === 'dance') return 'deep synth sub-bass';
  if (genre === 'jazz' || genre === 'blues' || genre === 'world') return 'upright acoustic bass';
  if (genre === 'classical' || genre === 'orchestral' || genre === 'cinematic' || genre === 'ambient')
    return 'low cello and contrabass foundation';
  if (genre === 'folk' || genre === 'acoustic') return 'warm acoustic bass';
  return 'electric bass guitar groove';
}

/** A genre-appropriate DRUMS layer descriptor, or null when no rhythm section fits. */
function drumLayer(a: VideoAnalysis): string | null {
  if (a.drumsAppropriate === false) return null;
  if (a.drumStyle === 'none') return null;
  if (a.drumsAppropriate === undefined && NO_DRUM_GENRES.has(a.genre)) return null;
  const g = a.genre;
  if (g === 'electronic' || g === 'dance' || g === 'hip-hop') return 'punchy electronic drum beat';
  if (g === 'lo-fi-hip-hop') return 'relaxed lo-fi drum groove';
  if (g === 'jazz') return 'brushed jazz drum kit';
  if (g === 'orchestral' || g === 'cinematic') return 'cinematic percussion and timpani hits';
  if (NO_DRUM_GENRES.has(g)) return null;
  return 'tight acoustic drum kit';
}

/** A wordless VOCAL texture descriptor when the analysis calls for one, else null. */
function vocalLayer(a: VideoAnalysis): string | null {
  switch (a.vocalPresence) {
    case 'choir-pads':        return 'wordless choir pads';
    case 'backing-harmonies': return 'soft wordless backing vocal harmonies';
    case 'vocal-chops':       return 'rhythmic chopped vocal samples';
    case 'humming':           return 'gentle wordless humming melody';
    case 'scat':              return 'improvised jazz scat vocals';
    default:                  return null;
  }
}

/**
 * Track-wide musical direction. Guarantees a layered arrangement: an explicit
 * BASS layer and a MELODY/HARMONY layer are ALWAYS present (≥2 layers), with
 * DRUMS added when appropriate and a wordless VOCAL texture when the analysis
 * asks for one — so every score carries at least two (usually three) of
 * bass / drums / melody / vocals.
 */
function buildGlobalStyles(a: VideoAnalysis): { positive: string[]; negative: string[] } {
  const drums = drumLayer(a);
  const vocals = vocalLayer(a);

  // Layer descriptors come FIRST so the 20-style cap never drops them.
  const layers = [
    bassLayer(a.genre),                    // bass (always)
    'clear melodic lead',                  // melody (always)
    'rich harmonic texture',               // harmony (always)
    ...(drums ? [drums] : []),             // drums (when appropriate)
    ...(vocals ? [vocals] : []),           // wordless vocals (when appropriate)
  ];

  // musicalRecommendation and sonicTexture can exceed 100 chars — split at a natural boundary.
  const recParts = a.musicalRecommendation
    ? splitStyle(a.musicalRecommendation).filter(p => !VISUAL_LEAK.test(p))
    : [];
  const texPart = clean(a.sonicTexture);

  const positive = dedupe([
    ...layers,
    a.genre,
    a.mood,
    `${a.bpm} BPM`,
    a.keyMode ? `${a.keyMode} key` : '',
    `${a.pace} pace`,
    ...a.instrumentSuggestions.slice(0, 4),
    // Drum and vocal style from Gemini's per-video recommendations
    a.drumsAppropriate && a.drumStyle && a.drumStyle !== 'none'
      ? a.drumStyle.replace(/-/g, ' ')
      : '',
    a.vocalPresence && a.vocalPresence !== 'none'
      ? a.vocalPresence.replace(/-/g, ' ')
      : '',
    texPart ?? '',
    ...recParts,
    clean(a.rhythmicFeel) ?? '',
    clean(a.dynamicArc) ?? '',
  ]).filter(Boolean).slice(0, MAX_GLOBAL_STYLES);

  // Wordless (no lyrics/speech). Only forbid sung vocals entirely when the
  // analysis wants none — otherwise allow the wordless vocal texture above.
  const negative = ['lyrics', 'spoken word'];
  if (!vocals) negative.push('vocals');
  if (a.audioDialogueDominant || a.musicRole === 'background-underscore') {
    negative.push('loud lead melody', 'dense mix');
  }
  if (a.mood === 'calm' || a.energyLevel === 'low') {
    negative.push('harsh distortion', 'aggressive percussion');
  }
  if (a.drumsAppropriate === false) {
    negative.push('drums', 'percussion');
  }

  return { positive, negative: dedupe(negative) };
}

// Maps narrativeRole to a compositional intent hint for the Music API.
const ROLE_HINT: Record<string, string> = {
  'intro':          'gentle introduction',
  'rising action':  'building intensity',
  'climax':         'full arrangement, climactic peak',
  'falling action': 'easing tension',
  'resolution':     'resolving, settling cadence',
};

function buildSection(
  seg: TimelineSegment,
  durationMs: number,
  posHint: string | undefined,
  i: number,
  incomingTransition?: string,
): MusicSection {
  const name = (seg.label?.trim() ? seg.label.trim() : `Section ${i + 1} — ${seg.mood}`).slice(0, MAX_NAME_CHARS);

  const localStyles: string[] = [];

  // Primary: Gemini's per-segment musical brief (instrument, technique, dynamic, texture).
  // e.g. "legato violin section, pp, hushed and introspective with warm cello counterpoint"
  const desc = seg.musicalDescription ? clean(seg.musicalDescription) : undefined;
  if (desc) {
    localStyles.push(desc);
  } else {
    localStyles.push(seg.mood, `${seg.energyLevel} energy`);
  }

  // Narrative role → compositional intent (climax, intro, resolution, etc.)
  if (seg.narrativeRole && ROLE_HINT[seg.narrativeRole]) {
    localStyles.push(ROLE_HINT[seg.narrativeRole]);
  }

  // Incoming transition: how the previous section ended informs how this one begins.
  // e.g. "strings swell to fortissimo climax" arriving into a high-energy section.
  if (incomingTransition) {
    const t = clean(incomingTransition);
    if (t) localStyles.push(t);
  }

  // Outgoing transition: the musical gesture this section makes as it moves to the next.
  // e.g. "gradual ritardando and decrescendo" — tells ElevenLabs how the section should end.
  if (seg.transitionToNext) {
    const t = clean(seg.transitionToNext);
    if (t) localStyles.push(t);
  }

  // Position hint (first-section softness / peak climax / final resolution)
  if (posHint) localStyles.push(posHint);

  return {
    section_name: name,
    positive_local_styles: dedupe(localStyles),
    negative_local_styles: [],
    duration_ms: Math.round(durationMs),
    lines: [],
  };
}

function singleSection(
  name: string,
  mood: string,
  energy: EnergyLevel,
  durationMs: number,
  posHint: string
): MusicSection {
  return {
    section_name: name.slice(0, MAX_NAME_CHARS),
    positive_local_styles: dedupe([mood, `${energy} energy`, posHint]),
    negative_local_styles: [],
    duration_ms: Math.round(durationMs),
    lines: [],
  };
}
