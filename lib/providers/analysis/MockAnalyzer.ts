import type { VideoAnalysisProvider } from '../types';
import type {
  AnalysisResult,
  VideoMetadata,
  VideoAnalysis,
  TimelineSegment,
  Mood,
  EnergyLevel,
  Pace,
  ColorPalette,
  CameraStyle,
  VisualPace,
  SettingType,
  AudioEnergyLevel,
  MusicRole,
  AudioContentType,
  DialogueTone,
  DialogueSentiment,
  SoundTexture,
  VolumeDynamics,
} from '@/types';
import { seededRandom, hashString, delay } from '@/lib/utils';

const PACES: Pace[] = ['slow', 'moderate', 'fast'];
const GENRES = ['cinematic', 'electronic', 'acoustic', 'orchestral', 'ambient', 'jazz'];
const COLOR_PALETTES: ColorPalette[] = ['warm', 'cool', 'dark', 'bright', 'neutral'];
const CAMERA_STYLES: CameraStyle[] = ['static', 'smooth', 'handheld', 'dynamic'];
const VISUAL_PACES: VisualPace[] = ['slow-cuts', 'moderate-cuts', 'fast-cuts'];
const SETTING_TYPES: SettingType[] = ['nature', 'urban', 'intimate', 'cinematic', 'abstract', 'sports', 'documentary'];
const AUDIO_ENERGY_LEVELS: AudioEnergyLevel[] = ['silent', 'quiet', 'moderate', 'loud'];
const MUSIC_ROLES: MusicRole[] = ['background-underscore', 'featured-score', 'sync-to-action', 'ambient-complement'];
const EXISTING_AUDIO_DESCRIPTIONS: string[] = [
  'crowd chatter and ambient noise',
  'dialogue and occasional laughter',
  'background music and nature sounds',
  'explosions and action sound effects',
  'environmental ambience and wind',
  'no audible sound',
  'speech and ambient city noise',
  'music and applause',
];

const AUDIO_CONTENT_TYPE_SETS: AudioContentType[][] = [
  ['dialogue', 'background_music'],
  ['sound_effects', 'ambient'],
  ['dialogue', 'sound_effects'],
  ['background_music', 'ambient'],
  ['ambient'],
  ['dialogue'],
  ['sound_effects'],
  ['silence'],
  ['dialogue', 'ambient'],
  ['sound_effects', 'background_music'],
];

const DIALOGUE_TONES: DialogueTone[] = ['formal', 'casual', 'emotional', 'tense', 'upbeat'];
const DIALOGUE_SENTIMENTS: DialogueSentiment[] = ['positive', 'neutral', 'negative', 'mixed'];
const SOUND_TEXTURES: SoundTexture[] = ['sharp', 'blunt', 'soft', 'layered', 'sparse'];
const VOLUME_DYNAMICS: VolumeDynamics[] = ['consistent', 'building', 'dropping', 'erratic', 'dynamic'];

