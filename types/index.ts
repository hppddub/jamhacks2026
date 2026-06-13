export type WorkflowStep =
  | 'idle'
  | 'uploading'
  | 'uploaded'
  | 'analyzing'
  | 'analyzed'
  | 'generating'
  | 'completed';

export type Mood =
  | 'inspirational'
  | 'emotional'
  | 'dramatic'
  | 'energetic'
  | 'suspenseful'
  | 'corporate'
  | 'happy'
  | 'calm';

export type EnergyLevel = 'low' | 'medium' | 'high';
export type Pace = 'slow' | 'moderate' | 'fast';

export interface VideoMetadata {
  filename: string;
  sizeBytes: number;
  durationSeconds?: number;
}

// ─── Micro-Segmentation Model ─────────────────────────────────────────────────

export type VideoContextType =
  | 'sports'
  | 'dance'
  | 'product-video'
  | 'security-footage'
  | 'social-media'
  | 'interview-reaction'
  | 'general';

/** Per-segment temporal segmentation signals */
export interface SegmentationScores {
  shotChanges: number;          // normalized 0-1 (0=no cuts, 1=many cuts)
  sceneChanges: number;         // normalized 0-1
  actionStartTime: number;      // relative within segment, 0-1
  actionPeakTime: number;       // relative within segment, 0-1
  actionEndTime: number;        // relative within segment, 0-1
  segmentOverlap: number;       // continuity overlap with adjacent segments, 0-1
}

/** Raw sensor / capture quality of each frame */
export interface VisualQualityScores {
  sharpness: number;
  focusQuality: number;
  exposure: number;
  contrast: number;
  brightnessStability: number;
  colorBalance: number;
  saturation: number;
  noiseLevel: number;            // negative-sense
  compressionArtifacts: number;  // negative-sense
  motionBlur: number;            // negative-sense
  flicker: number;               // negative-sense
  distortion: number;            // negative-sense
}

/** Subject and object detection quality */
export interface SubjectAnalysisScores {
  primarySubjectDetected: number; // 0 or 1
  secondarySubjectCount: number;  // 0-1 normalized (0=none, 1=many)
  objectCount: number;            // 0-1 normalized
  subjectVisibility: number;
  occlusionLevel: number;         // negative-sense
  faceVisibility: number;
  bodyVisibility: number;
  objectRelevance: number;
  subjectSizeInFrame: number;
  subjectCentering: number;
}

/** Camera and subject movement quality */
export interface MotionAnalysisScores {
  globalMotionIntensity: number;
  localMotionIntensity: number;
  cameraShake: number;            // negative-sense
  motionSmoothness: number;
  motionDirectionConsistency: number;
  movementSpeed: number;
  movementPrecision: number;
  movementSymmetry: number;
  jerkiness: number;              // negative-sense
  trajectoryCoherence: number;
}

/** Semantic comprehension of the scene */
export interface SceneUnderstandingScores {
  sceneCategory: string;          // e.g. "action", "dialogue", "landscape"
  environmentType: string;        // e.g. "stadium", "living room", "street"
  indoorOutdoor: string;          // "indoor" | "outdoor" | "mixed"
  activityType: string;           // primary activity observed
  actionComplexity: number;
  eventDensity: number;
  eventSalience: number;
  sceneContextConsistency: number;
  narrativeCoherence: number;
  causeEffectClarity: number;
}

/** Viewer attention and retention signals */
export interface AttentionEngagementScores {
  hookStrength: number;
  visualInterest: number;
  pacing: number;
  retentionPotential: number;
  novelty: number;
  emotionalImpact: number;
  memorability: number;
  scrollStoppingPower: number;
  rewatchability: number;
  energyLevel: number;
}

/** Task / goal alignment scores */
export interface TaskSpecificScores {
  taskRelevance: number;
  classificationAccuracy: number;
  techniqueQuality: number;
  timingAccuracy: number;
  completionQuality: number;
  successProbability: number;
  goalAlignment: number;
  rankingScore: number;
}

/** Audio track quality and alignment */
export interface AudioAnalysisScores {
  speechPresence: number;
  speechClarity: number;
  backgroundNoiseLevel: number;   // negative-sense
  musicPresence: number;
  soundEffectPresence: number;
  audioVisualSync: number;
  rhythmAlignment: number;
  toneMatch: number;
}

