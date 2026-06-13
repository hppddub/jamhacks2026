# CLAUDE.md — BananaMOV

This file is the persistent technical memory for Claude Code working on this project. Read it fully at the start of every session before writing any code. It is the authoritative source of truth for architecture decisions, coding conventions, and implementation rules. SPEC.md is the product specification; this file is the engineering implementation guide.

---

## Project Identity

**Name:** BananaMOV
**Purpose:** AI-powered video scoring platform — upload a video, analyze its visual and audio arc across the timeline, generate a matching music score via ElevenLabs.
**Context:** Built for JamHacks 2026. ElevenLabs is a track prize sponsor — ElevenLabs Sound Generation is the required production music API.
**Status:** MVP complete. All phases implemented and building. Full workflow runs with mock providers by default; Gemini analysis and ElevenLabs music enabled via env vars.

---

## Repository Layout

```
jamhacks2026/
├── CLAUDE.md                              ← you are here
├── SPEC.md                                ← product specification
├── .env.local                             ← secrets (gitignored)
├── .env.example                           ← template (committed)
├── app/
│   ├── layout.tsx                         ← root layout, Geist fonts, Providers, metadata
│   ├── page.tsx                           ← ONLY page — entire workflow lives here
│   ├── providers.tsx                      ← 'use client' QueryClientProvider wrapper
│   ├── globals.css                        ← Tailwind v4 imports, CSS vars, fadeIn keyframe
│   └── api/
│       ├── upload/route.ts                ← POST /api/upload
│       ├── analyze/route.ts               ← POST /api/analyze
│       ├── generate/route.ts              ← POST /api/generate
│       └── stems/route.ts                 ← POST /api/stems (maxDuration=180)
├── components/
│   ├── upload/
│   │   ├── DropZone.tsx
│   │   └── VideoPreview.tsx
│   ├── analysis/
│   │   ├── AnalysisCard.tsx               ← overall profile card
│   │   └── TimelineBar.tsx                ← horizontal colored segment timeline
│   ├── player/
│   │   ├── AudioPlayer.tsx                ← custom HTML Audio API player + waveform
│   │   ├── DownloadButton.tsx
│   │   └── StemPlayer.tsx                 ← per-stem mini player grid
│   └── ui/                                ← shadcn/ui generated (never edit manually)
├── hooks/
│   └── useWorkflow.ts                     ← state machine + all TanStack Query mutations
├── lib/
│   ├── providers/
│   │   ├── types.ts                       ← VideoAnalysisProvider + MusicGenerationProvider interfaces
│   │   ├── factory.ts                     ← getAnalysisProvider(), getMusicProvider()
│   │   ├── analysis/
│   │   │   ├── MockAnalyzer.ts            ← seeded-random arc + analysis
│   │   │   └── GeminiAnalyzer.ts          ← Google Gemini 2.5 Flash video analysis
│   │   └── music/
│   │       ├── buildPrompt.ts             ← shared prompt + tags construction
│   │       ├── MockMusicProvider.ts       ← lamejs PCM synthesis → real MP3
│   │       └── ElevenLabsProvider.ts      ← ElevenLabs Sound Generation API
│   │   └── stems/
│   │       ├── types.ts                   ← StemSeparationProvider interface
│   │       ├── factory.ts                 ← getStemProvider()
│   │       ├── MockStemProvider.ts        ← PCM-synthesised mock stems
│   │       ├── LocalDemucsProvider.ts     ← free: runs python -m demucs as subprocess
│   │       └── ReplicateProvider.ts       ← Replicate Demucs v4 stem separation (costs $)
│   ├── audio/
│   │   └── generateTone.ts               ← PCM synthesis + lamejs MP3 encoding; generateStemMp3 for mock stems
│   └── utils.ts                           ← cn, formatDuration, formatFileSize,
│                                          ←   seededRandom, hashString, generateId, delay
├── types/
│   └── index.ts                           ← ALL shared TypeScript types
└── public/
    ├── uploads/                            ← uploaded videos (runtime, gitignored)
    └── generated/                          ← generated MP3s (runtime, gitignored)
```

**Rule:** Never create files outside this structure without a strong reason. Never add top-level directories.

---

## Tech Stack — Precise Rules

### Next.js 16 (App Router)
- App Router exclusively. No Pages Router patterns ever.
- API routes: `app/api/*/route.ts`, export named HTTP method handlers (`POST`, `GET`, etc.).
- Server Components are the default. Add `'use client'` only when the component uses browser APIs, event handlers, `useState`, or `useEffect`.
- Never use `getServerSideProps`, `getStaticProps`, or `pages/`. Those are Pages Router.
- Route handlers return `NextResponse.json(data)` for success and `NextResponse.json({ error }, { status: N })` for errors.
- `app/page.tsx` is `'use client'` because it calls `useWorkflow()`.

### TypeScript — Strict Mode
- `strict: true` is required. No `any` unless unavoidable; use `unknown` + type guards instead.
- All types shared across files live in `types/index.ts`. Never redeclare inline.
- Prefer `interface` for object shapes, `type` for unions and primitives.
- Handle `null` and `undefined` explicitly. Use `?.` and `??` liberally. No `!` non-null assertions unless provably safe.

### Tailwind CSS v4
- Uses Tailwind v4 syntax: `@import "tailwindcss"` in `globals.css` (not `@tailwind base/components/utilities`).
- `globals.css` also imports `"tw-animate-css"` and `"shadcn/tailwind.css"`.
- The shadcn CSS variable system defines both `:root` and `.dark` using oklch color values.
- `html` element in `layout.tsx` has `className="... dark"` — dark mode is always active.
- Use utility classes directly. `cn()` from `lib/utils.ts` for conditional merging (combines `clsx` + `tailwind-merge`).
- Do not write custom CSS unless it cannot be expressed in Tailwind utilities (keyframe animations are the exception; the `fadeIn` keyframe in `globals.css` is the only custom CSS).

### shadcn/ui
- Components live in `components/ui/`. Do not edit them manually.
- Import from `@/components/ui/<component>`.
- Current installed components: `button`, `badge`, `card`.

### TanStack Query v5
- `QueryClientProvider` lives in `app/providers.tsx` (a `'use client'` wrapper component).
- `QueryClient` is configured with `defaultOptions: { mutations: { retry: 0 } }` — no automatic retries on mutations.
- Use `useMutation` for all three workflow steps — not `useQuery`. These are user-triggered actions, not passive fetches.
- All mutations live inside `hooks/useWorkflow.ts`. Components never call `fetch` directly.

