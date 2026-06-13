import { GoogleGenAI, FileState, createUserContent, createPartFromUri } from '@google/genai';
import type { VideoAnalysisProvider } from '../types';
import type {
  AnalysisResult,
  VideoAnalysis,
  VideoMetadata,
  Mood,
  EnergyLevel,
  Pace,
  TimelineSegment,
  ColorPalette,
  CameraStyle,
  VisualPace,
  SettingType,
  AudioEnergyLevel,
  MusicRole,
} from '@/types';
import { delay } from '@/lib/utils';

const VALID_MOODS: readonly Mood[] = [
  'inspirational', 'emotional', 'dramatic', 'energetic',
  'suspenseful', 'corporate', 'happy', 'calm',
];
const VALID_ENERGY: readonly EnergyLevel[] = ['low', 'medium', 'high'];
const VALID_PACES: readonly Pace[] = ['slow', 'moderate', 'fast'];
const VALID_GENRES = ['cinematic', 'electronic', 'acoustic', 'orchestral', 'ambient', 'jazz'];
const VALID_PALETTES: readonly ColorPalette[] = ['warm', 'cool', 'dark', 'bright', 'neutral'];
const VALID_CAMERA: readonly CameraStyle[] = ['static', 'smooth', 'handheld', 'dynamic'];
const VALID_VISUAL_PACE: readonly VisualPace[] = ['slow-cuts', 'moderate-cuts', 'fast-cuts'];
const VALID_SETTINGS: readonly SettingType[] = ['nature', 'urban', 'intimate', 'cinematic', 'abstract', 'sports', 'documentary'];
const VALID_AUDIO_ENERGY: readonly AudioEnergyLevel[] = ['silent', 'quiet', 'moderate', 'loud'];
const VALID_MUSIC_ROLES: readonly MusicRole[] = ['background-underscore', 'featured-score', 'sync-to-action', 'ambient-complement'];

function toMood(v: unknown): Mood {
  return VALID_MOODS.includes(v as Mood) ? (v as Mood) : 'emotional';
}
function toEnergy(v: unknown): EnergyLevel {
  return VALID_ENERGY.includes(v as EnergyLevel) ? (v as EnergyLevel) : 'medium';
}
function toPace(v: unknown): Pace {
  return VALID_PACES.includes(v as Pace) ? (v as Pace) : 'moderate';
}
function toGenre(v: unknown): string {
  return VALID_GENRES.includes(v as string) ? (v as string) : 'cinematic';
}
function toColorPalette(v: unknown): ColorPalette | undefined {
  return VALID_PALETTES.includes(v as ColorPalette) ? (v as ColorPalette) : undefined;
}
function toCameraStyle(v: unknown): CameraStyle | undefined {
  return VALID_CAMERA.includes(v as CameraStyle) ? (v as CameraStyle) : undefined;
}
function toVisualPace(v: unknown): VisualPace | undefined {
  return VALID_VISUAL_PACE.includes(v as VisualPace) ? (v as VisualPace) : undefined;
}
function toSettingType(v: unknown): SettingType | undefined {
  return VALID_SETTINGS.includes(v as SettingType) ? (v as SettingType) : undefined;
}
function toAudioEnergyLevel(v: unknown): AudioEnergyLevel | undefined {
  return VALID_AUDIO_ENERGY.includes(v as AudioEnergyLevel) ? (v as AudioEnergyLevel) : undefined;
}
function toMusicRole(v: unknown): MusicRole | undefined {
  return VALID_MUSIC_ROLES.includes(v as MusicRole) ? (v as MusicRole) : undefined;
}
function toNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : raw.trim();
}

const MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

