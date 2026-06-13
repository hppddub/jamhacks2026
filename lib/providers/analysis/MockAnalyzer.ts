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
  VideoContextType,
  MicroSegmentScores,
  SegmentationScores,
  VisualQualityScores,
  SubjectAnalysisScores,
  MotionAnalysisScores,
  SceneUnderstandingScores,
  AttentionEngagementScores,
  TaskSpecificScores,
  AudioAnalysisScores,
  ConfidenceScores,
  SafetyScores,
  FinalOutputScores,
} from '@/types';
import { seededRandom, hashString, delay } from '@/lib/utils';

const PACES: Pace[] = ['slow', 'moderate', 'fast'];
const CONTEXT_TYPES: VideoContextType[] = [
  'sports', 'dance', 'product-video', 'security-footage',
  'social-media', 'interview-reaction', 'general',
];

function makeMicroScores(
  rand: () => number,
  energyLevel: EnergyLevel,
  narrativeRole: string | undefined,
  isFirst: boolean,
  isLast: boolean,
): MicroSegmentScores {
  const r = (base: number, spread = 0.18) =>
    Math.min(1, Math.max(0, base + (rand() - 0.5) * spread * 2));
  const eb = energyLevel === 'high' ? 0.12 : energyLevel === 'low' ? -0.10 : 0;
  const isClimax = narrativeRole === 'climax';

  const segmentation: SegmentationScores = {
    shotChanges: r(0.35 + eb * 0.45, 0.20),
    sceneChanges: r(0.30 + eb * 0.35, 0.20),
    actionStartTime: r(0.12, 0.14),
    actionPeakTime: r(0.50 + (isClimax ? 0.15 : 0), 0.20),
    actionEndTime: r(0.88, 0.10),
    segmentOverlap: r(0.35, 0.20),
  };
  const visualQuality: VisualQualityScores = {
    sharpness: r(0.72 + eb * 0.10),
    focusQuality: r(0.74 + eb * 0.08),
    exposure: r(0.70),
    contrast: r(0.65),
    brightnessStability: r(0.78, 0.12),
    colorBalance: r(0.70),
    saturation: r(0.65),
    noiseLevel: r(0.14, 0.14),
    compressionArtifacts: r(0.12, 0.14),
    motionBlur: r(0.12 + eb * 0.08, 0.14),
    flicker: r(0.08, 0.10),
    distortion: r(0.07, 0.10),
  };
  const subjectAnalysis: SubjectAnalysisScores = {
    primarySubjectDetected: r(0.85, 0.12),
    secondarySubjectCount: r(0.40 + eb * 0.15, 0.22),
    objectCount: r(0.45 + eb * 0.20, 0.22),
    subjectVisibility: r(0.72 + (isClimax ? 0.08 : 0)),
    occlusionLevel: r(0.18, 0.20),
    faceVisibility: r(0.38, 0.30),
    bodyVisibility: r(0.55, 0.25),
    objectRelevance: r(0.68),
    subjectSizeInFrame: r(0.60 + (isClimax ? 0.10 : 0)),
    subjectCentering: r(0.62),
  };
  const motionAnalysis: MotionAnalysisScores = {
    globalMotionIntensity: r(0.30 + eb * 0.55),
    localMotionIntensity: r(0.25 + eb * 0.50),
    cameraShake: r(0.14 + eb * 0.12, 0.16),
    motionSmoothness: r(0.68 - eb * 0.15),
    motionDirectionConsistency: r(0.72),
    movementSpeed: r(0.35 + eb * 0.50),
    movementPrecision: r(0.65 + (isClimax ? 0.08 : 0)),
    movementSymmetry: r(0.58),
    jerkiness: r(0.12 + eb * 0.10, 0.14),
    trajectoryCoherence: r(0.70),
  };

  const SCENE_CATEGORIES = ['action', 'dialogue', 'landscape', 'transition', 'montage', 'establishing', 'climax'];
  const ENV_TYPES = ['outdoor', 'indoor', 'studio', 'urban', 'nature', 'crowd', 'abstract'];
  const sceneIdx = Math.floor(rand() * SCENE_CATEGORIES.length);
  const envIdx = Math.floor(rand() * ENV_TYPES.length);
  const sceneUnderstanding: SceneUnderstandingScores = {
    sceneCategory: isClimax ? 'climax' : SCENE_CATEGORIES[sceneIdx],
    environmentType: ENV_TYPES[envIdx],
    indoorOutdoor: rand() > 0.55 ? 'outdoor' : rand() > 0.4 ? 'indoor' : 'mixed',
    activityType: narrativeRole ?? 'general activity',
    actionComplexity: r(0.50 + eb * 0.30 + (isClimax ? 0.15 : 0)),
    eventDensity: r(0.45 + eb * 0.35),
    eventSalience: r(0.55 + (isClimax ? 0.22 : 0)),
    sceneContextConsistency: r(0.72),
    narrativeCoherence: r(0.68),
    causeEffectClarity: r(0.60 + (isClimax ? 0.12 : 0)),
  };
  const attentionEngagement: AttentionEngagementScores = {
    hookStrength: r(0.50 + (isFirst ? 0.22 : 0) + eb * 0.10),
    visualInterest: r(0.60 + eb * 0.18 + (isClimax ? 0.10 : 0)),
    pacing: r(0.62 + eb * 0.12),
    retentionPotential: r(0.58 + (isFirst ? 0.10 : 0) + (isClimax ? 0.08 : 0)),
    novelty: r(0.55 + eb * 0.15),
    emotionalImpact: r(0.60 + (isClimax ? 0.15 : 0)),
    memorability: r(0.52 + (isClimax ? 0.16 : 0) + (isFirst ? 0.06 : 0)),
    scrollStoppingPower: r(0.50 + (isFirst ? 0.15 : 0) + eb * 0.12),
    rewatchability: r(0.48 + (isClimax ? 0.14 : 0)),
    energyLevel: r(0.35 + eb * 0.58),
  };
  const taskSpecific: TaskSpecificScores = {
    taskRelevance: r(0.68 + (isClimax ? 0.10 : 0)),
    classificationAccuracy: r(0.72),
    techniqueQuality: r(0.68 + eb * 0.08),
    timingAccuracy: r(0.65 + (isClimax ? 0.08 : 0)),
    completionQuality: r(0.70 + (isLast ? 0.08 : 0)),
    successProbability: r(0.65),
    goalAlignment: r(0.68),
    rankingScore: r(0.60 + (isClimax ? 0.12 : 0)),
  };
  const audio: AudioAnalysisScores = {
    speechPresence: r(0.28, 0.28),
    speechClarity: r(0.65, 0.22),
    backgroundNoiseLevel: r(0.20, 0.20),
    musicPresence: r(0.32, 0.28),
    soundEffectPresence: r(0.25 + eb * 0.15, 0.22),
    audioVisualSync: r(0.72),
    rhythmAlignment: r(0.65 + eb * 0.10),
    toneMatch: r(0.68),
  };
  const confidence: ConfidenceScores = {
    modelConfidence: r(0.75, 0.14),
    predictionEntropy: r(0.22, 0.18),
    ambiguityScore: r(0.18, 0.16),
    missingDataRate: r(0.08, 0.10),
    boundaryConfidence: r(0.70 + (isFirst || isLast ? 0.08 : 0)),
    crossFrameConsistency: r(0.75),
    reliabilityScore: r(0.72),
  };
  const safety: SafetyScores = {
    nsfwRisk: r(0.02, 0.04),
    violenceRisk: r(0.04, 0.06),
    privacyRisk: r(0.05, 0.08),
    harmfulContentRisk: r(0.02, 0.04),
    illegalContentRisk: r(0.01, 0.02),
    faceSensitivity: r(0.28, 0.24),
    moderationPenalty: r(0.02, 0.04),
  };

  // Compute composite outputs
  const vqScore = (visualQuality.sharpness + visualQuality.focusQuality + visualQuality.exposure + visualQuality.contrast +
    visualQuality.brightnessStability + visualQuality.colorBalance + visualQuality.saturation +
    (1 - visualQuality.noiseLevel) + (1 - visualQuality.compressionArtifacts) +
    (1 - visualQuality.motionBlur) + (1 - visualQuality.flicker) + (1 - visualQuality.distortion)) / 12;
  const saScore = (subjectAnalysis.primarySubjectDetected + subjectAnalysis.subjectVisibility +
    (1 - subjectAnalysis.occlusionLevel) + subjectAnalysis.objectRelevance +
    subjectAnalysis.subjectSizeInFrame + subjectAnalysis.subjectCentering) / 6;
  const maScore = ((1 - motionAnalysis.cameraShake) + motionAnalysis.motionSmoothness +
    motionAnalysis.motionDirectionConsistency + motionAnalysis.movementPrecision +
    (1 - motionAnalysis.jerkiness) + motionAnalysis.trajectoryCoherence) / 6;
  const suScore = (sceneUnderstanding.actionComplexity + sceneUnderstanding.eventDensity +
    sceneUnderstanding.eventSalience + sceneUnderstanding.sceneContextConsistency +
    sceneUnderstanding.narrativeCoherence + sceneUnderstanding.causeEffectClarity) / 6;
  const aeScore = (attentionEngagement.hookStrength + attentionEngagement.visualInterest +
    attentionEngagement.pacing + attentionEngagement.retentionPotential +
    attentionEngagement.novelty + attentionEngagement.emotionalImpact +
    attentionEngagement.memorability + attentionEngagement.scrollStoppingPower +
    attentionEngagement.rewatchability + attentionEngagement.energyLevel) / 10;
  const tsScore = (taskSpecific.taskRelevance + taskSpecific.classificationAccuracy +
    taskSpecific.techniqueQuality + taskSpecific.timingAccuracy +
    taskSpecific.completionQuality + taskSpecific.successProbability +
    taskSpecific.goalAlignment + taskSpecific.rankingScore) / 8;
  const confScore = confidence.modelConfidence;
  const penalty = safety.moderationPenalty;

  const segmentScore = Math.round(((segmentation.segmentOverlap + (1 - segmentation.shotChanges) * 0.5 + segmentation.actionPeakTime * 0.5) / 2) * 100) / 100;
  const eventScore = Math.round(suScore * 100) / 100;
  const technicalScore = Math.round(((vqScore + (1 - confidence.predictionEntropy)) / 2) * 100) / 100;
  const aestheticScore = Math.round(((vqScore + saScore) / 2) * 100) / 100;
  const engagementScore = Math.round(aeScore * 100) / 100;
  const taskScore = Math.round(tsScore * 100) / 100;
  const penaltyScore = Math.round(penalty * 100) / 100;
  const composite = (segmentScore + eventScore + technicalScore + aestheticScore + engagementScore + taskScore + maScore) / 7;
  const confidenceAdjustedScore = Math.round(composite * (0.7 + confScore * 0.3) * 100) / 100;
  const finalClipScore = Math.round(Math.min(1, Math.max(0, confidenceAdjustedScore * (1 - penaltyScore))) * 100) / 100;

  const finalOutputs: FinalOutputScores = {
    segmentScore, eventScore, technicalScore, aestheticScore,
    engagementScore, taskScore, penaltyScore, confidenceAdjustedScore, finalClipScore,
  };

  return {
    segmentation, visualQuality, subjectAnalysis, motionAnalysis,
    sceneUnderstanding, attentionEngagement, taskSpecific, audio,
    confidence, safety, finalOutputs,
  };
}
const GENRES = ['cinematic', 'electronic', 'acoustic', 'orchestral', 'ambient', 'jazz'];
const COLOR_PALETTES: ColorPalette[] = ['warm', 'cool', 'dark', 'bright', 'neutral'];
const CAMERA_STYLES: CameraStyle[] = ['static', 'smooth', 'handheld', 'dynamic'];
const VISUAL_PACES: VisualPace[] = ['slow-cuts', 'moderate-cuts', 'fast-cuts'];
const SETTING_TYPES: SettingType[] = ['nature', 'urban', 'intimate', 'cinematic', 'abstract', 'sports', 'documentary'];
const AUDIO_ENERGY_LEVELS: AudioEnergyLevel[] = ['silent', 'quiet', 'moderate', 'loud'];
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
const INSTRUMENTS = [
  'strings', 'piano', 'drums', 'guitar', 'bass', 'brass',
  'flute', 'synth', 'violin', 'cello', 'percussion', 'choir',
  'harp', 'saxophone', 'organ',
];