### lamejs (Mock MP3 encoding)
- CommonJS module. Import with `require`:
  ```ts
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lamejs = require('lamejs') as { Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => LameMp3Encoder };
  ```
- Define `LameMp3Encoder` interface locally in `generateTone.ts`.
- Chunk size must be **1152 samples** (lamejs internal requirement — multiple of 576).
- Only used in `generateTone.ts`. Never imported elsewhere.

### ElevenLabs SDK
- Package: `elevenlabs` (also `@elevenlabs/elevenlabs-js` present in package.json)
- Import: `import { ElevenLabsClient } from 'elevenlabs'`
- Used only in `ElevenLabsProvider.ts`. Never imported in routes or components directly.
- Client instantiated with `new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })`.
- Constructor throws if `ELEVENLABS_API_KEY` is absent.

### Google Gemini SDK
- Package: `@google/genai`
- Import: `import { GoogleGenAI, FileState, createUserContent, createPartFromUri } from '@google/genai'`
- Used only in `GeminiAnalyzer.ts`. Never imported in routes or components directly.
- Client instantiated with `new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`.
- Constructor throws if `GEMINI_API_KEY` is absent.

---

## State Machine — The Heart of the Application

Single `WorkflowState` object managed in `hooks/useWorkflow.ts`. No other source of truth.

### Valid Step Transitions

```
idle        → uploading   (user clicks "Upload & Continue")
uploading   → uploaded    (POST /api/upload succeeds)
uploaded    → analyzing   (user clicks "Analyze Video")
analyzing   → analyzed    (POST /api/analyze succeeds)
analyzed    → generating  (user clicks "Generate Score")
generating  → completed   (POST /api/generate succeeds)
```

Error regressions (step goes backward, error is set):
```
uploading   → idle        (upload error)
analyzing   → uploaded    (analyze error)
generating  → analyzed    (generate error)
```

Reset transitions:
```
any step    → idle        (reset() or removeFile())
```

### Important: File selection is NOT upload

`selectFile(file)` sets `step: 'idle'` with the file stored — it does NOT trigger upload. Upload happens explicitly when the user clicks "Upload & Continue →" which calls `upload()`. This means `step === 'idle'` can have a `videoFile` present.

### Error Behavior
- On mutation error: set `state.error` AND regress `state.step` to the previous stable step.
- Error banner shows "Retry" (re-triggers the failed action) and "Start Over" (calls `reset()`).
- `reset()` wipes everything back to the idle default and revokes any objectUrl.

### Default State
```ts
const defaultState: WorkflowState = {
  step: 'idle',
  videoFile: null,
  videoObjectUrl: null,
  uploadedVideoPath: null,
  uploadedMetadata: null,
  analysis: null,
  score: null,
  error: null,
};
```

### useWorkflow Exports
```ts
{
  state: WorkflowState;
  selectFile: (file: File) => void;   // stores file, creates objectUrl, stays at idle
  removeFile: () => void;             // revokes objectUrl, returns to full defaultState
  upload: () => void;                 // sets step 'uploading', fires uploadMutation
  analyze: () => void;                // sets step 'analyzing', fires analyzeMutation
  generate: () => void;               // sets step 'generating', fires generateMutation
  reset: () => void;                  // revokes objectUrl, returns to full defaultState
}
```

---

## Provider Architecture — Critical Rules

### The Two Interfaces (`lib/providers/types.ts`)
```ts
interface VideoAnalysisProvider {
  analyze(videoPath: string, metadata: VideoMetadata): Promise<AnalysisResult>;
}
interface MusicGenerationProvider {
  generate(analysis: AnalysisResult): Promise<GeneratedScore>;
}
```

### The Factory (`lib/providers/factory.ts`)
```ts
export function getAnalysisProvider(): VideoAnalysisProvider
export function getMusicProvider(): MusicGenerationProvider
```
- `getAnalysisProvider()`: reads `process.env.ANALYSIS_PROVIDER` (default `'mock'`); returns `GeminiAnalyzer` for `'gemini'`, else `MockAnalyzer`.
- `getMusicProvider()`: reads `process.env.MUSIC_PROVIDER` (default `'mock'`); returns `ElevenLabsProvider` for `'elevenlabs'`, else `MockMusicProvider`.
- This is the ONLY place that imports concrete providers.
- API routes call the factory and never import concrete providers directly.

### Adding a New Provider Later
1. Create the file (e.g. `lib/providers/music/SunoProvider.ts`) implementing the interface
2. Add a case to the relevant factory function
3. Set the env var in `.env.local`
4. Zero changes to routes, hooks, or components

---

## GeminiAnalyzer — Implementation Details

**File:** `lib/providers/analysis/GeminiAnalyzer.ts`

### Constructor validation
Throws immediately if `GEMINI_API_KEY` is not set, with a helpful message pointing to `.env.local`.

### Video upload and polling
```ts
const uploadedFile = await this.ai.files.upload({
  file: videoPath,        // absolute filesystem path
  config: { mimeType, displayName: metadata.filename },
});

// Poll until ACTIVE (max 30 attempts at 3s intervals = ~90 seconds)
while (file.state === FileState.PROCESSING && attempts < 30) {
  await delay(3000);
  file = await this.ai.files.get({ name: file.name! });
  attempts++;
}
if (file.state !== FileState.ACTIVE) {
  throw new Error(`Gemini video processing failed (state: ${file.state}). Try again.`);
}
```

### MIME type mapping
```ts
const MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};
```
Extension derived from `metadata.filename`, defaults to `'video/mp4'` if unknown.

### Analysis prompt
The static `ANALYSIS_PROMPT` constant defines a detailed JSON schema requiring:
- `videoDurationSeconds`, `mood`, `energyLevel`, `pace`, `bpm`, `genre`, `sceneCount`, `motionScore`, `instrumentSuggestions`, `analysisSummary`
- Visual fields: `colorPalette`, `cameraStyle`, `visualPace`, `settingType`, `emotionalArc`, `sonicTexture`, `musicalRecommendation`, `keyMode`, `rhythmicFeel`, `dynamicArc`
- Audio fields: `existingAudio`, `audioEnergyLevel`, `musicRole`, `audioContentTypes`, `dialogueTone` (dialogue only), `dialogueSentiment` (dialogue only), `soundTexture`, `volumeDynamics`, `audioSummary`
- `timeline`: array of 3–5 segments, each with `startSeconds`, `endSeconds`, `mood`, `energyLevel`, `label`, `audioNote`
- BPM guidance: low energy → 60-90, medium → 90-120, high → 120-160
- Model: `gemini-2.5-flash`

