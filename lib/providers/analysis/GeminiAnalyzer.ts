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
} from '@/types';
import { delay } from '@/lib/utils';

const VALID_MOODS: readonly Mood[] = [
  'inspirational', 'emotional', 'dramatic', 'energetic',
  'suspenseful', 'corporate', 'happy', 'calm',
];
const VALID_ENERGY: readonly EnergyLevel[] = ['low', 'medium', 'high'];
const VALID_PACES: readonly Pace[] = ['slow', 'moderate', 'fast'];
const VALID_GENRES = ['cinematic', 'electronic', 'acoustic', 'orchestral', 'ambient', 'jazz'];

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
- Reflect the actual visual content, color grading, camera motion, and emotional tone`;

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
