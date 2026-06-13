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

export interface TimelineSegment {
  startSeconds: number;
  endSeconds: number;
  mood: Mood;
  energyLevel: EnergyLevel;
  label: string;
  audioNote?: string;
}

export type ColorPalette = 'warm' | 'cool' | 'dark' | 'bright' | 'neutral';
export type CameraStyle = 'static' | 'smooth' | 'handheld' | 'dynamic';
export type VisualPace = 'slow-cuts' | 'moderate-cuts' | 'fast-cuts';
export type SettingType = 'nature' | 'urban' | 'intimate' | 'cinematic' | 'abstract' | 'sports' | 'documentary';
export type AudioEnergyLevel = 'silent' | 'quiet' | 'moderate' | 'loud';
export type MusicRole = 'background-underscore' | 'featured-score' | 'sync-to-action' | 'ambient-complement';

export type AudioContentType = 'dialogue' | 'sound_effects' | 'background_music' | 'ambient' | 'silence';
export type DialogueTone = 'formal' | 'casual' | 'emotional' | 'tense' | 'upbeat';
export type DialogueSentiment = 'positive' | 'neutral' | 'negative' | 'mixed';
export type SoundTexture = 'sharp' | 'blunt' | 'soft' | 'layered' | 'sparse';
export type VolumeDynamics = 'consistent' | 'building' | 'dropping' | 'erratic' | 'dynamic';

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
  audioContentTypes?: AudioContentType[];
  dialogueTone?: DialogueTone;
  dialogueSentiment?: DialogueSentiment;
  soundTexture?: SoundTexture;
  volumeDynamics?: VolumeDynamics;
  audioSummary?: string;
  audioDialogueDominant?: boolean;
}

export interface AnalysisResult {
  videoPath: string;
  metadata: VideoMetadata;
  analysis: VideoAnalysis;
}

// ── ElevenLabs Music — composition plan (music_v1 "MusicPrompt" shape) ────────
// Mirrors the /v1/music request body. Built by buildCompositionPlan() and sent
// verbatim by ElevenMusicProvider. Field names match the API exactly.
export interface MusicSection {
  section_name: string;            // 1–100 chars
  positive_local_styles: string[]; // musical directions to include for this section
  negative_local_styles: string[]; // musical directions to avoid for this section
  duration_ms: number;             // 3000–120000
  lines: string[];                 // lyrics; empty array ⇒ instrumental
}

export interface CompositionPlan {
  positive_global_styles: string[];
  negative_global_styles: string[];
  sections: MusicSection[];
}

// Human-friendly per-section summary returned to the client for display.
export interface ScoreSection {
  name: string;
  durationSeconds: number;
  styles: string[];
}

export interface GeneratedScore {
  audioUrl: string;
  durationSeconds: number;
  bpm: number;
  genre: string;
  mood: Mood;
  filename: string;
  prompt: string;
  sections?: ScoreSection[];       // populated by ElevenMusicProvider (composition-plan sections)
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