**Audio analysis rules in the prompt:**
- `audioContentTypes`: identify ALL types present — `dialogue`, `sound_effects`, `background_music`, `ambient`, `silence`
- `dialogueTone` / `dialogueSentiment`: only populated when dialogue is audible; omitted otherwise
- `soundTexture`: character of transient audio events — `sharp` (sudden high-freq transients), `blunt` (heavy low-freq), `soft` (gentle), `layered` (many simultaneous sources), `sparse` (isolated with silence)
- `volumeDynamics`: how overall audio level moves — `consistent`, `building`, `dropping`, `erratic`, `dynamic`
- `audioSummary`: 1-sentence synthesis of all audio observations
- `audioNote` per segment: 5–10 words on dominant audio event in that time window

### Retry logic (`generateWithRetry`)
- Up to 4 attempts
- Only retries on transient signals: message includes `503`, `UNAVAILABLE`, `overloaded`, or `high demand`
- Exponential backoff: 4s → 8s → 16s (formula: `4000 * 2 ** (attempt - 1)`)
- Non-transient errors throw immediately on first occurrence

### Response parsing
- `extractJson(raw)`: strips markdown code fences (` ```json ... ``` ` or ` ``` ... ``` `) before `JSON.parse`
- Guard functions with safe fallbacks: `toMood` (fallback: `'emotional'`), `toEnergy` (fallback: `'medium'`), `toPace` (fallback: `'moderate'`), `toGenre` (fallback: `'cinematic'`), `toNumber` (fallback: provided), `toStringArray` (fallback: `[]`)
- Audio guard functions (return `undefined` on invalid): `toAudioEnergyLevel`, `toMusicRole`, `toAudioContentTypes` (returns `[]` on invalid), `toDialogueTone`, `toDialogueSentiment`, `toSoundTexture`, `toVolumeDynamics`
- `audioDialogueDominant` is derived: `true` when `audioContentTypes` includes `'dialogue'` AND `audioEnergyLevel !== 'silent'`
- `videoDurationSeconds` from parsed JSON is stored back into `metadata.durationSeconds`
- BPM clamped: `Math.round(Math.min(160, Math.max(60, toNumber(parsed.bpm, 100))))`
- MotionScore clamped: `Math.round(Math.min(1, Math.max(0, toNumber(parsed.motionScore, 0.5))) * 100) / 100`
- Timeline sorted by `startSeconds`, then `segments[0].startSeconds = 0` and `segments[last].endSeconds = totalDuration` forced
- Each timeline segment now includes optional `audioNote` parsed from the response

### Timeline fallback
If `raw.timeline` is not an array or has fewer than 2 entries, `fallbackTimeline(duration)` returns 3 equal-width segments: `calm/low` → `emotional/medium` → `inspirational/high`.

### Cleanup
After successful analysis, `this.ai.files.delete({ name: file.name! }).catch(() => undefined)` — best-effort, never throws.

---

## ElevenLabs Provider — Implementation Details

**File:** `lib/providers/music/ElevenLabsProvider.ts`

### Constructor validation
Throws immediately if `ELEVENLABS_API_KEY` is not set, with a helpful message.

### API call
```ts
const audioStream = await this.client.textToSoundEffects.convert({
  text: prompt,               // from buildPrompt(), max 1000 chars
  duration_seconds: Math.min(metadata.durationSeconds ?? 20, 22),
  prompt_influence: 0.5,
});
```

### Response handling
```ts
const chunks: Buffer[] = [];
for await (const chunk of audioStream) {
  chunks.push(Buffer.from(chunk));
}
const buffer = Buffer.concat(chunks);
if (buffer.length === 0) throw new Error('ElevenLabs returned an empty audio response.');
const id = generateId();
const outputDir = path.join(process.cwd(), 'public', 'generated');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, `${id}.mp3`), buffer);
```

### Return value
```ts
{
  audioUrl: `/generated/${id}.mp3`,
  durationSeconds,            // Math.min(metadata.durationSeconds ?? 20, 22)
  bpm: analysis.bpm,
  genre: analysis.genre,
  mood: analysis.mood,
  filename: `score-${analysis.mood}-${analysis.bpm}bpm.mp3`,
  prompt,
}
```

---

## Shared Prompt Builder (`lib/providers/music/buildPrompt.ts`)

Two exported functions. Both `MockMusicProvider` and `ElevenLabsProvider` import from here.

### `buildPrompt(result: AnalysisResult): string`

Pure function. Constructs a natural language description of the desired music. Max 450 characters assembled via `assemble()` which skips parts that would exceed the budget rather than truncating.

**Two paths:**
- **Path A** (preferred): when Gemini returns a clean `musicalRecommendation` with no visual leakage, it is used as the centrepiece
- **Path B** (fallback): translates visual properties (`sonicTexture`, `settingType`, `colorPalette`) into sonic descriptors

**Audio context modifier** — derived from new audio fields and inserted after `roleStr` in both paths:
- `audioDialogueDominant === true` → adds `"understated — must not compete with spoken word"`
- `soundTexture === 'sharp'` → adds `"leave space for sharp audio transients"`
- `soundTexture === 'layered'` → adds `"blend into a dense, layered audio environment"`
- `soundTexture === 'sparse'` → adds `"minimal texture — sparse audio environment"`
- `volumeDynamics === 'building'` → adds `"mirror the building volume arc"`
- `volumeDynamics === 'erratic'` → adds `"maintain steady underscoring through erratic audio changes"`
- `volumeDynamics === 'dropping'` → adds `"gently fade alongside the dropping audio energy"`

`MUSIC_ROLE_DESCRIPTOR` map drives the `roleStr` (inserted before audio context):
- `background-underscore` → "Composed as a subtle background underscore — restrained, supportive."
- `featured-score` → "Composed as a featured score — full presence, emotionally centred."
- `sync-to-action` → "Composed to sync with action beats — rhythmically tight, punchy hits."
- `ambient-complement` → "Composed as ambient complement — airy, unobtrusive, blends with natural sound."

### `buildTags(result: AnalysisResult): string[]`

Returns up to 10 tags: `[mood, genre, "{energy} energy", "{pace} pace", ...instrumentSuggestions.slice(0, 3)]`. Intended for ElevenLabs tag fields (API allows max 10).

---

## Audio Analysis Type System

New types added to `types/index.ts` as part of the audio characterization feature:

