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
  VideoContextType,
  AudioContentType,
  DialogueTone,
  DialogueSentiment,
  SoundTexture,
  VolumeDynamics,
  DrumStyle,
  VocalPresence,
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
import { delay } from '@/lib/utils';

const VALID_MOODS: readonly Mood[] = [
  'inspirational', 'emotional', 'dramatic', 'energetic',
  'suspenseful', 'corporate', 'happy', 'calm',
];
const VALID_ENERGY: readonly EnergyLevel[] = ['low', 'medium', 'high'];
const VALID_PACES: readonly Pace[] = ['slow', 'moderate', 'fast'];
const VALID_GENRES = [
  'lo-fi-hip-hop', 'hip-hop', 'pop', 'rock', 'indie', 'folk', 'acoustic',
  'blues', 'r-and-b', 'jazz', 'electronic', 'dance', 'classical',
  'orchestral', 'cinematic', 'ambient', 'world', 'punk',
];
const VALID_DRUM_STYLES: readonly DrumStyle[] = [
  'none', 'acoustic-kit', 'brushed-jazz', 'lo-fi-compressed', 'electronic-808', 'orchestral-bass-drum',
];
const VALID_VOCAL_PRESENCES: readonly VocalPresence[] = [
  'none', 'choir-pads', 'backing-harmonies', 'vocal-chops', 'humming', 'scat',
];
const VALID_PALETTES: readonly ColorPalette[] = ['warm', 'cool', 'dark', 'bright', 'neutral'];
const VALID_CAMERA: readonly CameraStyle[] = ['static', 'smooth', 'handheld', 'dynamic'];
const VALID_VISUAL_PACE: readonly VisualPace[] = ['slow-cuts', 'moderate-cuts', 'fast-cuts'];
const VALID_SETTINGS: readonly SettingType[] = ['nature', 'urban', 'intimate', 'cinematic', 'abstract', 'sports', 'documentary'];
const VALID_AUDIO_ENERGY: readonly AudioEnergyLevel[] = ['silent', 'quiet', 'moderate', 'loud'];
const VALID_MUSIC_ROLES: readonly MusicRole[] = ['background-underscore', 'featured-score', 'sync-to-action', 'ambient-complement'];
const VALID_AUDIO_CONTENT_TYPES: readonly AudioContentType[] = ['dialogue', 'sound_effects', 'background_music', 'ambient', 'silence'];
const VALID_DIALOGUE_TONES: readonly DialogueTone[] = ['formal', 'casual', 'emotional', 'tense', 'upbeat'];
const VALID_DIALOGUE_SENTIMENTS: readonly DialogueSentiment[] = ['positive', 'neutral', 'negative', 'mixed'];
const VALID_SOUND_TEXTURES: readonly SoundTexture[] = ['sharp', 'blunt', 'soft', 'layered', 'sparse'];
const VALID_VOLUME_DYNAMICS: readonly VolumeDynamics[] = ['consistent', 'building', 'dropping', 'erratic', 'dynamic'];

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
function toAudioContentTypes(v: unknown): AudioContentType[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is AudioContentType => VALID_AUDIO_CONTENT_TYPES.includes(x as AudioContentType));
}
function toDialogueTone(v: unknown): DialogueTone | undefined {
  return VALID_DIALOGUE_TONES.includes(v as DialogueTone) ? (v as DialogueTone) : undefined;
}
function toDialogueSentiment(v: unknown): DialogueSentiment | undefined {
  return VALID_DIALOGUE_SENTIMENTS.includes(v as DialogueSentiment) ? (v as DialogueSentiment) : undefined;
}
function toSoundTexture(v: unknown): SoundTexture | undefined {
  return VALID_SOUND_TEXTURES.includes(v as SoundTexture) ? (v as SoundTexture) : undefined;
}
function toVolumeDynamics(v: unknown): VolumeDynamics | undefined {
  return VALID_VOLUME_DYNAMICS.includes(v as VolumeDynamics) ? (v as VolumeDynamics) : undefined;
}
function toDrumStyle(v: unknown): DrumStyle | undefined {
  return VALID_DRUM_STYLES.includes(v as DrumStyle) ? (v as DrumStyle) : undefined;
}
function toVocalPresence(v: unknown): VocalPresence | undefined {
  return VALID_VOCAL_PRESENCES.includes(v as VocalPresence) ? (v as VocalPresence) : undefined;
}
function toNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