/** Model prediction confidence and data quality */
export interface ConfidenceScores {
  modelConfidence: number;
  predictionEntropy: number;      // negative-sense (high = uncertain)
  ambiguityScore: number;         // negative-sense
  missingDataRate: number;        // negative-sense
  boundaryConfidence: number;
  crossFrameConsistency: number;
  reliabilityScore: number;
}

/** Safety and moderation penalty signals */
export interface SafetyScores {
  nsfwRisk: number;               // negative-sense
  violenceRisk: number;           // negative-sense
  privacyRisk: number;            // negative-sense
  harmfulContentRisk: number;     // negative-sense
  illegalContentRisk: number;     // negative-sense
  faceSensitivity: number;        // negative-sense
  moderationPenalty: number;      // negative-sense — aggregate penalty weight
}

/** Composite score outputs — primary model outputs per segment */
export interface FinalOutputScores {
  segmentScore: number;             // temporal segmentation quality
  eventScore: number;               // scene / event importance
  technicalScore: number;           // visual + confidence quality
  aestheticScore: number;           // visual aesthetics + subject framing
  engagementScore: number;          // attention / engagement aggregate
  taskScore: number;                // task-specific performance
  penaltyScore: number;             // safety deduction (0=none, 1=full block)
  confidenceAdjustedScore: number;  // composite adjusted for model confidence
  finalClipScore: number;           // primary output: penalized, confidence-adjusted
}

export interface MicroSegmentScores {
  segmentation: SegmentationScores;
  visualQuality: VisualQualityScores;
  subjectAnalysis: SubjectAnalysisScores;
  motionAnalysis: MotionAnalysisScores;
  sceneUnderstanding: SceneUnderstandingScores;
  attentionEngagement: AttentionEngagementScores;
  taskSpecific: TaskSpecificScores;
  audio: AudioAnalysisScores;
  confidence: ConfidenceScores;
  safety: SafetyScores;
  finalOutputs: FinalOutputScores;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineSegment {
  startSeconds: number;
  endSeconds: number;
  mood: Mood;
  energyLevel: EnergyLevel;
  label: string;
  musicalDescription?: string;
  transitionToNext?: string;
  narrativeRole?: string;
  microScores?: MicroSegmentScores;
}

export type ColorPalette = 'warm' | 'cool' | 'dark' | 'bright' | 'neutral';
export type CameraStyle = 'static' | 'smooth' | 'handheld' | 'dynamic';
export type VisualPace = 'slow-cuts' | 'moderate-cuts' | 'fast-cuts';
export type SettingType = 'nature' | 'urban' | 'intimate' | 'cinematic' | 'abstract' | 'sports' | 'documentary';
export type AudioEnergyLevel = 'silent' | 'quiet' | 'moderate' | 'loud';
export type MusicRole = 'background-underscore' | 'featured-score' | 'sync-to-action' | 'ambient-complement';

export interface VideoAnalysis {
  mood: Mood;
  energyLevel: EnergyLevel;
  pace: Pace;
  bpm: number;
  genre: string;
  sceneCount: number;
  motionScore: number;
  instrumentSuggestions: string[];
  analysisSummary: string;
  timeline: TimelineSegment[];
  colorPalette?: ColorPalette;
  cameraStyle?: CameraStyle;
  visualPace?: VisualPace;
  settingType?: SettingType;
  emotionalArc?: string;
  sonicTexture?: string;
  musicalRecommendation?: string;
  keyMode?: 'major' | 'minor' | 'modal';
  rhythmicFeel?: string;
  dynamicArc?: string;
  existingAudio?: string;
  audioEnergyLevel?: AudioEnergyLevel;
  musicRole?: MusicRole;
  contextType?: VideoContextType;
  overallVideoScore?: number;
}

export interface AnalysisResult {
  videoPath: string;
  metadata: VideoMetadata;
  analysis: VideoAnalysis;
}

export interface GeneratedScore {
  audioUrl: string;
  durationSeconds: number;
  bpm: number;
  genre: string;
  mood: Mood;
  filename: string;
  prompt: string;
}

export interface WorkflowState {
  step: WorkflowStep;
  videoFile: File | null;
  videoObjectUrl: string | null;
  uploadedVideoPath: string | null;
  uploadedMetadata: VideoMetadata | null;
  analysis: AnalysisResult | null;
  score: GeneratedScore | null;
  error: string | null;
}