```ts
export type AudioContentType = 'dialogue' | 'sound_effects' | 'background_music' | 'ambient' | 'silence';
export type DialogueTone     = 'formal' | 'casual' | 'emotional' | 'tense' | 'upbeat';
export type DialogueSentiment = 'positive' | 'neutral' | 'negative' | 'mixed';
export type SoundTexture     = 'sharp' | 'blunt' | 'soft' | 'layered' | 'sparse';
export type VolumeDynamics   = 'consistent' | 'building' | 'dropping' | 'erratic' | 'dynamic';
```

`TimelineSegment` extended with:
```ts
audioNote?: string;   // 5-10 word descriptor of dominant audio activity in this segment
```

`VideoAnalysis` extended with:
```ts
audioContentTypes?:    AudioContentType[];  // all audio types present in the video
dialogueTone?:         DialogueTone;        // only set when dialogue is audible
dialogueSentiment?:    DialogueSentiment;   // only set when dialogue is audible
soundTexture?:         SoundTexture;        // character of transient/non-music audio events
volumeDynamics?:       VolumeDynamics;      // how overall audio volume moves across the video
audioSummary?:         string;              // 1-sentence synthesis of all audio observations
audioDialogueDominant?: boolean;           // true when dialogue is present and audio is not silent
```

**Semantic rules:**
- `dialogueTone` and `dialogueSentiment` are always `undefined` when `audioContentTypes` does not include `'dialogue'`
- `audioDialogueDominant` is derived (not directly set by Gemini): `audioContentTypes.includes('dialogue') && audioEnergyLevel !== 'silent'`
- These fields are all optional — components and `buildPrompt` must guard against `undefined`

---

## Mock Provider — Implementation Details

### MockAnalyzer (`lib/providers/analysis/MockAnalyzer.ts`)

**Seeded PRNG:** `seededRandom(hashString(videoPath + String(metadata.sizeBytes)))`. Same video → same result.

**Arc templates (verbatim):**
```ts
// 3-segment
[{ energy: 0, moodPool: ['calm', 'emotional'] },
 { energy: 2, moodPool: ['dramatic', 'energetic', 'suspenseful'] },
 { energy: 1, moodPool: ['inspirational', 'emotional', 'corporate'] }]

// 4-segment
[{ energy: 0, moodPool: ['calm', 'corporate'] },
 { energy: 1, moodPool: ['suspenseful', 'emotional'] },
 { energy: 2, moodPool: ['dramatic', 'energetic'] },
 { energy: 0, moodPool: ['emotional', 'inspirational'] }]

// 5-segment
[{ energy: 0, moodPool: ['calm'] },
 { energy: 1, moodPool: ['emotional', 'suspenseful'] },
 { energy: 2, moodPool: ['dramatic', 'energetic'] },
 { energy: 2, moodPool: ['energetic', 'dramatic'] },
 { energy: 0, moodPool: ['emotional', 'inspirational'] }]
```
Energy indices: 0=low, 1=medium, 2=high.

**Segment width proportioning:** random weights in [0.5, 1.0], normalized to fill `totalDuration` (default 30s if `metadata.durationSeconds` is absent).

**Overall profile driven by peak segment** (highest energy in the arc):
- `mood` and `energyLevel` from the peak segment
- BPM ranges: low=[60, 90], medium=[90, 120], high=[120, 160]
- Genre from pool of 6, pace from pool of 3 — both seeded
- SceneCount: `Math.round(3 + rand() * 37)` → [3, 40]
- MotionScore: `Math.round((0.1 + rand() * 0.9) * 100) / 100` → [0.10, 1.00]
- Instruments: 2–4 items shuffled from pool of 15

**Instrument pool:**
`strings, piano, drums, guitar, bass, brass, flute, synth, violin, cello, percussion, choir, harp, saxophone, organ`

**analysisSummary template:**
```
"This {pace} {peak.mood} video has {peak.energyLevel} peak energy with approximately {sceneCount} scene cuts, suggesting a {genre} score around {bpm} BPM featuring {instr[0]} and {instr[1]}."
```

**Audio fields (all seeded):**
- `audioContentTypes`: picked from 10 preset combinations (e.g. `['dialogue', 'background_music']`, `['sound_effects', 'ambient']`, `['silence']`)
- `dialogueTone` / `dialogueSentiment`: only set when `dialogue` is in `audioContentTypes` AND `audioEnergyLevel !== 'silent'`; picked from pools of 5 and 4 values respectively
- `soundTexture`: picked from `['sharp', 'blunt', 'soft', 'layered', 'sparse']`
- `volumeDynamics`: picked from `['consistent', 'building', 'dropping', 'erratic', 'dynamic']`
- `audioDialogueDominant`: `true` only when dialogue is the sole content type and energy is not silent
- `audioSummary`: constructed from the above — tone of dialogue if present, otherwise texture/dynamics description
- `musicRole`: derived from `audioEnergyLevel` (loud→`background-underscore`, silent→`featured-score`, moderate→random of sync-to-action/ambient-complement, quiet→`ambient-complement`)
- Each `TimelineSegment` now includes `audioNote`: picked from a pool of 10 descriptive strings

**Delay:** `delay(2000 + Math.random() * 1000)` (2–3 seconds; uses `Math.random()`, not seeded)

### MockMusicProvider (`lib/providers/music/MockMusicProvider.ts`)

- Calls `buildPrompt(result)` — same function as ElevenLabsProvider
- Calls `generateMp3(analysis, outputPath)` to synthesize real PCM audio
- Returns duration from `generateMp3` return value
- **Delay:** `delay(3000 + Math.random() * 2000)` (3–5 seconds) applied AFTER synthesis
- Filename: `score-${analysis.mood}-${analysis.bpm}bpm.mp3`

### MockStemProvider (`lib/providers/stems/MockStemProvider.ts`)