const MUSICAL_DESC_BY_ENERGY: Record<EnergyLevel, string[]> = {
  low: [
    'legato strings, pp, hushed and introspective with sparse piano',
    'solo piano, p, gentle arpeggios, tender and searching',
    'flute and harp, pp, delicate and floating, airy texture',
    'quiet cello section, p, slow bowing, warm and contemplative',
    'woodwind trio, mp, soft legato phrases, understated and still',
  ],
  medium: [
    'strings and piano, mf, flowing phrases, warm and expressive',
    'woodwinds and horns, mf, sustained chords, steady and purposeful',
    'piano with string accompaniment, mf, lyrical melody, emotionally open',
    'full string section, mf, broad legato, building in weight',
    'brass and strings, mf, measured tempo, confident and grounded',
  ],
  high: [
    'full brass choir, fff, bold staccato fanfare with driving timpani',
    'climactic orchestra, ff, sweeping strings and blaring horns',
    'strings and brass surge, fff, fortissimo and expansive, triumphant',
    'percussion and full ensemble, ff, marcato, relentless and powerful',
    'driving strings and brass, fff, broad and majestic, peak intensity',
  ],
};

const TRANSITIONS_UP   = [
  'strings swell to fortissimo climax',
  'gradual crescendo builds over four beats',
  'ensemble swells from mp to ff',
  'rising tension with accelerating pulse',
];
const TRANSITIONS_DOWN = [
  'sudden drop to mp then silence',
  'gradual decrescendo to near silence',
  'ritardando and decrescendo to p',
  'release of tension, settling to mp',
];
const TRANSITIONS_SAME = [
  'key modulation brightens the texture',
  'tempo shifts to flowing triplet feel',
  'sustained harmony pivots to new mode',
  'texture thins then re-enters at same level',
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
      const musicalDescription = pick(MUSICAL_DESC_BY_ENERGY[energyLevel], rand);

      timeline.push({ startSeconds, endSeconds, mood, energyLevel, label, musicalDescription });
      cursor += raw;
    }

    // Assign narrative roles based on position relative to peak energy
    const energyRank: Record<EnergyLevel, number> = { low: 0, medium: 1, high: 2 };
    const peakIdx = timeline.reduce(
      (maxI, seg, i) => energyRank[seg.energyLevel] > energyRank[timeline[maxI].energyLevel] ? i : maxI,
      0
    );
    timeline.forEach((seg, i) => {
      if (i === 0) seg.narrativeRole = 'intro';
      else if (i === timeline.length - 1) seg.narrativeRole = 'resolution';
      else if (i === peakIdx) seg.narrativeRole = 'climax';
      else if (i < peakIdx) seg.narrativeRole = 'rising action';
      else seg.narrativeRole = 'falling action';
    });

    // Add transition descriptors based on energy change to next segment
    for (let i = 0; i < timeline.length - 1; i++) {
      const curr = energyRank[timeline[i].energyLevel];
      const next = energyRank[timeline[i + 1].energyLevel];
      const pool = curr < next ? TRANSITIONS_UP : curr > next ? TRANSITIONS_DOWN : TRANSITIONS_SAME;
      timeline[i].transitionToNext = pick(pool, rand);
    }

    // Generate micro-scores per segment using seeded rand for determinism
    timeline.forEach((seg, i) => {
      seg.microScores = makeMicroScores(
        rand,
        seg.energyLevel,
        seg.narrativeRole,
        i === 0,
        i === timeline.length - 1,
      );
    });

    const overallVideoScore =
      Math.round(
        (timeline.reduce((sum, seg) => sum + (seg.microScores?.finalOutputs.finalClipScore ?? 0), 0) / timeline.length) * 100
      ) / 100;

    // Peak segment drives the overall profile
    const peak = timeline.reduce((prev, cur) =>
      energyRank[cur.energyLevel] > energyRank[prev.energyLevel] ? cur : prev
    );

    const contextType = pick(CONTEXT_TYPES, rand);
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
      contextType,
      overallVideoScore,
    };

    return { videoPath, metadata, analysis };
  }
}