const ANALYSIS_PROMPT = `Analyze this video carefully and return ONLY a raw JSON object — no markdown fences, no explanation.

{
  "videoDurationSeconds": <total video duration as a number>,
  "mood": "<inspirational | emotional | dramatic | energetic | suspenseful | corporate | happy | calm>",
  "energyLevel": "<low | medium | high>",
  "pace": "<slow | moderate | fast>",
  "bpm": <integer 60-160 — music tempo that matches the video energy>,
  "genre": "<cinematic | electronic | acoustic | orchestral | ambient | jazz>",
  "sceneCount": <integer — estimated number of distinct scene cuts>,
  "motionScore": <float 0.0-1.0 — overall motion intensity>,
  "instrumentSuggestions": ["<instrument>", "<instrument>"] (2-4 instruments that suit the video's feel),
  "analysisSummary": "<1-2 sentences describing the video's emotional arc and visual style>",
  "colorPalette": "<warm | cool | dark | bright | neutral — dominant color grading tone>",
  "cameraStyle": "<static | smooth | handheld | dynamic — primary camera movement style>",
  "visualPace": "<slow-cuts | moderate-cuts | fast-cuts — editing rhythm based on cut frequency>",
  "settingType": "<nature | urban | intimate | cinematic | abstract | sports | documentary>",
  "emotionalArc": "<one vivid sentence describing the emotional journey from the video's opening to its end>",
  "sonicTexture": "<SOUND ONLY — no visual references. 8-12 words on sonic density, reverb, and warmth. e.g. 'rich, layered orchestral texture with spacious hall reverb and warm brass'>",
  "musicalRecommendation": "<MUSIC ONLY — never describe what is seen. One sentence naming specific instruments, dynamics, and emotional quality of the sound. e.g. 'A soaring orchestral swell with French horns and full strings, building from gentle arpeggios to a triumphant fortissimo climax.'>",
  "keyMode": "<major | minor | modal>",
  "rhythmicFeel": "<5-8 words on rhythmic character — e.g. 'driving, syncopated eighth notes' or 'flowing, legato triplet pulse'>",
  "dynamicArc": "<5-8 words on how intensity evolves using dynamic markings — e.g. 'pp whisper building to fff climax' or 'sustained forte with brief mp lulls'>",
  "existingAudio": "<LISTEN to the audio track. Describe in 8-15 words what sounds are audible — e.g. 'crowd chatter and ambient noise', 'dialogue and occasional laughter', 'explosions and action sound effects', 'background music and nature sounds', or 'no audible sound'>",
  "audioEnergyLevel": "<silent | quiet | moderate | loud — overall prominence of existing audio in the video>",
  "musicRole": "<background-underscore | featured-score | sync-to-action | ambient-complement — how the composed score should relate to the existing audio: background-underscore if audio is loud/prominent (score sits quietly underneath), featured-score if audio is silent/quiet (score takes centre stage), sync-to-action if there are sound effects to hit (score syncs to beats), ambient-complement if there is ambient or natural sound (score enhances without competing)>",
  "timeline": [
    {
      "startSeconds": <number>,
      "endSeconds": <number>,
      "mood": "<one of the mood values above>",
      "energyLevel": "<low | medium | high>",
      "label": "<short descriptive label for this segment>"
    }
  ]
}

Rules:
- timeline must have 3-5 segments that together span 0 to videoDurationSeconds with no gaps
- Each segment endSeconds equals the next segment startSeconds; the last endSeconds equals videoDurationSeconds
- bpm: low energy → 60-90, medium → 90-120, high → 120-160
- colorPalette: observe the dominant grade — warm (golden/amber/red tones), cool (blue/teal), dark (low-key/shadows), bright (high-key/saturated), neutral (balanced/desaturated)
- cameraStyle: static (locked off), smooth (gimbal/dolly), handheld (organic shake), dynamic (mixed fast movement)
- visualPace: slow-cuts (<1 cut per 4s), moderate-cuts (1 cut per 1-4s), fast-cuts (>1 cut per second)
- emotionalArc: be specific — name the feeling at the start and how it transforms by the end
- sonicTexture: SOUND ONLY — no mention of people, places, or visuals. Describe only how the music sounds: density, reverb, warmth, texture
- musicalRecommendation: MUSIC ONLY — pretend you are writing a brief for a composer who cannot see the video. Name specific instruments, dynamics, tempo feel, and emotional quality of the sound. Never say "the video shows" or reference any visual element
- keyMode: major for uplifting/happy/triumphant/energetic, minor for dark/sad/dramatic/suspenseful, modal for mysterious/ethereal/ambient
- rhythmicFeel: describe rhythmic energy only — e.g. "steady driving pulse", "syncopated, off-beat accents", "free-flowing rubato"
- dynamicArc: use standard dynamic markings (pp, p, mp, mf, f, ff, fff) to map the intensity journey from start to end
- existingAudio: LISTEN carefully to the audio track. Do not guess from visuals. Describe only what you actually hear. If there is no discernible audio, write "no audible sound"
- audioEnergyLevel: rate how prominent or loud the existing audio is — silent (inaudible/none), quiet (subtle background), moderate (clearly present), loud (dominant/foreground)
- musicRole: decide how a composed score should coexist with the existing audio — use the definitions above`;