- Implements `StemSeparationProvider`; ignores the source audio URL entirely (can't decode MP3 in pure Node)
- Generates 4 stems using `generateStemMp3` with fixed musical parameters:
  - `drums` (80 Hz, amplitude 0.55, `percussive`) — noise burst + kick thump on beats 1 & 3
  - `bass` (65.41 Hz / C2, amplitude 0.50, `continuous`) — deep sine + first harmonic
  - `melody` (261.63 Hz / C4, amplitude 0.40, `continuous`) — mid-range harmonic sine
  - `vocals` (392.00 Hz / G4, amplitude 0.08, `sparse`) — near-silent sporadic tones
- Fixed duration of 20 seconds and BPM of 100 for all mock stems
- Writes stems to `public/stems/{jobId}/{stemId}.mp3`
- **Delay:** `delay(2000 + Math.random() * 1500)` (2–3.5 seconds) applied AFTER synthesis

---

## Stem Separation — Implementation Details

### Type System (`types/index.ts`)
```ts
export type StemId   = 'drums' | 'bass' | 'melody' | 'vocals';
export type StemStep = 'idle' | 'separating' | 'stems_ready' | 'stems_error';

export interface Stem {
  id: StemId;
  label: string;    // e.g. "Drums & Percussion"
  audioUrl: string; // e.g. /stems/{jobId}/drums.mp3
}

export interface StemResult {
  jobId: string;
  stems: Stem[];
  sourceAudioUrl: string;
}
```

`WorkflowState` additions:
```ts
stemStep:  StemStep;       // starts 'idle', resets to 'idle' on reset()
stems:     StemResult | null;
stemError: string | null;
```

### Provider Interface (`lib/providers/stems/types.ts`)
```ts
export interface StemSeparationProvider {
  separate(audioUrl: string): Promise<StemResult>;
}
```

### Factory (`lib/providers/stems/factory.ts`)
- Reads `STEM_PROVIDER` env var (default `'mock'`)
- Returns `LocalDemucsProvider` for `'local'`, `ReplicateProvider` for `'replicate'`, else `MockStemProvider`

### LocalDemucsProvider (`lib/providers/stems/LocalDemucsProvider.ts`) — **Recommended free provider**
- Runs `python -m demucs` as a subprocess using Node's `spawnSync` — no API key, no cost
- Python executable: `process.env.DEMUCS_PYTHON_CMD ?? 'python'` (override with `DEMUCS_PYTHON_CMD=python3` if needed)
- Command: `python -m demucs --mp3 --mp3-bitrate 320 -n htdemucs_ft --out {tmpDir} {localPath}`
- **Requirements:** `pip install demucs` + `ffmpeg` in PATH
- Output structure: `.tmp-demucs/{jobId}/htdemucs_ft/{trackName}/{stem}.mp3`
  - Demucs filenames: `drums.mp3`, `bass.mp3`, `other.mp3`, `vocals.mp3`
  - `other` maps to `StemId = 'melody'`
- Files copied to `public/stems/{jobId}/`, temp dir cleaned up after (also cleaned on error)
- Timeout: 300 seconds (`spawnSync` option)
- Error messages surface common failures: Python not in PATH, demucs not installed, ffmpeg missing
- Temp directory `.tmp-demucs/` is gitignored

### ReplicateProvider (`lib/providers/stems/ReplicateProvider.ts`)
- Constructor throws if `REPLICATE_API_KEY` or `REPLICATE_MODEL_VERSION` are absent
- Reads the local MP3 from `path.join(process.cwd(), 'public', audioUrl)`, converts to `data:audio/mpeg;base64,...` (avoids localhost/public URL problem in dev)
- `POST https://api.replicate.com/v1/predictions` with `version`, `input: { audio: dataUri, stem: 'none', shifts: 1, overlap: 0.25, mp3_bitrate: 128 }`
- Polls `prediction.urls.get` every 3 seconds, up to 60 attempts (3 minutes)
- On success: downloads each stem URL from `output.{drums,bass,other,vocals}`, saves to `public/stems/{jobId}/{stemId}.mp3`
- Replicate's `other` key maps to `StemId = 'melody'`
- Returns stems sorted in canonical order: `drums → bass → melody → vocals`

### `generateStemMp3` (`lib/audio/generateTone.ts`)
```ts
export interface StemConfig {
  frequency: number;
  amplitude: number;
  durationSeconds: number;
  bpm: number;
  pattern: 'continuous' | 'percussive' | 'sparse';
}
export function generateStemMp3(config: StemConfig, outputPath: string): void
```

- `continuous`: fundamental sine + first harmonic (÷1.3 to normalise), soft bar envelope
- `percussive`: noise burst on every beat + pitch-dropping sine kick on beats 1 & 3 of each bar
- `sparse`: deterministic per-beat activation (`Math.abs(Math.sin(beatIndex * 7.3 + 1.2)) > 0.92`), very low amplitude — simulates near-silent vocals on instrumental audio
- Calls shared `encodePcmToMp3(pcm, outputPath)` helper (also used by `generateMp3`)

### `app/api/stems/route.ts`
- `export const maxDuration = 180` — required for Replicate polling on Vercel
- Validates `body.audioUrl` starts with `/generated/`
- Surfaces provider error messages to client (same pattern as other routes)

### `useWorkflow` stem additions
```ts
separateStems: () => void   // sets stemStep: 'separating', fires stemsMutation with score.audioUrl
```
- `stemsMutation.onSuccess` → `stemStep: 'stems_ready'`, `stems: StemResult`
- `stemsMutation.onError` → `stemStep: 'stems_error'`, `stemError: err.message`
- `reset()` clears all three stem fields back to `defaultState`

### `StemPlayer` (`components/player/StemPlayer.tsx`)
- `'use client'`; accepts `{ result: StemResult }`
- Renders a `StemRow` per stem; each row has its own isolated audio state
- Row layout: colored dot, label, 20-bar mini waveform, play/pause button, seek slider, download anchor
- Waveform heights computed with distinct sine/cosine params per `StemId` for visual differentiation
- Stem colors: drums=`#f97316` (orange), bass=`#a855f7` (purple), melody=`#ffcc18` (amber), vocals=`#2dd4bf` (teal)
- Shows "Vocals may be near-silent — this score is instrumental" note below the header
- Stem audio stored at `public/stems/{jobId}/` (gitignored)

### `app/page.tsx` stem UI (inside `step === 'completed'` section, after `<DownloadButton>`)
- `stemStep === 'idle'` → zinc-style secondary button "Split into Stems →"
- `stemStep === 'separating'` → `<Spinner label="Separating audio stems…" />`
- `stemStep === 'stems_error'` → `<ErrorBanner>` with retry calling `separateStems`
- `stemStep === 'stems_ready' && stems` → `<StemPlayer result={stems} />`

---

## Audio Generation (`lib/audio/generateTone.ts`) — Implementation Details

**Signature:**
```ts
export function generateMp3(analysis: VideoAnalysis, outputPath: string): number
// returns durationSeconds
```

**Constants:**
```ts
SAMPLE_RATE = 44100
CHANNELS = 1
BITRATE = 128
CHUNK_SIZE = 1152   // lamejs internal requirement — multiple of 576
```

**Mood-to-root-frequency map:**
```ts
calm: 261.63 (C4), happy: 329.63 (E4), energetic: 392.0 (G4),
dramatic: 220.0 (A3), suspenseful: 246.94 (B3), inspirational: 349.23 (F4),
emotional: 293.66 (D4), corporate: 311.13 (Eb4)
```

**Duration and amplitude by energy:**
```ts
ENERGY_DURATION:   { low: 15, medium: 18, high: 22 }   // seconds
ENERGY_AMPLITUDE:  { low: 0.25, medium: 0.45, high: 0.65 }
```

**Chord progression (I–IV–V–I, frequency ratios):**
```ts
[1.0, 1.25, 1.5]      // I  major triad
[1.333, 1.667, 2.0]   // IV major triad
[1.5, 1.875, 2.25]    // V  major triad
[1.0, 1.25, 1.5]      // I  return
```

**PCM synthesis loop (per sample `i`):**
1. `t = i / SAMPLE_RATE`
2. `barIndex = Math.floor(i / barSamples) % 4` where `barSamples = Math.round((60/bpm) * 4 * SAMPLE_RATE)`
3. `posInBar = (i % barSamples) / barSamples`
4. **Envelope:** attack if `posInBar < 0.02` (ramp up), release if `posInBar > 0.85` (ramp down), sustain otherwise
5. **Sum 3 chord note sines:** `sample = sum(sin(2π × rootFreq × ratio × t)) / 3 × envelope × amplitude`
6. **Noise (high energy only):** `sample += (Math.random() - 0.5) * 0.015`
7. **Quantize:** `pcm[i] = Math.round(Math.max(-1, Math.min(1, sample)) * 32767)`

**MP3 encoding:**
1. `new lamejs.Mp3Encoder(1, 44100, 128)`
2. Loop through `pcm` in `CHUNK_SIZE=1152` chunks, collect `Int8Array` outputs
3. `encoder.flush()` to capture final frames
4. Concatenate all chunks into a single `Buffer` (manual offset-based copy, not `Buffer.concat`)
5. `fs.mkdirSync(path.dirname(outputPath), { recursive: true })`
6. `fs.writeFileSync(outputPath, buffer)`
7. Returns `durationSeconds`

---

## API Routes — Implementation Pattern

### General pattern
```ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // validate — return 400 on invalid input
    const result = await someOperation(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/route-name]', error);
    const message = error instanceof Error ? error.message : 'Fallback message.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Note:** Unlike the boilerplate `'Internal server error'`, the analyze and generate routes surface the actual `error.message` from providers. This means Gemini/ElevenLabs errors with actionable messages reach the client.

### POST `/api/upload`
- `request.formData()`, field `'video'`
- Validates MIME: `{ 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }`
- Validates size: `≤ 100 * 1024 * 1024`
- Path: `path.join(process.cwd(), 'public', 'uploads', `${generateId()}.${ext}`)`
- `fs.mkdirSync(uploadDir, { recursive: true })` before writing
- `fs.writeFileSync(fullPath, Buffer.from(await file.arrayBuffer()))`
- Returns: `{ videoPath: string, filename: string, sizeBytes: number }`
  - `videoPath` is the absolute filesystem path — passed verbatim to the analyzer
  - `filename` is `file.name` (the original user filename)

### POST `/api/analyze`
- Validates: `videoPath` (string), `filename` (string), `sizeBytes` (number) — all required
- Calls `getAnalysisProvider().analyze(body.videoPath, { filename, sizeBytes })`
- Returns `AnalysisResult` directly

### POST `/api/generate`
- Validates: `body.analysis`, `body.videoPath`, `body.metadata` all present
- Calls `getMusicProvider().generate(body as AnalysisResult)`
- Returns `GeneratedScore` directly

### POST `/api/stems`
- Validates: `body.audioUrl` must be a string starting with `/generated/`
- Calls `getStemProvider().separate(body.audioUrl)`
- Returns `StemResult` directly
- Exports `export const maxDuration = 180` — required for Replicate polling on Vercel (3-minute cap)

---

## Component Rules

### DropZone
- `'use client'`
- `onFileSelect(file: File)` callback — does NOT trigger upload
- Validates file BEFORE calling callback: type check + `≤ 100 MB`
- `accept="video/mp4,video/quicktime,video/webm"` on hidden `<input type="file">`
- Drag-over: `border-amber-500 bg-amber-500/5 scale-[1.01]` (normal: `border-zinc-700`)
- Shows inline validation error text below the zone
- `isUploading` is hardcoded to `false` in the current implementation (kept for future use)
- Keyboard accessible: Enter/Space on the drop zone div triggers the hidden input

### VideoPreview
- Accepts `{ file, objectUrl, onRemove, disabled? }`
- Native `<video>` with `controls` and `preload="metadata"` — no autoplay
- Filename truncated at 42 characters (adds `…`)
- "Remove" button calls `onRemove`; disabled + opacity-40 when `disabled === true`

### AnalysisCard
- Accepts `{ result: AnalysisResult }`
- BPM is `text-4xl font-bold text-amber-500` in the top-right
- **Mood badge colors** (each mood has a unique color — do not default to a single color):
  - `inspirational`: sky, `emotional`: violet, `dramatic`: red, `energetic`: orange
  - `suspenseful`: purple, `corporate`: blue, `happy`: yellow, `calm`: green
- Energy badge: green=low, yellow=medium, red=high
- Pace badge: blue (always)
- Genre badge: zinc-800/300 (neutral, no color)
- 2-column stats grid: "Est. Scene Cuts" + "Motion Score" (amber progress bar, 0–100%)
- Instrument suggestions as zinc-800 bordered tags (not shadcn `Badge`)
- `analysisSummary` italic text below a `border-t`
- **Audio Profile section** (conditionally rendered when any audio field is present), below `analysisSummary`:
  - `audioContentTypes` as colored badges (`AUDIO_TYPE_BADGE` map): dialogue=teal, sound_effects=orange, background_music=purple, ambient=green, silence=muted
  - `soundTexture` badge: orange-tinted
  - `volumeDynamics` badge: purple-tinted
  - `dialogueTone` badge: teal-tinted (only when dialogue is present)
  - `dialogueSentiment` badge: sky-tinted (only when dialogue is present)
  - `audioSummary` italic text
- `<TimelineBar>` below a final `border-t`

### TimelineBar
- Accepts `{ segments: TimelineSegment[] }`
- Returns `null` if `segments.length === 0`
- `totalDuration = segments[segments.length - 1].endSeconds`
- Each segment: `width = ((end - start) / totalDuration) * 100%`
- Colors: `bg-green-500` (low), `bg-yellow-500` (medium), `bg-red-500` (high)
- Text colors (to maintain contrast on colored bg): `text-green-950`, `text-yellow-950`, `text-red-950`
- Text label (the mood word) only rendered when `widthPct > 16`
- Hover: `hover:opacity-80`
- `title` attribute: `"${seg.label} (${seg.startSeconds}s – ${seg.endSeconds}s)"`
- Time axis below bar: "0s" left, `{totalDuration}s` right

### AudioPlayer
- `'use client'`
- Accepts `{ src: string }`
- `useRef<HTMLAudioElement>` — no library
- Local state: `isPlaying`, `currentTime`, `duration`, `isLoaded`
- `useEffect` keyed on `[src]` attaches: `timeupdate`, `loadedmetadata`, `ended`; cleans up on unmount
- **Decorative waveform**: 40 bars, heights computed once with: `Math.max(4, Math.min(44, 20 + Math.sin(i*0.9)*14 + Math.cos(i*0.4)*9 + Math.abs(Math.sin(i*1.4))*7))`
- Bars filled amber-500 when `(i / waveHeights.length) * 100 < progress`, else zinc-700
- Seek bar: `<input type="range" min=0 max={duration} step=0.01>` with inline background gradient for amber fill:
  ```
  background: `linear-gradient(to right, #f59e0b ${progress}%, #3f3f46 ${progress}%)`
  ```
- Thumb styled via Tailwind arbitrary pseudo-selector variants: `[&::-webkit-slider-thumb]` and `[&::-moz-range-thumb]`
- Play/pause: amber circle button (`bg-amber-500`), inline SVG icons (pause = two rects, play = triangle path)
- Time display: `{formatDuration(currentTime)} / {formatDuration(duration)}`
- Shows "Loading audio…" (zinc-600) when `!isLoaded`
- `togglePlay` is `async` — catches errors from `audio.play()` silently

### DownloadButton
- Accepts `{ score: GeneratedScore }`
- `<a href={score.audioUrl} download={score.filename} className="block">` wrapping shadcn `<Button>`
- Button styled: `bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700` (dark secondary, NOT amber)
- Shows `Download {score.filename}`
- Direct anchor download — no JavaScript fetch or Blob

---

## Page Layout (`app/page.tsx`)

The page is `'use client'`. Section rendering is controlled by `state.step` and the `videoFile` presence.

### STEP_ORDER numeric map (used to compute done/active/pending for the step indicator)
```ts
{ idle: -1, uploading: 0, uploaded: 1, analyzing: 1.5, analyzed: 2, generating: 2.5, completed: 3 }
```
A step circle at position `i+1` (1-indexed) is "done" when `currentOrder > i+1`, "active" when `currentOrder >= i+1 && currentOrder < i+2`.

### Section rendering rules (exact)
- **Hero** (`step === 'idle'`): headline + subtitle. Hidden once any step begins.
- **Step indicator** (`step !== 'idle'`): Upload/Analyze/Generate circles. Includes "Start over" link (disabled during loading).
- **Error banner** (`error && !isLoading`): shown with retry button contextual to current step.
- **DropZone** (`!videoFile && !isLoading`): shown when no file is selected and not loading.
- **VideoPreview** (`videoFile && videoObjectUrl`): shown whenever a file is in state.
- **"Upload & Continue →"** (`step === 'idle' && videoFile`): triggers `upload()`.
- **Upload spinner** (`isUploading`): label "Uploading video…"
- **"Analyze Video →"** (`step === 'uploaded' && !error`): triggers `analyze()`.
- **Analysis spinner** (`isAnalyzing`): label "Analyzing video mood, energy & arc…"
- **AnalysisCard** (`analysis && step ∈ ['analyzed', 'generating', 'completed']`)
- **"Generate Score →"** (`step === 'analyzed' && !error`): triggers `generate()`.
- **Generation spinner** (`isGenerating`): label "Composing your score with ElevenLabs…"
- **Score section** (`score && step === 'completed'`): divider, score metadata badges, prompt box, AudioPlayer, DownloadButton, "Score another video" link.

---

## Visual Design System

### Color palette
| Role | Class |
|---|---|
| Page background | `bg-zinc-950` |
| Card surface | `bg-zinc-900` |
| Elevated / hover | `bg-zinc-800` |
| Elevated stats bg | `bg-zinc-800/50` |
| Borders | `border-zinc-700` or `border-zinc-800` |
| Header border | `border-zinc-800` |
| Primary accent | `text-amber-500`, `bg-amber-500` |
| Accent hover | `hover:bg-amber-400` |
| Primary text | `text-zinc-100` |
| Secondary text | `text-zinc-400` |
| Muted text | `text-zinc-500` |
| Very muted text | `text-zinc-600` |
| Error | `text-red-400`, `bg-red-950/40`, `border-red-800/60` |

### Animation
`globals.css` defines:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.35s ease-out both;
}
```
Applied to any element that appears after a state transition.

### Card pattern
```tsx
<div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
  ...
</div>
```

### CTA button pattern
```tsx
<button className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-zinc-950 transition-all hover:bg-amber-400 active:scale-[0.99]">
  Label →
</button>
```

---

## Import Aliases

Always use `@/` imports. Never use `../` that crosses directory boundaries.

```ts
import type { VideoAnalysis } from '@/types';
import { cn, formatDuration } from '@/lib/utils';
import { AnalysisCard } from '@/components/analysis/AnalysisCard';
```

---

## Utilities (`lib/utils.ts`)

All exports:
```ts
export function cn(...inputs: ClassValue[]): string       // clsx + twMerge
export function formatDuration(seconds: number): string  // 75 → "1:15", floor to int seconds
export function formatFileSize(bytes: number): string    // <1KB→B, <1MB→KB, else MB (1 decimal)
export function seededRandom(seed: number): () => number // mulberry32 PRNG
export function hashString(str: string): number          // djb2 hash → absolute integer
export function generateId(): string                     // crypto.randomUUID()
export function delay(ms: number): Promise<void>         // setTimeout wrapper
```

### seededRandom (mulberry32)
```ts
export function seededRandom(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### hashString (djb2)
```ts
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
```

---

## Environment Variables

### `.env.local` (gitignored, never committed)
```
ANALYSIS_PROVIDER=mock
MUSIC_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
STEM_PROVIDER=local
DEMUCS_PYTHON_CMD=python
REPLICATE_API_KEY=your_key_here
REPLICATE_MODEL_VERSION=<hash from https://replicate.com/lucataco/demucs>
```

### `.env.example` (committed — no real keys)
```
ANALYSIS_PROVIDER=mock
MUSIC_PROVIDER=mock
ELEVENLABS_API_KEY=
GEMINI_API_KEY=
STEM_PROVIDER=mock
REPLICATE_API_KEY=
REPLICATE_MODEL_VERSION=
```

### Factory defaults
If env vars are absent, all factories default to `'mock'`. No API keys needed for local dev.

| Var | Default | Options |
|---|---|---|
| `ANALYSIS_PROVIDER` | `mock` | `mock`, `gemini` |
| `MUSIC_PROVIDER` | `mock` | `mock`, `elevenlabs` |
| `ELEVENLABS_API_KEY` | — | Required when `MUSIC_PROVIDER=elevenlabs` |
| `GEMINI_API_KEY` | — | Required when `ANALYSIS_PROVIDER=gemini` |
| `STEM_PROVIDER` | `mock` | `mock`, `local`, `replicate` |
| `DEMUCS_PYTHON_CMD` | `python` | Override Python executable when `STEM_PROVIDER=local` (e.g. `python3`) |
| `REPLICATE_API_KEY` | — | Required when `STEM_PROVIDER=replicate` |
| `REPLICATE_MODEL_VERSION` | — | Required when `STEM_PROVIDER=replicate`; find hash at replicate.com/lucataco/demucs |

---

## File System Conventions

- Always use `path.join(process.cwd(), 'public', ...)` for absolute server-side paths
- Always call `fs.mkdirSync(dir, { recursive: true })` before writing — never assume the dir exists
- Client-side `audioUrl` returned to browser: relative path `/generated/{uuid}.mp3` (Next.js serves `public/` at root)
- `videoObjectUrl` for preview: `URL.createObjectURL(file)` — created in `selectFile()`, revoked in `removeFile()` and `reset()`

---

## `.gitignore` Requirements

```
public/uploads/
public/generated/
public/stems/
.tmp-demucs/
.env.local
```

---

## Error Handling Rules

### API Routes
- Validate all input first; return 400 with a descriptive message on invalid input
- Catch all async errors; log with `console.error('[/api/route-name]', error)`
- **Surface provider error messages** (not generic 500): `error instanceof Error ? error.message : 'Fallback.'`
- Never expose stack traces

### Client (useWorkflow mutations)
```ts
onError: (err: Error) => {
  setState(prev => ({ ...prev, step: PREVIOUS_STABLE_STEP, error: err.message }));
}
```
- `state.error` drives the ErrorBanner visibility (`error && !isLoading`)
- ErrorBanner "Retry": re-invokes the appropriate handler for the current step
- ErrorBanner "Start Over": calls `reset()`

---

## What NOT to Build (Hard Boundaries)

| Forbidden | Why |
|---|---|
| User auth / Clerk | Out of scope MVP |
| Database / ORM | No persistence needed |
| Payments | Out of scope |
| `pages/` directory | App Router only |
| localStorage / sessionStorage | State is React-only |
| External audio player libraries | Custom player is implemented |
| Multi-segment audio stitching | Future feature |
| Real-time generation streaming | Future feature |
| Stem editing / DAW | Future feature |
| Direct imports of concrete providers in routes | Always use factory |

---

## Implementation Checklist

All phases are complete. This checklist reflects the completed state.

### Phase 1 — Foundation ✅
- [x] Scaffold Next.js 16 project
- [x] Install dependencies: `@tanstack/react-query`, `elevenlabs`, `@google/genai`, `lamejs`, `clsx`, `tailwind-merge`, `tw-animate-css`
- [x] Initialize shadcn/ui, add: `button`, `badge`, `card`
- [x] Configure `.gitignore`
- [x] Create `.env.local` and `.env.example`

### Phase 2 — Types and Utilities ✅
- [x] `types/index.ts` — all shared types
- [x] `lib/utils.ts` — cn, formatDuration, formatFileSize, seededRandom, hashString, generateId, delay

### Phase 3 — Provider Layer ✅
- [x] `lib/providers/types.ts` — VideoAnalysisProvider, MusicGenerationProvider interfaces
- [x] `lib/providers/factory.ts` — getAnalysisProvider() (mock/gemini), getMusicProvider() (mock/elevenlabs)
- [x] `lib/providers/analysis/MockAnalyzer.ts` — seeded arc templates + full analysis
- [x] `lib/providers/analysis/GeminiAnalyzer.ts` — Gemini 2.5 Flash + File API + retry + JSON parsing
- [x] `lib/audio/generateTone.ts` — PCM synthesis + lamejs MP3 encoding
- [x] `lib/providers/music/buildPrompt.ts` — buildPrompt() + buildTags()
- [x] `lib/providers/music/MockMusicProvider.ts` — uses generateTone + buildPrompt
- [x] `lib/providers/music/ElevenLabsProvider.ts` — ElevenLabs SDK + buildPrompt

### Phase 4 — API Routes ✅
- [x] `app/api/upload/route.ts`
- [x] `app/api/analyze/route.ts`
- [x] `app/api/generate/route.ts`

### Phase 5 — Workflow Hook ✅
- [x] `hooks/useWorkflow.ts` — state machine + selectFile + removeFile + upload + analyze + generate + reset

### Phase 6 — Components ✅
- [x] `components/upload/DropZone.tsx`
- [x] `components/upload/VideoPreview.tsx`
- [x] `components/analysis/TimelineBar.tsx`
- [x] `components/analysis/AnalysisCard.tsx`
- [x] `components/player/AudioPlayer.tsx`
- [x] `components/player/DownloadButton.tsx`

### Phase 7 — App Shell ✅
- [x] `app/providers.tsx` — QueryClientProvider wrapper (retry: 0)
- [x] `app/globals.css` — Tailwind v4 imports, shadcn CSS vars, fadeIn keyframe
- [x] `app/layout.tsx` — Geist fonts, Providers, dark mode, metadata
- [x] `app/page.tsx` — full single-page workflow with step indicator + hero + error banner

### Phase 8 — Validation ✅
- [x] `npm run build` passes with zero errors
- [x] `npm run lint` passes with zero warnings
- [x] End-to-end flow: upload → analyze → generate → play → download
- [x] Different videos produce different analysis results (seeded PRNG)
- [x] ElevenLabs integration works when `MUSIC_PROVIDER=elevenlabs` and key is set
- [x] Gemini integration works when `ANALYSIS_PROVIDER=gemini` and key is set

---

## Session Startup Checklist

Every new Claude Code session on this project:
1. Read this file completely
2. Read `SPEC.md` for product requirements
3. Run `git status` to understand current state
4. Run `npm run build` to check for existing errors before making changes
5. All phases are complete — focus is on fixing bugs or extending features, not building from scratch
6. Do not refactor working code — fix what is broken, build what is missing
