import type { VideoAnalysisProvider } from '../types';
import type {
  AnalysisResult,
  VideoMetadata,
  VideoAnalysis,
  TimelineSegment,
  Mood,
  EnergyLevel,
  Pace,
} from '@/types';
import { seededRandom, hashString, delay } from '@/lib/utils';

const PACES: Pace[] = ['slow', 'moderate', 'fast'];
const GENRES = ['cinematic', 'electronic', 'acoustic', 'orchestral', 'ambient', 'jazz'];
const INSTRUMENTS = [
  'strings', 'piano', 'drums', 'guitar', 'bass', 'brass',
  'flute', 'synth', 'violin', 'cello', 'percussion', 'choir',
  'harp', 'saxophone', 'organ',
];

// Arc templates — each entry defines a segment's energy index (0=low,1=med,2=high) and mood pool
type ArcSegment = { energy: 0 | 1 | 2; moodPool: Mood[] };
const ARC_TEMPLATES: ArcSegment[][] = [
  // 3-segment arc
  [
    { energy: 0, moodPool: ['calm', 'emotional'] },
    { energy: 2, moodPool: ['dramatic', 'energetic', 'suspenseful'] },
    { energy: 1, moodPool: ['inspirational', 'emotional', 'corporate'] },
  ],
  // 4-segment arc
  [
    { energy: 0, moodPool: ['calm', 'corporate'] },
    { energy: 1, moodPool: ['suspenseful', 'emotional'] },
    { energy: 2, moodPool: ['dramatic', 'energetic'] },
    { energy: 0, moodPool: ['emotional', 'inspirational'] },
  ],
  // 5-segment arc
  [
    { energy: 0, moodPool: ['calm'] },
    { energy: 1, moodPool: ['emotional', 'suspenseful'] },
    { energy: 2, moodPool: ['dramatic', 'energetic'] },
    { energy: 2, moodPool: ['energetic', 'dramatic'] },
    { energy: 0, moodPool: ['emotional', 'inspirational'] },
  ],
];

const ENERGY_LEVELS: EnergyLevel[] = ['low', 'medium', 'high'];
const ENERGY_BPM: Record<EnergyLevel, [number, number]> = {
  low: [60, 90],
  medium: [90, 120],
  high: [120, 160],
};

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

export class MockAnalyzer implements VideoAnalysisProvider {
  async analyze(videoPath: string, metadata: VideoMetadata): Promise<AnalysisResult> {
    await delay(2000 + Math.random() * 1000);

    const rand = seededRandom(hashString(videoPath + String(metadata.sizeBytes)));
    const totalDuration = metadata.durationSeconds ?? 30;

    // Pick an arc template
    const arcTemplate = ARC_TEMPLATES[Math.floor(rand() * ARC_TEMPLATES.length)];
    const segCount = arcTemplate.length;

    // Randomise proportional segment widths
    const weights = arcTemplate.map(() => 0.5 + rand() * 0.5);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const timeline: TimelineSegment[] = [];
    let cursor = 0;

    for (let i = 0; i < segCount; i++) {
      const raw = (weights[i] / totalWeight) * totalDuration;
      const startSeconds = Math.round(cursor * 10) / 10;
      const endSeconds = i === segCount - 1
        ? totalDuration
        : Math.round((cursor + raw) * 10) / 10;

      const tpl = arcTemplate[i];
      const mood = pick(tpl.moodPool, rand);
      const energyLevel = ENERGY_LEVELS[tpl.energy];

      const posLabel = i === 0 ? 'Opening' : i === segCount - 1 ? 'Resolution' : 'Mid';
      const label = `${posLabel} — ${mood}, ${energyLevel} energy`;

      timeline.push({ startSeconds, endSeconds, mood, energyLevel, label });
      cursor += raw;
    }

    // Peak segment drives the overall profile
    const energyRank: Record<EnergyLevel, number> = { low: 0, medium: 1, high: 2 };
    const peak = timeline.reduce((prev, cur) =>
      energyRank[cur.energyLevel] > energyRank[prev.energyLevel] ? cur : prev
    );

    const genre = pick(GENRES, rand);
    const pace = pick(PACES, rand);
    const [bpmMin, bpmMax] = ENERGY_BPM[peak.energyLevel];
    const bpm = Math.round(bpmMin + rand() * (bpmMax - bpmMin));
    const sceneCount = Math.round(3 + rand() * 37);
    const motionScore = Math.round((0.1 + rand() * 0.9) * 100) / 100;

    // Pick 2–4 instruments (shuffle with seeded rand)
    const instrCount = 2 + Math.floor(rand() * 3);
    const shuffled = [...INSTRUMENTS].sort(() => rand() - 0.5);
    const instrumentSuggestions = shuffled.slice(0, instrCount);

    const analysisSummary =
      `This ${pace} ${peak.mood} video has ${peak.energyLevel} peak energy with approximately ` +
      `${sceneCount} scene cuts, suggesting a ${genre} score around ${bpm} BPM ` +
      `featuring ${instrumentSuggestions.slice(0, 2).join(' and ')}.`;

    const analysis: VideoAnalysis = {
      mood: peak.mood,
      energyLevel: peak.energyLevel,
      pace,
      bpm,
      genre,
      sceneCount,
      motionScore,
      instrumentSuggestions,
      analysisSummary,
      timeline,
    };

    return { videoPath, metadata, analysis };
  }
}