const SEGMENT_AUDIO_NOTES: string[] = [
  'quiet dialogue and room tone',
  'sharp impacts and sudden noise bursts',
  'swelling background music',
  'ambient environmental noise',
  'silence with subtle room tone',
  'layered crowd noise and chatter',
  'heavy bass impacts and reverb',
  'soft whispered speech',
  'erratic sound effects and movement noise',
  'building musical underscore',
];
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

      const audioNote = pick(SEGMENT_AUDIO_NOTES, rand);
      timeline.push({ startSeconds, endSeconds, mood, energyLevel, label, audioNote });
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

    const colorPalette = pick(COLOR_PALETTES, rand);
    const cameraStyle = pick(CAMERA_STYLES, rand);
    const visualPace = pick(VISUAL_PACES, rand);
    const settingType = pick(SETTING_TYPES, rand);

    const analysisSummary =
      `This ${pace} ${peak.mood} video has ${peak.energyLevel} peak energy with approximately ` +
      `${sceneCount} scene cuts, suggesting a ${genre} score around ${bpm} BPM ` +
      `featuring ${instrumentSuggestions.slice(0, 2).join(' and ')}.`;

    const emotionalArc =
      `The video opens with a ${timeline[0].mood} atmosphere and ` +
      `builds toward a ${peak.mood} peak before resolving ${timeline[timeline.length - 1].mood}ly.`;

    const sonicTexture = pick([
      'sparse, warm, with long reverb tails',
      'dense, layered, rich orchestral texture',
      'dry, intimate, close-miked sound',
      'airy, open, with spacious hall reverb',
      'cold, crystalline, with subtle ambience',
    ] as const, rand);

    const musicalRecommendation =
      `A ${genre} piece featuring ${instrumentSuggestions.slice(0, 2).join(' and ')} ` +
      `at ${bpm} BPM, ${peak.energyLevel} energy, evoking a ${peak.mood} quality ` +
      `that evolves from ${timeline[0].mood} to ${timeline[timeline.length - 1].mood}.`;

    const keyMode = (['dramatic', 'suspenseful', 'emotional'].includes(peak.mood)
      ? 'minor'
      : ['calm', 'corporate'].includes(peak.mood)
        ? 'modal'
        : 'major') as 'major' | 'minor' | 'modal';

    const rhythmicFeel = pick([
      'steady, driving pulse with even eighth notes',
      'flowing, legato triplet feel',
      'syncopated, off-beat rhythmic accents',
      'free-flowing rubato with expressive phrasing',
      'crisp, punctuated staccato rhythm',
    ] as const, rand);

    const dynamicArc = pick([
      'pp opening building gradually to fff climax',
      'sustained forte throughout with brief mp lulls',
      'mf to ff with sudden pp drop at resolution',
      'mp whisper swelling to ff then fading to p',
      'ff from the start, sustained with driving intensity',
    ] as const, rand);

    const existingAudio = pick(EXISTING_AUDIO_DESCRIPTIONS, rand);
    const audioEnergyLevel = pick(AUDIO_ENERGY_LEVELS, rand);
    // musicRole derived from audioEnergyLevel for logical consistency
    const musicRole: MusicRole =
      audioEnergyLevel === 'loud' ? 'background-underscore' :
      audioEnergyLevel === 'silent' ? 'featured-score' :
      audioEnergyLevel === 'moderate' ? pick(['sync-to-action', 'ambient-complement'] as MusicRole[], rand) :
      'ambient-complement';

    const audioContentTypes = pick(AUDIO_CONTENT_TYPE_SETS, rand);
    const hasDialogue = audioContentTypes.includes('dialogue') && audioEnergyLevel !== 'silent';
    const dialogueTone: DialogueTone | undefined = hasDialogue ? pick(DIALOGUE_TONES, rand) : undefined;
    const dialogueSentiment: DialogueSentiment | undefined = hasDialogue ? pick(DIALOGUE_SENTIMENTS, rand) : undefined;
    const soundTexture = pick(SOUND_TEXTURES, rand);
    const volumeDynamics = pick(VOLUME_DYNAMICS, rand);
    const audioDialogueDominant = hasDialogue && audioContentTypes.length === 1;

    const audioSummary = hasDialogue
      ? `${dialogueTone ?? 'conversational'} dialogue with ${soundTexture} texture and ${volumeDynamics} volume levels throughout.`
      : audioContentTypes.includes('sound_effects')
        ? `${soundTexture} sound effects with ${volumeDynamics} volume dynamics and ${audioEnergyLevel} overall energy.`
        : audioContentTypes.includes('background_music')
          ? `Background music with ${soundTexture} texture and ${volumeDynamics} volume arc.`
          : `${audioEnergyLevel === 'silent' ? 'Near-silent audio' : 'Ambient audio'} with ${soundTexture} texture and ${volumeDynamics} dynamics.`;

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
      colorPalette,
      cameraStyle,
      visualPace,
      settingType,
      emotionalArc,
      sonicTexture,
      musicalRecommendation,
      keyMode,
      rhythmicFeel,
      dynamicArc,
      existingAudio,
      audioEnergyLevel,
      musicRole,
      audioContentTypes,
      dialogueTone,
      dialogueSentiment,
      soundTexture,
      volumeDynamics,
      audioSummary,
      audioDialogueDominant,
    };

    return { videoPath, metadata, analysis };
  }
}