const VALID_CONTEXT_TYPES: readonly VideoContextType[] = [
  'sports', 'dance', 'product-video', 'security-footage',
  'social-media', 'interview-reaction', 'general',
];
function toContextType(v: unknown): VideoContextType {
  return VALID_CONTEXT_TYPES.includes(v as VideoContextType) ? (v as VideoContextType) : 'general';
}

function extractJson(raw: string): string {
  // Strip markdown code fences if present
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Extract by first { to last } in case Gemini adds preamble/postamble text
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

const MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

/**
 * Builds the Gemini analysis prompt with a segment duration cap tuned to the
 * video length. Short clips need finer granularity (smaller cap → more sections
 * to give ElevenLabs Music distinct directional briefs). Long clips need larger
 * blocks so sustained moods aren't over-subdivided into musically incoherent
 * micro-sections that exhaust the Music API's context.
 *
 *  < 45 s  → 12 s cap   (short-form: maximise per-section richness)
 *  45-90 s → 20 s cap   (medium: balanced granularity)
 *  > 90 s  → 30 s cap   (long-form: coherent musical blocks)
 */
function buildAnalysisPrompt(estimatedDurationSeconds?: number): string {
  const dur = estimatedDurationSeconds ?? 60;
  const segCap = dur < 45 ? 12 : dur <= 90 ? 20 : 30;
  return buildAnalysisPromptText(segCap);
}

function buildAnalysisPromptText(segCap: number): string {
  return `Analyze this video carefully and return ONLY a raw JSON object — no markdown fences, no explanation.

{
  "videoDurationSeconds": <total video duration as a number>,
  "mood": "<inspirational | emotional | dramatic | energetic | suspenseful | corporate | happy | calm>",
  "energyLevel": "<low | medium | high>",
  "pace": "<slow | moderate | fast>",
  "bpm": <integer 60-160 — music tempo that matches the video energy>,
  "genre": "<lo-fi-hip-hop | hip-hop | pop | rock | indie | folk | acoustic | blues | r-and-b | jazz | electronic | dance | classical | orchestral | cinematic | ambient | world | punk>",
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
  "contextType": "<sports | dance | product-video | security-footage | social-media | interview-reaction | general — primary detected use-case of this video>",
  "audioContentTypes": ["<dialogue | sound_effects | background_music | ambient | silence>"] (array — include every type present; may have multiple),
  "dialogueTone": "<formal | casual | emotional | tense | upbeat> — ONLY include when dialogue is present, otherwise omit this field",
  "dialogueSentiment": "<positive | neutral | negative | mixed> — ONLY include when dialogue is present, otherwise omit this field",
  "soundTexture": "<sharp | blunt | soft | layered | sparse — overall texture of non-music audio events: sharp = sudden loud transients like gunshots/impacts, blunt = heavy dull thuds, soft = gentle subtle sounds, layered = multiple simultaneous audio layers, sparse = few isolated sounds with silence between>",
  "volumeDynamics": "<consistent | building | dropping | erratic | dynamic — how the overall audio volume changes across the video: consistent = stays level, building = gradually gets louder, dropping = gradually gets quieter, erratic = unpredictable spikes and drops, dynamic = intentional dramatic swells and pulls>",
  "audioSummary": "<1 sentence summarising the audio landscape — what sounds are present, their texture, and how volume behaves across the video>",
  "drumsAppropriate": <true | false — true when the genre and scene call for a drum kit or rhythm section; false for purely classical solo, ambient drone, intimate acoustic-only, or soundscapes with no rhythm>,
  "drumStyle": "<none | acoustic-kit | brushed-jazz | lo-fi-compressed | electronic-808 | orchestral-bass-drum> — acoustic-kit for rock/pop/indie/blues; brushed-jazz for jazz; lo-fi-compressed for lo-fi-hip-hop; electronic-808 for electronic/dance/hip-hop; orchestral-bass-drum for orchestral/cinematic on structural accents only; none when drumsAppropriate is false",
  "vocalPresence": "<none | choir-pads | backing-harmonies | vocal-chops | humming | scat> — default is none; choir-pads only for genuinely triumphant or transcendent orchestral/cinematic climaxes; backing-harmonies for pop/folk/indie emotional warmth; vocal-chops for electronic/hip-hop rhythmic texture; humming for intimate quiet introspective scenes; scat for jazz only; when in doubt choose none",
  "timeline": [
    {
      "startSeconds": <number>,
      "endSeconds": <number>,
      "mood": "<one of the mood values above>",
      "energyLevel": "<low | medium | high>",
      "label": "<short descriptive label for this segment>",
      "narrativeRole": "<intro | rising action | climax | falling action | resolution — where this segment sits in the overall emotional arc>",
      "musicalDescription": "<MUSIC ONLY — 6-12 words: specific instrument(s) with playing technique, dynamic marking (pp/p/mp/mf/f/ff/fff), and emotional texture for THIS segment only. e.g. 'legato violin section, pp, hushed and introspective with warm cello counterpoint' or 'full brass choir, fff, bold staccato fanfare with driving timpani' or 'solo piano, mf, flowing arpeggios, tender and searching'. Never reference visuals.>",
      "transitionToNext": "<4-8 words on the exact musical boundary motion from THIS segment to the NEXT — describe how the score dynamically shifts at this moment: e.g. 'strings swell to fortissimo climax', 'sudden drop to silence then re-entry', 'gradual ritardando and decrescendo', 'key modulation up a perfect fifth', 'tempo doubles into driving pulse'. null for the final segment>",
      "audioNote": "<optional 5-10 words describing the dominant audio event in this segment — e.g. 'sharp impacts and crowd noise', 'quiet dialogue', 'silence', 'swelling background music'>",
      "microScores": {
        "segmentation": { "shotChanges": <f>, "sceneChanges": <f>, "actionStartTime": <f>, "actionPeakTime": <f>, "actionEndTime": <f>, "segmentOverlap": <f> },
        "visualQuality": { "sharpness": <f>, "focusQuality": <f>, "exposure": <f>, "contrast": <f>, "brightnessStability": <f>, "colorBalance": <f>, "saturation": <f>, "noiseLevel": <f>, "compressionArtifacts": <f>, "motionBlur": <f>, "flicker": <f>, "distortion": <f> },
        "subjectAnalysis": { "primarySubjectDetected": <f>, "secondarySubjectCount": <f>, "objectCount": <f>, "subjectVisibility": <f>, "occlusionLevel": <f>, "faceVisibility": <f>, "bodyVisibility": <f>, "objectRelevance": <f>, "subjectSizeInFrame": <f>, "subjectCentering": <f> },
        "motionAnalysis": { "globalMotionIntensity": <f>, "localMotionIntensity": <f>, "cameraShake": <f>, "motionSmoothness": <f>, "motionDirectionConsistency": <f>, "movementSpeed": <f>, "movementPrecision": <f>, "movementSymmetry": <f>, "jerkiness": <f>, "trajectoryCoherence": <f> },
        "sceneUnderstanding": { "sceneCategory": "<string>", "environmentType": "<string>", "indoorOutdoor": "<indoor|outdoor|mixed>", "activityType": "<string>", "actionComplexity": <f>, "eventDensity": <f>, "eventSalience": <f>, "sceneContextConsistency": <f>, "narrativeCoherence": <f>, "causeEffectClarity": <f> },
        "attentionEngagement": { "hookStrength": <f>, "visualInterest": <f>, "pacing": <f>, "retentionPotential": <f>, "novelty": <f>, "emotionalImpact": <f>, "memorability": <f>, "scrollStoppingPower": <f>, "rewatchability": <f>, "energyLevel": <f> },
        "taskSpecific": { "taskRelevance": <f>, "classificationAccuracy": <f>, "techniqueQuality": <f>, "timingAccuracy": <f>, "completionQuality": <f>, "successProbability": <f>, "goalAlignment": <f>, "rankingScore": <f> },
        "audio": { "speechPresence": <f>, "speechClarity": <f>, "backgroundNoiseLevel": <f>, "musicPresence": <f>, "soundEffectPresence": <f>, "audioVisualSync": <f>, "rhythmAlignment": <f>, "toneMatch": <f> },
        "confidence": { "modelConfidence": <f>, "predictionEntropy": <f>, "ambiguityScore": <f>, "missingDataRate": <f>, "boundaryConfidence": <f>, "crossFrameConsistency": <f>, "reliabilityScore": <f> },
        "safety": { "nsfwRisk": <f>, "violenceRisk": <f>, "privacyRisk": <f>, "harmfulContentRisk": <f>, "illegalContentRisk": <f>, "faceSensitivity": <f>, "moderationPenalty": <f> },
        "finalOutputs": { "segmentScore": <f>, "eventScore": <f>, "technicalScore": <f>, "aestheticScore": <f>, "engagementScore": <f>, "taskScore": <f>, "penaltyScore": <f>, "confidenceAdjustedScore": <f>, "finalClipScore": <f> }
      }
    }
  ]
}

Rules:
- timeline must reflect genuine mood, energy, or setting transitions — never create arbitrary time-based segments
- timeline must have 3-10 segments that together span 0 to videoDurationSeconds with no gaps
- Target segment duration of 3-${segCap} seconds each; shorter for rapid transitions, longer for sustained moods
- No segment may exceed ${segCap} seconds — if a mood or energy level sustains beyond ${segCap} seconds, subdivide it at a natural musical phrase boundary (e.g. after a bar resolution, at a harmonic pivot, or at a dynamic shift), giving each sub-segment a slightly different musicalDescription reflecting its position in the sustained mood
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
- musicRole: decide how a composed score should coexist with the existing audio — use the definitions above
- narrativeRole: assign based on energy shape — the first segment is intro; the highest-energy segment is climax; segments rising toward the climax are rising action; segments falling after the climax are falling action; the final segment is resolution (unless there is only one post-climax segment, in which case it is simply resolution)
- musicalDescription: MUSIC ONLY per segment — act as a film score composer writing a brief for a session musician. Include: (1) specific instrument(s) with playing style/technique, (2) dynamic marking (pp/p/mp/mf/f/ff/fff), (3) emotional quality or textural character. 6-12 words. Absolutely no visual references
- transitionToNext: describe the precise musical gesture at the boundary between this segment and the next. Include dynamic direction, tempo change, harmonic shift, or articulation change. 4-8 words. Must be musically specific and actionable (e.g. not just 'crescendo' but 'strings build to fortissimo over 4 beats'). null for the final segment
- contextType: detect primary use-case — sports (athletic/competitive), dance (choreographed movement), product-video (commercial showcase), security-footage (surveillance/monitoring), social-media (short-form entertainment), interview-reaction (talking head/reaction/interview), general (other)
- audioContentTypes: identify ALL audio content types present — dialogue (spoken words), sound_effects (non-music events like impacts, doors, nature sounds), background_music (pre-existing music in the video), ambient (environmental noise like wind, room tone, crowd), silence (portions with no audio); include every type that appears
- dialogueTone and dialogueSentiment: ONLY populate these when dialogue is actually audible. dialogueTone describes the manner of speaking; dialogueSentiment describes the emotional valence of what is being said
- soundTexture: evaluate the character of transient audio events (sound effects, impacts, voices) — sharp = sudden high-frequency transients, blunt = heavy low-frequency impacts, soft = gentle understated sounds, layered = many audio sources simultaneously, sparse = isolated sounds with notable silence between them
- volumeDynamics: evaluate how the overall audio level moves across the full video timeline
- audioSummary: synthesise all audio observations into a single clear sentence a music composer could use
- audioNote per segment: listen to each time segment individually and describe only what you hear in that window
- microScores: analyze EVERY segment across all 11 categories; all numeric fields are floats 0.0-1.0 unless noted
- Positive-sense fields (1.0 = best): sharpness, focusQuality, exposure, contrast, brightnessStability, colorBalance, saturation, primarySubjectDetected, secondarySubjectCount, objectCount, subjectVisibility, faceVisibility, bodyVisibility, objectRelevance, subjectSizeInFrame, subjectCentering, globalMotionIntensity, localMotionIntensity, motionSmoothness, motionDirectionConsistency, movementSpeed, movementPrecision, movementSymmetry, trajectoryCoherence, actionComplexity, eventDensity, eventSalience, sceneContextConsistency, narrativeCoherence, causeEffectClarity, hookStrength, visualInterest, pacing, retentionPotential, novelty, emotionalImpact, memorability, scrollStoppingPower, rewatchability, energyLevel (attentionEngagement), all taskSpecific fields, speechPresence, speechClarity, musicPresence, soundEffectPresence, audioVisualSync, rhythmAlignment, toneMatch, modelConfidence, boundaryConfidence, crossFrameConsistency, reliabilityScore, all finalOutputs fields except penaltyScore
- Negative-sense fields (0.0 = none of the problem, 1.0 = worst): noiseLevel, compressionArtifacts (visualQuality), motionBlur, flicker, distortion, occlusionLevel (subjectAnalysis), cameraShake, jerkiness, backgroundNoiseLevel, predictionEntropy, ambiguityScore, missingDataRate, ALL safety fields (nsfwRisk, violenceRisk, privacyRisk, harmfulContentRisk, illegalContentRisk, faceSensitivity, moderationPenalty), penaltyScore (finalOutputs)
- segmentation fields: shotChanges and sceneChanges are density scores 0-1 (0=none, 1=high density); actionStartTime/actionPeakTime/actionEndTime are relative timestamps within the segment 0-1; segmentOverlap is continuity quality 0-1
- sceneUnderstanding strings: sceneCategory (e.g. "action", "dialogue", "landscape"), environmentType (e.g. "stadium", "office", "street"), indoorOutdoor ("indoor" | "outdoor" | "mixed"), activityType (primary observed activity)
- finalOutputs: compute segmentScore from segmentation quality; eventScore from scene salience and event density; technicalScore from visualQuality and confidence; aestheticScore from subjectAnalysis and visual quality; engagementScore from attentionEngagement; taskScore from taskSpecific; penaltyScore from safety.moderationPenalty; confidenceAdjustedScore = weighted composite × confidence.modelConfidence; finalClipScore = confidenceAdjustedScore × (1 − penaltyScore)
- genre: choose the single best-fit genre from the full list — lo-fi-hip-hop for mellow study/chill content; hip-hop for rap/urban; pop for mainstream catchy content; rock/indie/punk for guitar-driven energy; folk/acoustic for unplugged intimate content; blues for soulful slow content; r-and-b for smooth groove; jazz for swing/bebop; electronic/dance for synth-driven beats; classical for formal concert-hall; orchestral for large ensemble film style; cinematic for dramatic film-score feel; ambient for slow atmospheric; world for non-Western cultural music; default to cinematic only for genuinely dramatic filmic content
- drumsAppropriate: true for hip-hop, pop, rock, indie, blues, r-and-b, jazz, electronic, dance, world, punk, cinematic with accents, orchestral with accents; false for classical solo, pure ambient, intimate acoustic-only, and soundscapes without any rhythm section
- drumStyle: must match the genre — lo-fi-compressed for lo-fi-hip-hop; electronic-808 for hip-hop/electronic/dance; acoustic-kit for pop/rock/indie/blues/r-and-b; brushed-jazz for jazz; orchestral-bass-drum for orchestral/cinematic only on structural accents; none when drumsAppropriate is false
- vocalPresence: default to none for all genres except when the content specifically warrants human vocal elements; choir-pads reserved for genuinely triumphant/transcendent orchestral climaxes; backing-harmonies for pop/folk/indie with clear emotional warmth; vocal-chops for electronic/hip-hop only; humming for quiet intimate introspection; scat for jazz; when uncertain choose none`;
}

function parseMicroScores(raw: unknown): MicroSegmentScores | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  const sub = (key: string) => (m[key] && typeof m[key] === 'object' ? m[key] : {}) as Record<string, unknown>;
  const f = (v: unknown, d: number) => Math.min(1, Math.max(0, typeof v === 'number' ? v : d));
  const s = (v: unknown, fallback: string) => typeof v === 'string' && v ? v : fallback;

  const sg = sub('segmentation');
  const vq = sub('visualQuality');
  const sa = sub('subjectAnalysis');
  const ma = sub('motionAnalysis');
  const su = sub('sceneUnderstanding');
  const ae = sub('attentionEngagement');
  const ts = sub('taskSpecific');
  const au = sub('audio');
  const co = sub('confidence');
  const sf = sub('safety');
  const fo = sub('finalOutputs');

  const segmentation: SegmentationScores = {
    shotChanges: f(sg.shotChanges, 0.5),
    sceneChanges: f(sg.sceneChanges, 0.4),
    actionStartTime: f(sg.actionStartTime, 0.1),
    actionPeakTime: f(sg.actionPeakTime, 0.5),
    actionEndTime: f(sg.actionEndTime, 0.9),
    segmentOverlap: f(sg.segmentOverlap, 0.3),
  };
  const visualQuality: VisualQualityScores = {
    sharpness: f(vq.sharpness, 0.72),
    focusQuality: f(vq.focusQuality, 0.72),
    exposure: f(vq.exposure, 0.70),
    contrast: f(vq.contrast, 0.65),
    brightnessStability: f(vq.brightnessStability, 0.78),
    colorBalance: f(vq.colorBalance, 0.70),
    saturation: f(vq.saturation, 0.65),
    noiseLevel: f(vq.noiseLevel, 0.15),
    compressionArtifacts: f(vq.compressionArtifacts, 0.12),
    motionBlur: f(vq.motionBlur, 0.12),
    flicker: f(vq.flicker, 0.08),
    distortion: f(vq.distortion, 0.07),
  };
  const subjectAnalysis: SubjectAnalysisScores = {
    primarySubjectDetected: f(sa.primarySubjectDetected, 0.85),
    secondarySubjectCount: f(sa.secondarySubjectCount, 0.40),
    objectCount: f(sa.objectCount, 0.50),
    subjectVisibility: f(sa.subjectVisibility, 0.72),
    occlusionLevel: f(sa.occlusionLevel, 0.18),
    faceVisibility: f(sa.faceVisibility, 0.40),
    bodyVisibility: f(sa.bodyVisibility, 0.55),
    objectRelevance: f(sa.objectRelevance, 0.68),
    subjectSizeInFrame: f(sa.subjectSizeInFrame, 0.60),
    subjectCentering: f(sa.subjectCentering, 0.62),
  };
  const motionAnalysis: MotionAnalysisScores = {
    globalMotionIntensity: f(ma.globalMotionIntensity, 0.45),
    localMotionIntensity: f(ma.localMotionIntensity, 0.40),
    cameraShake: f(ma.cameraShake, 0.14),
    motionSmoothness: f(ma.motionSmoothness, 0.68),
    motionDirectionConsistency: f(ma.motionDirectionConsistency, 0.72),
    movementSpeed: f(ma.movementSpeed, 0.45),
    movementPrecision: f(ma.movementPrecision, 0.65),
    movementSymmetry: f(ma.movementSymmetry, 0.58),
    jerkiness: f(ma.jerkiness, 0.12),
    trajectoryCoherence: f(ma.trajectoryCoherence, 0.70),
  };
  const sceneUnderstanding: SceneUnderstandingScores = {
    sceneCategory: s(su.sceneCategory, 'general'),
    environmentType: s(su.environmentType, 'unknown'),
    indoorOutdoor: s(su.indoorOutdoor, 'mixed'),
    activityType: s(su.activityType, 'general activity'),
    actionComplexity: f(su.actionComplexity, 0.55),
    eventDensity: f(su.eventDensity, 0.50),
    eventSalience: f(su.eventSalience, 0.60),
    sceneContextConsistency: f(su.sceneContextConsistency, 0.72),
    narrativeCoherence: f(su.narrativeCoherence, 0.68),
    causeEffectClarity: f(su.causeEffectClarity, 0.60),
  };
  const attentionEngagement: AttentionEngagementScores = {
    hookStrength: f(ae.hookStrength, 0.55),
    visualInterest: f(ae.visualInterest, 0.62),
    pacing: f(ae.pacing, 0.64),
    retentionPotential: f(ae.retentionPotential, 0.60),
    novelty: f(ae.novelty, 0.58),
    emotionalImpact: f(ae.emotionalImpact, 0.62),
    memorability: f(ae.memorability, 0.55),
    scrollStoppingPower: f(ae.scrollStoppingPower, 0.52),
    rewatchability: f(ae.rewatchability, 0.50),
    energyLevel: f(ae.energyLevel, 0.55),
  };
  const taskSpecific: TaskSpecificScores = {
    taskRelevance: f(ts.taskRelevance, 0.68),
    classificationAccuracy: f(ts.classificationAccuracy, 0.72),
    techniqueQuality: f(ts.techniqueQuality, 0.68),
    timingAccuracy: f(ts.timingAccuracy, 0.65),
    completionQuality: f(ts.completionQuality, 0.70),
    successProbability: f(ts.successProbability, 0.65),
    goalAlignment: f(ts.goalAlignment, 0.68),
    rankingScore: f(ts.rankingScore, 0.60),
  };
  const audio: AudioAnalysisScores = {
    speechPresence: f(au.speechPresence, 0.30),
    speechClarity: f(au.speechClarity, 0.65),
    backgroundNoiseLevel: f(au.backgroundNoiseLevel, 0.20),
    musicPresence: f(au.musicPresence, 0.35),
    soundEffectPresence: f(au.soundEffectPresence, 0.25),
    audioVisualSync: f(au.audioVisualSync, 0.72),
    rhythmAlignment: f(au.rhythmAlignment, 0.65),
    toneMatch: f(au.toneMatch, 0.68),
  };
  const confidence: ConfidenceScores = {
    modelConfidence: f(co.modelConfidence, 0.75),
    predictionEntropy: f(co.predictionEntropy, 0.25),
    ambiguityScore: f(co.ambiguityScore, 0.20),
    missingDataRate: f(co.missingDataRate, 0.10),
    boundaryConfidence: f(co.boundaryConfidence, 0.70),
    crossFrameConsistency: f(co.crossFrameConsistency, 0.75),
    reliabilityScore: f(co.reliabilityScore, 0.72),
  };
  const safety: SafetyScores = {
    nsfwRisk: f(sf.nsfwRisk, 0.02),
    violenceRisk: f(sf.violenceRisk, 0.04),
    privacyRisk: f(sf.privacyRisk, 0.05),
    harmfulContentRisk: f(sf.harmfulContentRisk, 0.02),
    illegalContentRisk: f(sf.illegalContentRisk, 0.01),
    faceSensitivity: f(sf.faceSensitivity, 0.30),
    moderationPenalty: f(sf.moderationPenalty, 0.02),
  };
  const finalOutputs: FinalOutputScores = {
    segmentScore: f(fo.segmentScore, 0.65),
    eventScore: f(fo.eventScore, 0.62),
    technicalScore: f(fo.technicalScore, 0.70),
    aestheticScore: f(fo.aestheticScore, 0.67),
    engagementScore: f(fo.engagementScore, 0.62),
    taskScore: f(fo.taskScore, 0.65),
    penaltyScore: f(fo.penaltyScore, 0.02),
    confidenceAdjustedScore: f(fo.confidenceAdjustedScore, 0.65),
    finalClipScore: f(fo.finalClipScore, 0.65),
  };

  return {
    segmentation, visualQuality, subjectAnalysis, motionAnalysis,
    sceneUnderstanding, attentionEngagement, taskSpecific, audio,
    confidence, safety, finalOutputs,
  };
}

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

    const prompt = buildAnalysisPrompt(metadata.durationSeconds);
    const response = await this.generateWithRetry(file.uri!, file.mimeType!, prompt);

    // Clean up uploaded file (best-effort)
    this.ai.files.delete({ name: file.name! }).catch(() => undefined);

    const raw = response.text ?? '';
    const analysis = this.parseResponse(raw, metadata);

    return { videoPath, metadata, analysis };
  }

  private async generateWithRetry(fileUri: string, fileMimeType: string, prompt: string) {
    const maxAttempts = 4;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 65536,
            temperature: 0.1,
            thinkingConfig: { thinkingBudget: 0 },
          },
          contents: createUserContent([
            createPartFromUri(fileUri, fileMimeType),
            prompt,
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
      throw new Error(`Gemini returned an invalid JSON response. Raw: ${raw.slice(0, 500)}`);
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
      contextType: toContextType(parsed.contextType),
      audioContentTypes: toAudioContentTypes(parsed.audioContentTypes),
      dialogueTone: toDialogueTone(parsed.dialogueTone),
      dialogueSentiment: toDialogueSentiment(parsed.dialogueSentiment),
      soundTexture: toSoundTexture(parsed.soundTexture),
      volumeDynamics: toVolumeDynamics(parsed.volumeDynamics),
      audioSummary: typeof parsed.audioSummary === 'string' && parsed.audioSummary
        ? parsed.audioSummary
        : undefined,
      audioDialogueDominant: Array.isArray(parsed.audioContentTypes) &&
        (parsed.audioContentTypes as unknown[]).includes('dialogue') &&
        toAudioEnergyLevel(parsed.audioEnergyLevel) !== 'silent',
      drumsAppropriate: typeof parsed.drumsAppropriate === 'boolean' ? parsed.drumsAppropriate : undefined,
      drumStyle: toDrumStyle(parsed.drumStyle),
      vocalPresence: toVocalPresence(parsed.vocalPresence),
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

      const musicalDescription = typeof seg.musicalDescription === 'string' && seg.musicalDescription
        ? seg.musicalDescription
        : undefined;
      const transitionToNext = typeof seg.transitionToNext === 'string' && seg.transitionToNext
        ? seg.transitionToNext
        : undefined;
      const VALID_NARRATIVE_ROLES = ['intro', 'rising action', 'climax', 'falling action', 'resolution'];
      const narrativeRole = typeof seg.narrativeRole === 'string' && VALID_NARRATIVE_ROLES.includes(seg.narrativeRole)
        ? seg.narrativeRole
        : undefined;

      return {
        startSeconds: toNumber(seg.startSeconds, 0),
        endSeconds: toNumber(seg.endSeconds, totalDuration),
        mood,
        energyLevel,
        label,
        musicalDescription,
        transitionToNext,
        narrativeRole,
        audioNote: typeof seg.audioNote === 'string' && seg.audioNote ? seg.audioNote : undefined,
        microScores: parseMicroScores(seg.microScores),
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
      { startSeconds: 0, endSeconds: third, mood: 'calm', energyLevel: 'low', label: 'Opening — calm, low energy', narrativeRole: 'intro', transitionToNext: 'crescendo' },
      { startSeconds: third, endSeconds: third * 2, mood: 'emotional', energyLevel: 'medium', label: 'Mid — emotional, medium energy', narrativeRole: 'rising action', transitionToNext: 'builds' },
      { startSeconds: third * 2, endSeconds: duration, mood: 'inspirational', energyLevel: 'high', label: 'Resolution — inspirational, high energy', narrativeRole: 'climax' },
    ];
  }
}