export class GeminiAnalyzer implements VideoAnalysisProvider {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not set. Add it to .env.local or set ANALYSIS_PROVIDER=mock to use the mock provider.'
      );
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyze(videoPath: string, metadata: VideoMetadata): Promise<AnalysisResult> {
    const ext = metadata.filename.split('.').pop()?.toLowerCase() ?? 'mp4';
    const mimeType = MIME_MAP[ext] ?? 'video/mp4';

    // Upload video to Gemini File API
    const uploadedFile = await this.ai.files.upload({
      file: videoPath,
      config: { mimeType, displayName: metadata.filename },
    });

    // Poll until Gemini has finished processing the video
    let file = uploadedFile;
    let attempts = 0;
    while (file.state === FileState.PROCESSING && attempts < 30) {
      await delay(3000);
      file = await this.ai.files.get({ name: file.name! });
      attempts++;
    }

    if (file.state !== FileState.ACTIVE) {
      throw new Error(`Gemini video processing failed (state: ${file.state}). Try again.`);
    }

    const response = await this.generateWithRetry(file.uri!, file.mimeType!);

    // Clean up uploaded file (best-effort)
    this.ai.files.delete({ name: file.name! }).catch(() => undefined);

    const raw = response.text ?? '';
    const analysis = this.parseResponse(raw, metadata);

    return { videoPath, metadata, analysis };
  }

  private async generateWithRetry(fileUri: string, fileMimeType: string) {
    const maxAttempts = 4;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: createUserContent([
            createPartFromUri(fileUri, fileMimeType),
            ANALYSIS_PROMPT,
          ]),
        });
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') ||
                            msg.includes('overloaded') || msg.includes('high demand');
        if (!isTransient || attempt === maxAttempts) throw err;
        // Exponential backoff: 4s, 8s, 16s
        await delay(4000 * 2 ** (attempt - 1));
      }
    }
    throw lastError;
  }

  private parseResponse(raw: string, metadata: VideoMetadata): VideoAnalysis {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJson(raw)) as Record<string, unknown>;
    } catch {
      throw new Error(`Gemini returned an invalid JSON response. Raw: ${raw.slice(0, 200)}`);
    }

    const inferredDuration = toNumber(parsed.videoDurationSeconds, metadata.durationSeconds ?? 30);
    metadata.durationSeconds = inferredDuration;

    const timeline = this.parseTimeline(parsed.timeline, inferredDuration);

    const energyRank: Record<EnergyLevel, number> = { low: 0, medium: 1, high: 2 };
    const peak = timeline.reduce((prev, cur) =>
      energyRank[cur.energyLevel] > energyRank[prev.energyLevel] ? cur : prev
    );

    return {
      mood: toMood(parsed.mood ?? peak.mood),
      energyLevel: toEnergy(parsed.energyLevel ?? peak.energyLevel),
      pace: toPace(parsed.pace),
      bpm: Math.round(Math.min(160, Math.max(60, toNumber(parsed.bpm, 100)))),
      genre: toGenre(parsed.genre),
      sceneCount: Math.round(Math.max(1, toNumber(parsed.sceneCount, 5))),
      motionScore: Math.round(Math.min(1, Math.max(0, toNumber(parsed.motionScore, 0.5))) * 100) / 100,
      instrumentSuggestions: toStringArray(parsed.instrumentSuggestions).slice(0, 4),
      analysisSummary: typeof parsed.analysisSummary === 'string' && parsed.analysisSummary
        ? parsed.analysisSummary
        : `A ${toEnergy(parsed.energyLevel)}-energy ${toMood(parsed.mood)} video.`,
      timeline,
      colorPalette: toColorPalette(parsed.colorPalette),
      cameraStyle: toCameraStyle(parsed.cameraStyle),
      visualPace: toVisualPace(parsed.visualPace),
      settingType: toSettingType(parsed.settingType),
      emotionalArc: typeof parsed.emotionalArc === 'string' && parsed.emotionalArc
        ? parsed.emotionalArc
        : undefined,
      sonicTexture: typeof parsed.sonicTexture === 'string' && parsed.sonicTexture
        ? parsed.sonicTexture
        : undefined,
      musicalRecommendation: typeof parsed.musicalRecommendation === 'string' && parsed.musicalRecommendation
        ? parsed.musicalRecommendation
        : undefined,
      keyMode: ['major', 'minor', 'modal'].includes(parsed.keyMode as string)
        ? (parsed.keyMode as 'major' | 'minor' | 'modal')
        : undefined,
      rhythmicFeel: typeof parsed.rhythmicFeel === 'string' && parsed.rhythmicFeel
        ? parsed.rhythmicFeel
        : undefined,
      dynamicArc: typeof parsed.dynamicArc === 'string' && parsed.dynamicArc
        ? parsed.dynamicArc
        : undefined,
      existingAudio: typeof parsed.existingAudio === 'string' && parsed.existingAudio
        ? parsed.existingAudio
        : undefined,
      audioEnergyLevel: toAudioEnergyLevel(parsed.audioEnergyLevel),
      musicRole: toMusicRole(parsed.musicRole),
    };
  }

  private parseTimeline(raw: unknown, totalDuration: number): TimelineSegment[] {
    if (!Array.isArray(raw) || raw.length < 2) {
      return this.fallbackTimeline(totalDuration);
    }

    const segments: TimelineSegment[] = (raw as Record<string, unknown>[]).map((seg, i) => {
      const mood = toMood(seg.mood);
      const energyLevel = toEnergy(seg.energyLevel);
      const posLabel = i === 0 ? 'Opening' : i === raw.length - 1 ? 'Resolution' : 'Mid';
      const label = typeof seg.label === 'string' && seg.label
        ? seg.label
        : `${posLabel} — ${mood}, ${energyLevel} energy`;

      return {
        startSeconds: toNumber(seg.startSeconds, 0),
        endSeconds: toNumber(seg.endSeconds, totalDuration),
        mood,
        energyLevel,
        label,
      };
    });

    segments.sort((a, b) => a.startSeconds - b.startSeconds);
    segments[0].startSeconds = 0;
    segments[segments.length - 1].endSeconds = totalDuration;

    return segments;
  }

  private fallbackTimeline(duration: number): TimelineSegment[] {
    const third = duration / 3;
    return [
      { startSeconds: 0, endSeconds: third, mood: 'calm', energyLevel: 'low', label: 'Opening — calm, low energy' },
      { startSeconds: third, endSeconds: third * 2, mood: 'emotional', energyLevel: 'medium', label: 'Mid — emotional, medium energy' },
      { startSeconds: third * 2, endSeconds: duration, mood: 'inspirational', energyLevel: 'high', label: 'Resolution — inspirational, high energy' },
    ];
  }
}
