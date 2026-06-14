# SPEC.md — BananaMOV

> AI-powered video scoring platform. Built for JamHacks 2026.
> ElevenLabs is a track prize sponsor — ElevenLabs Sound Generation is the required music generation API.

---

## Overview

BananaMOV accepts a user-uploaded video, analyzes its visual characteristics across the video's timeline, and generates a matching music score via the ElevenLabs Sound Generation API. The MVP validates the full core workflow end-to-end: **Upload → Analyze → Generate → Preview → Download**.

The video analysis produces a time-segmented arc (how mood and energy evolve throughout the video) plus a rich set of musical and audio-aware descriptors, which are collapsed into a single sound-only text prompt sent to ElevenLabs. The returned audio is served for preview and download.

All AI integrations sit behind swappable provider interfaces. **Analysis currently always uses Google Gemini 2.5 Flash** — the factory is hardcoded to it and no longer reads `ANALYSIS_PROVIDER`, so a `GEMINI_API_KEY` is required (the deterministic `MockAnalyzer` remains in the codebase but is unreferenced). The music provider defaults to a mock that synthesizes real PCM audio, but supports ElevenLabs Sound Generation for production use via `MUSIC_PROVIDER=elevenlabs`.

---

## User Flow (Single-Page)

The entire workflow lives on one page (`/`). No routing between steps. No localStorage or sessionStorage. All state is managed in a single `WorkflowState` object via the `useWorkflow` hook.

### Step progression

```
idle → uploading → uploaded → analyzing → analyzed → generating → completed
```

File selection (`selectFile`) and upload (`upload`) are **two separate actions**. Selecting a file sets `step: 'idle'` with the file ready for preview; clicking "Upload & Continue" triggers the actual `POST /api/upload`.

Each step renders a distinct UI section below the previous. The page does not navigate — it reveals new sections as state advances.

| Step | UI shown |
|---|---|
| `idle` (no file) | Hero headline + upload dropzone |
| `idle` (file selected) | Video preview + "Upload & Continue →" button |
| `uploading` | Video preview + upload spinner |
| `uploaded` | Video preview + step indicator + "Analyze Video →" button |
| `analyzing` | Video preview + step indicator + analysis spinner |
| `analyzed` | Video preview + step indicator + analysis card + "Generate Score →" button |
| `generating` | Video preview + step indicator + analysis card + generation spinner |
| `completed` | Video preview + step indicator + analysis card + score section (tabbed output panel — score-only / video+score — + download + stems) |

On error at any step: an error banner appears with a "Retry" button (for analyze/generate failures) and a "Start Over" button. On error, the step regresses to the previous stable step (`uploaded` after analyze failure, `analyzed` after generate failure).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9 (App Router), React 19.2.4 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 (`tw-animate-css`, `shadcn/tailwind.css`); custom `navy`/`cream` token system + banana-yellow `#ffcc18` accent; light/dark theme toggle |
| Components | shadcn/ui (`button`, `badge`, `card`) + hand-written `ThemeToggle` |
| Data fetching | TanStack Query v5 (`useMutation` only) |
| Video analysis | **Always Google Gemini 2.5 Flash** (factory hardcoded; `MockAnalyzer` exists but unused) |
| Music generation | Mock PCM synthesis (default), ElevenLabs Sound Generation (`/v1/sound-generation`), or **ElevenLabs Music** (`/v1/music`, composition plan) — all raw REST, no SDK |
| File storage | Local filesystem (`public/uploads`, `public/generated`) |
| Database | None |
| Auth | None |

---

## Folder Structure

```
/
├── middleware.ts                      # Clerk middleware (guarded) — protects /projects, /mix, /api/projects
├── app/
│   ├── layout.tsx                     # Root layout + guarded ClerkProvider + global shell (SiteHeader + children + SiteFooter)
│   ├── (marketing)/page.tsx           # '/' marketing Home (Hero + AboutSection + FeatureSection)
│   ├── studio/page.tsx                # '/studio' upload→analyze→generate→stems workflow (was app/page.tsx)
│   ├── sign-in/[[...sign-in]]/page.tsx  # Clerk <SignIn/> (or "not configured" notice when keyless)
│   ├── sign-up/[[...sign-up]]/page.tsx  # Clerk <SignUp/>
│   ├── projects/page.tsx              # '/projects' grid (RSC, gated)
│   ├── projects/[id]/page.tsx         # '/projects/[id]' detail (RSC, gated)
│   ├── mix/[projectId]/page.tsx       # '/mix/[projectId]' → renders the DAW seeded from the project (RSC, gated)
│   ├── daw/page.tsx                   # '/daw' standalone DAW, URL-seeded (public)
│   ├── providers.tsx                  # 'use client' TanStack QueryClientProvider wrapper
│   ├── globals.css                    # Tailwind imports, CSS vars, fadeIn keyframe
│   └── api/
│       ├── upload/route.ts            # POST — receives video, saves to disk, extracts original audio (ffmpeg)
│       ├── analyze/route.ts           # POST — returns AnalysisResult
│       ├── generate/route.ts          # POST — returns GeneratedScore
│       ├── projects/route.ts          # POST — save project (auth-gated)
│       ├── projects/[id]/route.ts     # PATCH rename / DELETE (auth-gated)
│       └── projects/[id]/master/route.ts  # POST — save rendered master + mix_state (auth-gated)
├── components/
│   ├── ThemeToggle.tsx                # Light/dark toggle ('use client', localStorage)
│   ├── layout/
│   │   ├── SiteHeader.tsx             # Global nav (logo + Home/Studio + Powered-by pill + HeaderAuth + ThemeToggle)
│   │   ├── HeaderAuth.tsx             # Clerk auth control (useUser → UserButton / SignInButton); shown when clerkEnabled
│   │   └── SiteFooter.tsx             # Global footer
│   ├── marketing/
│   │   ├── Hero.tsx                   # Landing hero + CTAs to /studio
│   │   ├── AboutSection.tsx           # '#about' scroll section
│   │   └── FeatureSection.tsx         # Feature card grid
│   ├── projects/
│   │   ├── SaveProjectControl.tsx     # Studio save control (gated; Save / Save & open mixing)
│   │   ├── SaveProjectDialog.tsx      # Name modal → POST → redirect to /projects/[id] or /mix/[id]
│   │   ├── ProjectGrid.tsx            # Grid + empty state
│   │   ├── ProjectCard.tsx            # Card: open / inline rename / two-step delete
│   │   └── DeleteProjectButton.tsx    # Detail-page delete
│   ├── daw/                           # Web-Audio DAW (from origin/maxim) — replaced the mix scaffold
│   │   ├── DAWWorkspace.tsx           # Mountable DAW shell + "Save master" toolbar
│   │   └── Transport / Arrangement / Mixer / TrackLibrary / PluginPalette / ExportPanel
│   ├── upload/
│   │   ├── DropZone.tsx               # Drag-and-drop with client-side validation
│   │   └── VideoPreview.tsx           # Native video element with metadata + remove button
│   ├── analysis/
│   │   ├── AnalysisCard.tsx           # Overall profile summary card
│   │   └── TimelineBar.tsx            # Colored segment timeline bar
│   ├── player/
│   │   ├── ScoreOutput.tsx            # Tabbed output panel: Generated Score | Video + Score
│   │   ├── AudioPlayer.tsx            # Custom audio player (play/pause/seek/waveform)
│   │   ├── CombinedVideoPlayer.tsx    # Video synced to generated score + original-audio toggle
│   │   ├── StemPlayer.tsx             # Per-stem mini player grid
│   │   └── DownloadButton.tsx         # Direct anchor download
│   └── ui/                            # shadcn generated components (do not edit)
├── lib/
│   ├── providers/
│   │   ├── types.ts                   # VideoAnalysisProvider, MusicGenerationProvider interfaces
│   │   ├── factory.ts                 # getAnalysisProvider(), getMusicProvider()
│   │   ├── analysis/
│   │   │   ├── MockAnalyzer.ts        # Seeded-random timeline + analysis
│   │   │   └── GeminiAnalyzer.ts      # Real video analysis via Google Gemini 2.5 Flash
│   │   └── music/
│   │       ├── buildPrompt.ts            # Sound-effects prompt + tags generation
│   │       ├── buildCompositionPlan.ts   # Timeline → Eleven Music composition plan + styles
│   │       ├── MockMusicProvider.ts      # Generates real MP3 via lamejs PCM synthesis
│   │       ├── ElevenLabsProvider.ts     # ElevenLabs Sound Generation API (/v1/sound-generation)
│   │       └── ElevenMusicProvider.ts    # ElevenLabs Music API (/v1/music, composition plan)
│   ├── audio/
│   │   ├── generateTone.ts            # PCM synthesis + lamejs MP3 encoding (mock only)
│   │   ├── ffmpegEnv.ts               # resolvedPath() — Windows PATH merge (shared by Demucs + extractor)
│   │   ├── extractOriginalAudio.ts    # ffmpeg: original audio track → browser-playable MP3 (best-effort)
│   │   └── dawGraph.ts                # DAW Web Audio graph (buildEffect / buildMixGraph + effect specs)
│   ├── db/
│   │   ├── schema.ts                  # Drizzle schema: projects + project_files
│   │   └── index.ts                   # Neon HTTP drizzle client
│   ├── projects/
│   │   ├── queries.ts                 # Ownership-scoped DB ops (insert/list/get/rename/delete)
│   │   ├── save.ts                    # saveProjectFromWorkflow (validate → upload → insert + rollback)
│   │   └── serialize.ts               # row↔domain mappers + buildPlayback + STEM_LABELS
│   ├── mix/
│   │   └── buildMixSession.ts         # Project → MixSession + mixSessionToDAWSeed (→ DAW library items)
│   ├── storage/
│   │   ├── types.ts                   # StorageProvider interface (upload + uploadBytes + delete)
│   │   ├── factory.ts                 # getStorageProvider() (vercel-blob | local)
│   │   ├── VercelBlobProvider.ts      # @vercel/blob (durable, default)
│   │   └── LocalStorageProvider.ts    # dev fallback → public/projects/{key}
│   ├── auth.ts                        # clerkEnabled guard (true when Clerk publishable key is set)
│   └── utils.ts                       # cn, formatDuration, formatFileSize, seededRandom,
│                                      #   hashString, generateId, delay
├── drizzle.config.ts                  # drizzle-kit config (loads .env.local)
├── drizzle/                           # generated SQL migrations (committed)
├── hooks/
│   ├── useWorkflow.ts                 # Central state machine + TanStack Query mutations
│   ├── useSaveProject.ts              # POST /api/projects
│   ├── useProjects.ts                 # rename / delete mutations
│   ├── useSaveMaster.ts              # POST /api/projects/[id]/master (rendered WAV + session)
│   └── useDAW.ts                      # DAW engine (tracks/mixer/effects + Web Audio playback + offline render)
├── types/
│   ├── index.ts                       # All shared TypeScript types
│   └── daw.ts                         # DAW types (DAWLibraryItem/DAWProject/DAWTrack/MixerInsert/Effect)
└── public/
    ├── banana-logo.svg                # Header logo (committed)
    ├── uploads/                       # Uploaded videos (runtime, gitignored)
    └── generated/                     # Generated MP3s (runtime, gitignored)
```

---

## Provider Interfaces

Defined in `lib/providers/types.ts`. API routes import only the interface, never a concrete provider.

```ts
export interface VideoAnalysisProvider {
  analyze(videoPath: string, metadata: VideoMetadata): Promise<AnalysisResult>;
}

export interface MusicGenerationProvider {
  generate(analysis: AnalysisResult): Promise<GeneratedScore>;
}
```

Provider selection in `lib/providers/factory.ts`:

| Function | Selection logic | Provider |
|---|---|---|
| `getAnalysisProvider()` | **Hardcoded** — `ANALYSIS_PROVIDER` is ignored | Always `GeminiAnalyzer` |
| `getMusicProvider()` | `MUSIC_PROVIDER` (default `mock`) | `MockMusicProvider`; `ElevenMusicProvider` when `=elevenmusic`; `ElevenLabsProvider` when `=elevenlabs` |

> `MockAnalyzer` is no longer imported by the factory. To restore mock analysis, re-add the env-driven branch in `getAnalysisProvider()`.

---

## Data Types

Defined in `types/index.ts`.

```ts
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

// Expanded descriptor unions (added in the rebrand/Gemini-richness work)
export type ColorPalette = 'warm' | 'cool' | 'dark' | 'bright' | 'neutral';
export type CameraStyle = 'static' | 'smooth' | 'handheld' | 'dynamic';
export type VisualPace = 'slow-cuts' | 'moderate-cuts' | 'fast-cuts';
export type SettingType = 'nature' | 'urban' | 'intimate' | 'cinematic' | 'abstract' | 'sports' | 'documentary';
export type AudioEnergyLevel = 'silent' | 'quiet' | 'moderate' | 'loud';
export type MusicRole = 'background-underscore' | 'featured-score' | 'sync-to-action' | 'ambient-complement';

export interface VideoMetadata {
  filename: string;
  sizeBytes: number;
  durationSeconds?: number;  // extracted client-side and echoed by /api/upload; Gemini also infers it
}

// A single time segment in the video's analyzed arc
export interface TimelineSegment {
  startSeconds: number;
  endSeconds: number;
  mood: Mood;
  energyLevel: EnergyLevel;
  label: string;             // e.g. "Opening — calm, low energy"
}

export interface VideoAnalysis {
  // Core
  mood: Mood;                // dominant mood (driven by peak energy segment)
  energyLevel: EnergyLevel; // dominant energy level
  pace: Pace;
  bpm: number;               // integer, 60–160
  genre: string;             // one of: cinematic, electronic, acoustic, orchestral, ambient, jazz
  sceneCount: number;        // estimated scene cut count
  motionScore: number;       // float 0.0–1.0
  instrumentSuggestions: string[];
  analysisSummary: string;   // 1–2 sentence human-readable summary
  timeline: TimelineSegment[]; // 3–5 time-ordered segments spanning full video

  // Expanded visual descriptors (all optional)
  colorPalette?: ColorPalette;
  cameraStyle?: CameraStyle;
  visualPace?: VisualPace;
  settingType?: SettingType;

  // Expanded musical brief (sound-only; all optional)
  emotionalArc?: string;
  sonicTexture?: string;
  musicalRecommendation?: string;
  keyMode?: 'major' | 'minor' | 'modal';
  rhythmicFeel?: string;
  dynamicArc?: string;

  // Existing-audio awareness (all optional)
  existingAudio?: string;
  audioEnergyLevel?: AudioEnergyLevel;
  musicRole?: MusicRole;
}

// Full result returned by the analysis provider
export interface AnalysisResult {
  videoPath: string;
  metadata: VideoMetadata;
  analysis: VideoAnalysis;
}

export interface GeneratedScore {
  audioUrl: string;          // relative path served from public/, e.g. /generated/uuid.mp3
  durationSeconds: number;
  bpm: number;
  genre: string;
  mood: Mood;
  filename: string;          // e.g. "score-dramatic-95bpm.mp3"
  prompt: string;            // the prompt that was sent to the music provider
}

export interface WorkflowState {
  step: WorkflowStep;
  videoFile: File | null;
  videoObjectUrl: string | null;        // created via URL.createObjectURL()
  uploadedVideoPath: string | null;     // absolute server filesystem path
  uploadedMetadata: VideoMetadata | null;
  originalAudioUrl: string | null;      // ffmpeg-extracted browser-playable original audio (or null)
  analysis: AnalysisResult | null;
  score: GeneratedScore | null;
  error: string | null;
  stemStep: StemStep;                   // stem-separation sub-state machine
  stems: StemResult | null;
  stemError: string | null;
}
```

---

## API Routes

### POST `/api/upload`

- Accepts: `multipart/form-data` with `video` field and optional `durationSeconds` field (string, supplied by the client)
- Validates: MIME type must be one of `video/mp4`, `video/quicktime`, `video/webm`; max 100 MB
- Saves to: `public/uploads/{uuid}.{ext}` using `fs.writeFileSync`
- After saving, calls `extractOriginalAudio(fullPath, id)` — ffmpeg transcodes the video's original audio track to `public/uploads/{uuid}-original.mp3` so it is browser-playable. **Best-effort and non-fatal**: yields `undefined` (never throws) when the source has no audio stream or ffmpeg is unavailable.
- Returns: `{ videoPath: string, filename: string, sizeBytes: number, durationSeconds?: number, originalAudioUrl?: string }`
- `videoPath` is the absolute filesystem path passed verbatim to the analysis provider
- `durationSeconds` is echoed back only when finite and `> 0`
- `originalAudioUrl` is `/uploads/{uuid}-original.mp3` when extraction succeeded, else omitted
- Errors return a generic `'Upload failed. Please try again.'` (this route does **not** surface raw error messages, unlike analyze/generate)

### POST `/api/analyze`

- Accepts: `{ videoPath: string, filename: string, sizeBytes: number }` (the client also sends `durationSeconds`, but the route does not read it — Gemini infers duration)
- Validates: `videoPath`, `filename`, `sizeBytes` required and correctly typed
- Calls: `getAnalysisProvider().analyze(...)` → **always `GeminiAnalyzer`**
- Returns: `AnalysisResult`
- Error messages from providers (e.g. Gemini processing failures, missing API key) are surfaced directly to the client

### POST `/api/generate`

- Accepts: full `AnalysisResult` body (`{ analysis, videoPath, metadata }`)
- Validates: `analysis`, `videoPath`, and `metadata` must all be present
- Calls: `getMusicProvider().generate(...)`
- Returns: `GeneratedScore`
- The `audioUrl` is a real, playable, downloadable MP3 at a path under `public/generated/`
- Error messages from providers are surfaced directly to the client

### POST `/api/projects` (Phase D — auth-gated)

- `auth()` → `userId` (401 if signed out). `export const maxDuration = 180`.
- Accepts a `SaveProjectPayload` (`name`, `analysis`, `score`, `stems`, `originalAudioUrl`, `videoPath`, `videoFilename`); validates name (1–120 chars) + required fields.
- `saveProjectFromWorkflow`: promotes the local artifacts (source video, original audio, score, stems) to object storage (path-traversal-validated), then inserts the `projects` row + `project_files` rows. Stored `score.audioUrl` is rewritten to its durable URL. Rollback on failure.
- Returns `{ projectId }`.

### PATCH / DELETE `/api/projects/[id]` (Phase D — auth-gated, ownership-checked)

- `PATCH` renames (`{ name }`, 1–120 chars). `DELETE` removes the project (cascade-deletes file rows) and best-effort deletes the blobs. Both 404 if the project isn't found / not owned by the caller.

### POST `/api/projects/[id]/master` (Phase G — auth-gated, ownership-checked)

- Accepts `multipart/form-data`: `master` (rendered WAV) + `mixState` (DAW session JSON). Replaces any existing master (blob + `project_files` row `kind:'master'`), uploads the new WAV via `storage.uploadBytes`, and persists the session to `projects.mix_state`. `maxDuration = 180`.

> Project **reads** are React Server Components calling Drizzle directly (`/projects`, `/projects/[id]`), not API routes.

---

## Video Analysis — Timeline Arc

The analyzer divides the video's estimated duration into 3–5 segments, assigning each segment its own mood and energy level. This creates a narrative arc.

**Example arc for a 30-second dramatic video:**
```
[0s–8s]    calm, low         "Opening — calm, low energy"
[8s–18s]   suspenseful, med  "Mid — suspenseful, medium energy"
[18s–26s]  dramatic, high    "Mid — dramatic, high energy"
[26s–30s]  emotional, low    "Resolution — emotional, low energy"
```

### MockAnalyzer arc generation

Uses one of three predefined arc templates (3-segment, 4-segment, 5-segment), selected by seeded random from `hashString(videoPath + sizeBytes)`. The same video always returns the same result; different videos return different arcs. Segment widths are randomly proportioned within each template.

**3-segment template:**
- Seg 0 (low): mood from `[calm, emotional]`
- Seg 1 (high): mood from `[dramatic, energetic, suspenseful]`
- Seg 2 (medium): mood from `[inspirational, emotional, corporate]`

**4-segment template:**
- Seg 0 (low): `[calm, corporate]` → Seg 1 (medium): `[suspenseful, emotional]` → Seg 2 (high): `[dramatic, energetic]` → Seg 3 (low): `[emotional, inspirational]`

**5-segment template:**
- Seg 0 (low): `[calm]` → Seg 1 (medium): `[emotional, suspenseful]` → Seg 2 (high): `[dramatic, energetic]` → Seg 3 (high): `[energetic, dramatic]` → Seg 4 (low): `[emotional, inspirational]`

### GeminiAnalyzer arc generation

Sends the actual video to Gemini 2.5 Flash via the File API with a detailed JSON schema prompt. Receives real analysis of visual content, color grading, camera motion, emotional tone — **and the existing audio track** (Gemini is asked to listen and report what is audible, how loud it is, and what role a composed score should play). The model returns `videoDurationSeconds` which is stored into `metadata.durationSeconds`. The returned timeline is sorted by `startSeconds`, forced to start at 0 and end at `videoDurationSeconds`. Falls back to a 3-equal-segment timeline (`calm/low → emotional/medium → inspirational/high`) if the model returns fewer than 2 segments or invalid JSON. See the Gemini Integration section for the full expanded field set.

---

## ElevenLabs Integration

### Raw REST usage (no SDK)

`ElevenLabsProvider` calls the Sound Generation endpoint directly with `fetch` — the `elevenlabs` SDK is not used:

```ts
const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/sound-generation';
const body = { text: prompt, prompt_influence: 0.3 };
if (durationSeconds !== undefined) body.duration_seconds = durationSeconds; // omitted when unknown

const response = await fetch(ELEVENLABS_API, {
  method: 'POST',
  headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
  body: JSON.stringify(body),
});
const buffer = Buffer.from(await response.arrayBuffer());
```

### Prompt construction (`lib/providers/music/buildPrompt.ts`)

`buildPrompt()` is a pure function shared by `MockMusicProvider` and `ElevenLabsProvider`. It was rewritten to use the richer Gemini analysis and to stay **sound-only** within a **450-character** budget.

- A `VISUAL_LEAK` regex strips any model free-text that mentions the picture (`video`, `scene`, `camera`, `person`, …).
- **Core clause:** `"{Genre} score, {bpm} BPM, {energy} energy[, {keyMode} key]."`
- A `musicRole` descriptor sentence is appended when present (e.g. *"Composed as a featured score — full presence, emotionally centred."*).
- **Two paths:**
  - **Path A** (Gemini gave a clean `musicalRecommendation`): use it as the centrepiece, with an arc clause (`emotionalArc` if clean, else timeline-derived) + `"Features {instruments}."` + a mood closing.
  - **Path B** (fallback): build a `"Texture: …"` clause from `sonicTexture` + `SETTING_SONIC[settingType]` + `PALETTE_SONIC[colorPalette]`, append clean `rhythmicFeel`/`dynamicArc`, then the timeline arc, instruments, and closing.
- Mood closings (`MOOD_CLOSING`, shorter than the legacy set; default *"Evocative and resonant."*): dramatic → *"Powerful and cinematic."*, calm → *"Peaceful and serene."*, energetic → *"Driving and propulsive."*, emotional → *"Tender and moving."*, inspirational → *"Uplifting and hopeful."*, suspenseful → *"Tense and anticipatory."*, corporate → *"Polished and confident."*, happy → *"Bright and optimistic."*
- `assemble()` joins parts in order, **skipping** any part that would exceed 450 chars (so one long part doesn't drop everything after it).

`buildPrompt.ts` also exports `buildTags(result)` (mood, genre, energy, pace, top-3 instruments; ≤10) — currently unused by either provider but retained for future tag-based requests.

### Duration handling

- `duration_seconds` is sent **only when `metadata.durationSeconds >= 0.5`**; otherwise omitted (ElevenLabs picks a default). There is **no 22s cap**.
- **Long videos (> 30s)** are split into ≤30s segments fetched sequentially; their raw MP3 buffers are concatenated (`Buffer.concat`) into one file.
- Returned `durationSeconds` = the known total, or `20` when unknown.
- The audio player plays whatever duration was actually returned.

### Response handling

Reads the response body as a single `Buffer`, validates non-empty, writes to disk:

```ts
if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`);
const buffer = Buffer.from(await response.arrayBuffer());
if (buffer.length === 0) throw new Error('ElevenLabs returned an empty audio response.');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, `${id}.mp3`), buffer);
```

---

## Gemini Integration

### SDK usage

```ts
import { GoogleGenAI, FileState, createUserContent, createPartFromUri } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

### Video processing flow

1. Upload video file to Gemini File API with correct MIME type
2. Poll `ai.files.get()` every 3 seconds until `file.state === FileState.ACTIVE` (max 30 attempts = ~90s)
3. Call `ai.models.generateContent` with model `gemini-2.5-flash`, passing the file URI and the analysis prompt
4. Parse JSON from model response (strips markdown code fences if present)
5. Delete the uploaded file from Gemini (best-effort, errors swallowed)

### Retry logic

`generateWithRetry()` tries up to 4 times with exponential backoff (4s, 8s, 16s) on transient errors (503, UNAVAILABLE, overloaded, high demand). Non-transient errors throw immediately.

### Response parsing

All fields are validated through guard functions that fall back to safe values rather than throwing:
- Required (default): `toMood` → `'emotional'`, `toEnergy` → `'medium'`, `toPace` → `'moderate'`, `toGenre` → `'cinematic'`, `toNumber`, `toStringArray` → `[]`. `mood`/`energyLevel` fall back to the **peak segment** when absent.
- Optional (→ `undefined`): `toColorPalette`, `toCameraStyle`, `toVisualPace`, `toSettingType`, `toAudioEnergyLevel`, `toMusicRole`, plus the free-text fields (`emotionalArc`, `sonicTexture`, `musicalRecommendation`, `rhythmicFeel`, `dynamicArc`, `existingAudio`) kept only when non-empty strings, and `keyMode` kept only when `major|minor|modal`.

BPM is clamped to [60, 160]; `sceneCount` is `max(1, …)`; MotionScore is clamped to [0.0, 1.0]; `instrumentSuggestions` is sliced to 4. The timeline is sorted and boundary-corrected (first start = 0, last end = duration), with per-segment label defaults.

### Expanded analysis fields requested

Beyond the core profile, the prompt asks Gemini for: `colorPalette`, `cameraStyle`, `visualPace`, `settingType` (visual descriptors); `emotionalArc`, `sonicTexture`, `musicalRecommendation`, `keyMode`, `rhythmicFeel`, `dynamicArc` (a sound-only musical brief, with explicit instructions never to describe the picture); and `existingAudio`, `audioEnergyLevel`, `musicRole` (the model listens to the actual audio track and decides how a composed score should coexist with it). These feed `buildPrompt()`'s two-path logic.

---

## Mock Providers

> **Note:** `MockAnalyzer` is currently **unreferenced by the factory** (analysis always uses Gemini). It is kept fully maintained and is documented here for completeness / offline use.

### MockAnalyzer

- Seeded PRNG: `seededRandom(hashString(videoPath + String(metadata.sizeBytes)))` — deterministic per video
- Picks one of 3 arc templates (see arc section above)
- Proportions segment widths randomly within the template using seeded random weights
- Overall mood, energyLevel driven by the highest-energy (peak) segment
- BPM from energy-appropriate range: low [60, 90], medium [90, 120], high [120, 160]
- Genre from: `['cinematic', 'electronic', 'acoustic', 'orchestral', 'ambient', 'jazz']`
- SceneCount from [3, 40], motionScore from [0.1, 1.0]
- InstrumentSuggestions: 2–4 items from a pool of 15
- analysisSummary: template string using pace, peak mood, energy, sceneCount, genre, bpm, top 2 instruments
- **Also emits all expanded fields** (to mirror Gemini): seeded `colorPalette`/`cameraStyle`/`visualPace`/`settingType`; templated `emotionalArc` and `musicalRecommendation`; seeded `sonicTexture`/`rhythmicFeel`/`dynamicArc` from fixed phrase pools; `keyMode` derived from peak mood; seeded `existingAudio`/`audioEnergyLevel`; and `musicRole` **derived from `audioEnergyLevel`** (loud→underscore, silent→featured, moderate→sync/ambient, else ambient)
- Simulated delay: 2–3 seconds (`delay(2000 + Math.random() * 1000)`)

### MockMusicProvider

- Calls `buildPrompt(result)` (same function as ElevenLabsProvider)
- Calls `generateMp3(analysis, outputPath, metadata.durationSeconds)` to produce a real playable MP3 via PCM synthesis, **matched to the real video duration**
- Returns the actual synthesized duration from `generateMp3` (the real video length, clamped to [1, 120]s; falls back to energy-based 15/18/22s only when duration is unknown)
- Simulated delay: 3–5 seconds (`delay(3000 + Math.random() * 2000)`)
- Filename: `score-{mood}-{bpm}bpm.mp3`

### PCM synthesis (`lib/audio/generateTone.ts`)

Generates real audio content from the analysis. Signature: `generateMp3(analysis, outputPath, targetDurationSeconds?): number`.

- **Sample rate**: 44,100 Hz, mono, 128 kbps
- **Duration**: `clamp(targetDurationSeconds ?? ENERGY_DURATION[energy], 1, 120)` — matches the real video length, capped at `MAX_MOCK_DURATION = 120`s; energy fallback is low=15s, medium=18s, high=22s
- **Root frequency by mood**: calm=C4 (261.63 Hz), happy=E4 (329.63 Hz), energetic=G4 (392.0 Hz), dramatic=A3 (220.0 Hz), suspenseful=B3 (246.94 Hz), inspirational=F4 (349.23 Hz), emotional=D4 (293.66 Hz), corporate=Eb4 (311.13 Hz)
- **Chord progression**: I–IV–V–I (major triads as frequency ratios relative to root)
- **Bar duration**: `(60 / bpm) * 4` seconds
- **Per-bar envelope**: linear attack first 2%, sustain, linear release for final 15%
- **Amplitude**: low=0.25, medium=0.45, high=0.65
- **Noise**: light noise texture (`(Math.random()-0.5) * 0.015`) added only at high energy
- **Encoding**: lamejs `Mp3Encoder` in 1152-sample chunks (lamejs internal requirement, multiple of 576)
- **Output**: writes directly to `outputPath`, returns `durationSeconds` rounded to 1 decimal

---

## Components

> All components were recolored in the rebrand to use the theme-aware `navy-*`/`cream-*` tokens plus the literal banana-yellow `#ffcc18` (hover `#ffd84d`). The legacy `zinc-*`/`amber-500` classes are gone.

### ThemeToggle

- `'use client'` icon button in the header (sun in dark mode, moon in light)
- Defaults to dark; on mount reads `localStorage.theme` and removes `.dark` from `<html>` if `'light'`
- `toggle()` flips the `.dark` class on `document.documentElement` and persists `'dark'`/`'light'` to `localStorage`

### DropZone

- Drag-and-drop + click-to-browse (uses hidden `<input type="file">`)
- `accept="video/mp4,video/quicktime,video/webm"`
- Client-side validation before `onFileSelect` fires: type check + size ≤ 100 MB
- Shows inline error below the zone on validation failure
- Drag-over visual: `border-[#ffcc18] bg-[#ffcc18]/5 scale-[1.01]`
- Keyboard accessible: Enter/Space triggers file browser
- Callback: `onFileSelect(file: File)` — does NOT directly trigger upload

### VideoPreview

- Native `<video>` element with `controls`, `preload="metadata"`, no autoplay
- Filename truncated to 42 characters (appends `…` if longer)
- Shows formatted file size via `formatFileSize()`
- "Remove" button calls `onRemove()` (mapped to `removeFile` in the page)
- Accepts `disabled` prop — disables remove button during loading states

### AnalysisCard

- BPM is the hero number: `text-4xl font-bold text-[#ffcc18]` in the top-right corner
- **Mood badges** use the brand hex palette (some with `dark:` overrides), via a `MOOD_BADGE` map of tinted `bg/text/border`:
  - `inspirational` & `corporate` → `#7CA0CB` (slate-blue); `emotional` & `suspenseful` → `#6EA556` (green)
  - `dramatic` → `#B28B52` bronze / `dark:#fdf3ab`; `energetic` → `#ffcc18`; `happy` → `#B28B52` / `dark:` yellow; `calm` → green-500
  - Unknown mood → neutral navy fallback
- Energy badge: low = green; medium = `#B28B52`/`dark:`yellow; high = `#B28B52`/`dark:#fdf3ab`
- Pace badge: `#7CA0CB` (always)
- Genre badge: neutral `bg-navy-800 text-cream-100`
- Stats grid (2-column): Est. Scene Cuts (integer) + Motion Score (progress bar, `#ffcc18` fill over `bg-navy-700`)
- Instrument chips: flat `bg-navy-800 border-navy-700` tags
- `analysisSummary`: italic, `text-cream-200`, `border-t border-navy-800` separator
- `<TimelineBar>`: second `border-t` separator below summary

### TimelineBar

- Horizontal `flex` row, `h-9`, `rounded-lg`, `overflow-hidden`
- Each segment's width is `((endSeconds - startSeconds) / totalDuration) * 100%`
- Colors by energy: `bg-[#6EA556]` (low, green), `bg-[#fdf3ab]` (medium, pale yellow), `bg-[#FFCC18]` (high, banana)
- Text color is navy `text-[#1D2F45]` for all energies (dark text on light bars)
- First segment: `rounded-l-lg`, last: `rounded-r-lg`
- Text label (the mood word) shown only when `widthPct > 16%`
- Hover: `hover:opacity-80`
- Title tooltip: `${seg.label} (${seg.startSeconds}s – ${seg.endSeconds}s)`
- "Video Arc" heading; time axis below: "0s" on left, `{totalDuration}s` on right

### AudioPlayer

- `'use client'`; `useRef<HTMLAudioElement>` — no library
- Local state: `isPlaying`, `currentTime`, `duration`, `isLoaded`
- `useEffect` attaches `timeupdate`, `loadedmetadata`, `ended`; cleans up on unmount
- **Decorative waveform**: 40 bars with heights computed once from sine/cosine formula; bars to the left of playback position colored `#ffcc18`, others `bg-navy-700`
- **Seek bar**: `<input type="range">` with banana gradient fill via inline `background` style: `linear-gradient(to right, #ffcc18 ${pct}%, #2D4B6E ${pct}%)`
- Thumb styled via Tailwind arbitrary pseudo-selector variants `[&::-webkit-slider-thumb]` and `[&::-moz-range-thumb]` (colored `#ffcc18`)
- Play/pause: `#ffcc18` filled circle button (`h-10 w-10`, `text-navy-950`) with inline SVG icons
- Time display: `{formatDuration(currentTime)} / {formatDuration(duration)}`
- Shows "Loading audio…" in `text-cream-400` while `!isLoaded`

### ScoreOutput

The output panel shown at the `completed` step (replaces the bare `AudioPlayer`). Props: `{ score: GeneratedScore; videoSrc: string; originalAudioUrl: string | null }`.

- `'use client'`; local UI state only: `tab: 'audio' | 'combined'` and `includeOriginalAudio: boolean` (default **false**, so the pure generated score is heard first). Derives `hasOriginalAudio` from `originalAudioUrl`.
- **Top tab bar** with two tabs — **"Generated Score"** (the standalone `AudioPlayer`) and **"Video + Score"** (the `CombinedVideoPlayer`). The active tab is banana-filled (`bg-[#ffcc18] text-navy-950`).
- Only the **active** tab is mounted — switching tabs unmounts the inactive player, tearing down its media so there is never overlapping audio.
- **Bottom-right toggle switch "Include original audio"** is rendered only on the combined tab. When `hasOriginalAudio` is false it is **disabled** and relabeled "Original video has no usable audio track". It drives `CombinedVideoPlayer`'s `includeOriginalAudio` prop.
- If `videoSrc` is empty (no original video available), it degrades to rendering the `AudioPlayer` alone — no tabs.

### CombinedVideoPlayer

Plays the original video in sync with the generated score (and, optionally, the original audio) under one transport. Props: `{ videoSrc: string; audioSrc: string; originalAudioUrl: string | null; includeOriginalAudio: boolean }`.

- **Why a separate original-audio track:** browsers ship only a few audio decoders, so a clip whose audio is e.g. **AC-3 / E-AC-3 or PCM-in-MOV** plays its video but is silent — the bytes aren't stripped, the browser just can't decode them. So the upload step extracts the original audio to a browser-playable MP3 with ffmpeg (`extractOriginalAudio`) and this player plays *that*, rather than relying on the `<video>`'s own (often undecodable) audio.
- `'use client'`; refs `videoRef`, `scoreRef`, `originalRef`; custom transport styled to match `AudioPlayer` (banana play/pause circle, gradient seek bar, `mm:ss / mm:ss` readout). No native `<video controls>`.
- **The `<video>` is ALWAYS muted** — it provides frames + the master clock only. Audio comes solely from the slaved `<audio>` elements: the generated score (always audible) and the original audio (rendered only when `originalAudioUrl` is non-null).
- **Video is the master clock.** Play/pause acts on the video + every slaved audio (aligned to the video's `currentTime` first); seeking sets `currentTime` on all; on the video's `timeupdate` each slaved audio is **drift-corrected** (snapped back if `|a.currentTime − video.currentTime| > 0.25s`).
- `includeOriginalAudio` sets `originalRef.muted = !includeOriginalAudio` live (no playback interruption); the score `<audio>` is always audible.
- Controls disabled until **video + score** report `loadedmetadata` (`videoReady && scoreReady`); the original-audio track is not gated on, so a slow/absent extra track never blocks playback. Shows "Loading video…" until then.
- On video `ended`, every element pauses and resets to 0. On unmount, all are paused.
- Score/video length mismatch is tolerated: the video duration is the timeline; a shorter track simply ends early, a longer one is cut at video end.

### DownloadButton

- `<a href={score.audioUrl} download={score.filename} className="block">` wrapping shadcn `<Button size="lg">`
- Button styled as `bg-navy-800 text-cream-50 border border-navy-700 hover:bg-navy-700` (dark secondary style, not banana)
- Shows `Download {score.filename}` with a download icon
- Direct anchor download — no JavaScript fetch or Blob

---

## Workflow Hook (`hooks/useWorkflow.ts`)

Central state machine. All mutations have `retry: 0` (configured on the `QueryClient`).

### Exports

```ts
{
  state: WorkflowState;
  selectFile: (file: File) => void;         // stores file + creates objectUrl; does NOT upload
  removeFile: () => void;                    // revokes objectUrl, resets to defaultState
  upload: () => void;                        // POSTs to /api/upload; sets step: 'uploading'
  analyze: () => void;                       // POSTs to /api/analyze; sets step: 'analyzing'
  generate: () => void;                      // POSTs to /api/generate; sets step: 'generating'
  reset: () => void;                         // revokes objectUrl, resets to defaultState
}
```

### Step regression on error

Errors regress the step to the previous stable step (not just set `state.error`):
- Upload error → `step: 'idle'`
- Analyze error → `step: 'uploaded'`
- Generate error → `step: 'analyzed'`

### Internal fetch utility

`apiFetch<T>(url, init)` — wraps `fetch`, parses JSON, throws `Error` with the server's `error` message if `!res.ok`. Used by all three mutations.

---

## Page Layout (`app/studio/page.tsx`)

> The workflow lives at **`/studio`** (moved from `app/page.tsx` in Phase A); `/` is the marketing Home. The header/footer are now in the **global shell** (`app/layout.tsx`), so this page renders only its `<main>`.

The page is `'use client'`. It computes `STEP_ORDER` (numeric values per step) to drive the step indicator's done/active/pending states.

### Global shell (`app/layout.tsx`, on every page)
- **`SiteHeader`** — sticky, `bg-navy-950/80 backdrop-blur-sm`, `border-b border-navy-800`; left: `banana-logo.svg` + "BananaMOV" wordmark linking to `/`; nav links Home/Studio (active = `text-[#ffcc18]`); right: "Powered by ElevenLabs" pill, `<HeaderAuth />` (Clerk; only when `clerkEnabled`), and `<ThemeToggle />`.
- **`SiteFooter`** — "Built for JamHacks 2026 · Powered by ElevenLabs".

### Authentication (Clerk, Phase B)
- **Guarded by `clerkEnabled`** (`lib/auth.ts`, true when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set). With no keys the app still builds/runs — `ClerkProvider`, the header control, and route protection all stay dormant; the sign-in/up pages show a "not configured" notice. Adding keys activates everything with no code change.
- **Gating model:** `/studio` and the generation APIs are **public**; sign-in is required only to save/view projects (`/projects`) and to mix (`/mix`). `middleware.ts` protects `/projects(.*)`, `/mix(.*)`, `/api/projects(.*)`.
- **`HeaderAuth`** (`'use client'`) branches on `useUser()` → `<UserButton/>` or `<SignInButton mode="redirect">`. (In Clerk v7 `<SignedIn>/<SignedOut>` are server-only, so a client header uses the hook.)
- **Pages:** `/sign-in`, `/sign-up` (Clerk catch-all routes).
- **Middleware matcher:** the canonical Clerk matcher (all routes except `_next`/static, plus `/api`); protection scoped to gated routes via `createRouteMatcher`. A narrower `/projects/:path*` matcher would miss the bare `/projects` path and leave it unprotected.

### Data & Storage (Phase C — schema/code only; save flow is Phase D)
- **Neon + Drizzle.** `lib/db/schema.ts` defines `projects` (one row per saved generation: jsonb `analysis`/`score`, denormalized bpm/genre/mood/duration, reserved `mix_state`) and `project_files` (object-storage URLs per artifact; cascade-deletes with its project). `lib/db/index.ts` is the Neon HTTP drizzle client. Migrations in `drizzle/` (committed); scripts `db:generate` / `db:migrate` / `db:studio`.
- **Object storage.** `StorageProvider` interface (`upload`/`delete`) with `VercelBlobProvider` (default, durable) and `LocalStorageProvider` (dev → `public/projects`), chosen by `STORAGE_PROVIDER`.
- **Promotion model.** The `/studio` workflow keeps writing artifacts to local disk; saving a project (Phase D) promotes them to durable storage and records the rows.
- **Domain types:** `Project`, `ProjectFile`, `ProjectSummary`, `SaveProjectPayload`, `MixTrack`, `MixSession` in `types/index.ts`.

### Projects — save / list / detail (Phase D)
- **Saving (auth required).** In the studio's completed state, signed-in users get a "Save to project" button (signed-out users get a **modal** sign-in so the in-memory generation isn't lost). A name dialog POSTs to `/api/projects`, which promotes the local artifacts to object storage and writes the project + file rows, then redirects to the new `/projects/[id]`.
- **One project = one saved generation**, owned by a Clerk user; all queries are scoped by `userId`.
- **`/projects`** lists the user's saved projects as cards (name, mood/genre/bpm/duration, date) with inline rename and two-step delete.
- **`/projects/[id]`** replays a saved generation from stored jsonb + Blob URLs, reusing `AnalysisCard`, `ScoreOutput`, `StemPlayer`, and `DownloadButton` unchanged (`buildPlayback` reconstructs `videoSrc`/`originalAudioUrl`/stems). Includes delete + back-to-projects.
- **Deletion** removes the project (cascade-deletes its file rows) and best-effort deletes the blobs.

### Mixing / Mastering — the DAW (Phase G)
- **Real Web-Audio DAW** (imported from the `maxim` branch) replaces the Phase E placeholder. A saved project becomes a `MixSession` (`buildMixSession`), adapted by `mixSessionToDAWSeed` into the DAW's library items (score, stems, original audio).
- **`/mix/[projectId]`** (gated): loads the owned project and renders `DAWWorkspace` **full-bleed under the global header**. The DAW provides a track arrangement, a mixer with inserts + effects (EQ / reverb / delay / compressor / distortion), Web Audio playback, and an offline render to WAV. Cross-origin Blob audio decodes fine (Blob serves `ACAO: *`).
- **Export & save master:** "Save master to project" renders the mix and POSTs it (+ the DAW session JSON) to `/api/projects/[id]/master`, which stores the WAV as a `project_files` row (`kind: 'master'`) and persists the session to `projects.mix_state`. The detail page offers a "Download mastered mix (.wav)" link; reopening the mixer restores the saved session.
- **Standalone `/daw`** (public) still works via URL-seeded query params for direct use.
- **Entry points:** "Open Mixing →" on the project detail page, and "Save & open mixing →" in the studio (saves first, then routes to `/mix/[id]`).

### Hero section
- Visible only when `step === 'idle'`
- Headline: "Score your video with AI"
- Subtext describes the workflow

### Step indicator
- Visible when `step !== 'idle'`
- Three labeled circles: Upload (1), Analyze (2), Generate (3)
- Done steps: filled `#ffcc18` circle with checkmark icon + `#ffcc18` label
- Active step: `#ffcc18` border outline + `cream-50` label
- Pending: `navy-700` border + `cream-400` label
- Connecting lines between circles: `#ffcc18` when preceding step is done, `navy-700` otherwise
- "Start over" link in the top-right (disabled during loading)

### Upload section
- Shows `<DropZone>` when `!videoFile && !isLoading`
- Shows `<VideoPreview>` when `videoFile && videoObjectUrl`
- Shows "Upload & Continue →" button when `step === 'idle' && videoFile`
- Shows upload `<Spinner>` when `isUploading`

### Section visibility rules
- "Analyze Video →": `step === 'uploaded' && !error`
- Analysis spinner: `isAnalyzing`
- `<AnalysisCard>`: `step` is one of `['analyzed', 'generating', 'completed']`
- "Generate Score →": `step === 'analyzed' && !error`
- Generation spinner: `isGenerating`
- Score section: `step === 'completed' && score !== null`

### Score section (completed step)
- Divider with "Your Score" label
- Metadata badges: Mood, Genre, BPM, Duration
- Generation prompt box (italic `cream-200` text in a `bg-navy-950/50` box)
- `<ScoreOutput score={score} videoSrc={videoObjectUrl ?? ''} originalAudioUrl={originalAudioUrl} />` — tabbed score-only / video+score panel (the original video is still available in-browser via the persisted `videoObjectUrl`; `originalAudioUrl` is the ffmpeg-extracted, browser-playable original audio)
- `<DownloadButton score={score} />`
- Stem separation controls (Split into Stems → / spinner / error / `<StemPlayer>`)
- "Score another video" link → `reset()`

### Error banner
- Visible when `error && !isLoading`
- Red border/background, warning SVG icon
- "Retry" button: calls `analyze` when `step === 'uploaded'`, `generate` when `step === 'analyzed'`, absent otherwise
- "Start Over" button always present

### Spinner component (inline)
- `h-12 w-12 animate-spin` border spinner (`navy-700` base, `#ffcc18` top)
- Single label string beneath (`text-cream-200`)

---

## Visual Design

Theme-aware via custom tokens in `globals.css`: Tailwind utilities `navy-*` (surface/background) and `cream-*` (text/foreground) resolve to CSS variables that flip between `:root` (light = warm parchment) and `.dark` (dark = navy). **Token names are semantic, not literal** — `navy-*` is always the surface even in light mode. The banana accent `#ffcc18` is a constant literal across themes.

- Dark theme (default): `navy-950` `#1D2F45` background, `navy-900` `#1F3550` cards, `navy-800` `#243D5C` elevated, `navy-700` `#2D4B6E` borders; `cream-50` `#FDF6EB` text
- Light theme (parchment): `navy-950` `#F8F0E2` background … `navy-700` `#CFBB92` borders; `cream-50` `#1D2F45` text
- Accent: banana-yellow `#ffcc18` (hover `#ffd84d`) for CTAs, progress, highlights, spinner top — applied as literal `bg-[#ffcc18]` (not a token)
- Other brand colors used in badges/timeline: `#fdf3ab` pale-yellow, `#7CA0CB` slate-blue, `#6EA556` leaf-green, `#B28B52` bronze
- Header: sticky, `bg-navy-950/80 backdrop-blur-sm`, `border-b border-navy-800`
- Content: `max-w-3xl`, `space-y-8`, `px-6 py-12`
- Card pattern: `rounded-xl border border-navy-700 bg-navy-900 p-6`
- Buttons: `rounded-xl bg-[#ffcc18] py-3 text-sm font-semibold text-navy-950` with `hover:bg-[#ffd84d] active:scale-[0.99]`
- Typography: Geist Sans (body) and Geist Mono (code) from `next/font/google`
- Animations: `animate-fade-in` (`fadeIn` keyframe: `opacity: 0, translateY(8px) → opacity: 1, translateY(0)`, 0.35s ease-out)
- Theme toggle: `<html>` starts with `dark`; `ThemeToggle` flips the `.dark` class and persists to `localStorage`
- The CSS also imports `tw-animate-css`, declares `@custom-variant dark`, maps tokens in `@theme inline`, and redefines the shadcn variable set under both `:root` and `.dark`

---

## Environment Variables

```bash
# .env.local (gitignored — never commit)
MUSIC_PROVIDER=elevenlabs       # 'mock' or 'elevenlabs'
ELEVENLABS_API_KEY=your_key
GEMINI_API_KEY=your_key         # required — analysis always uses Gemini
```

```bash
# .env.example (committed — no real keys)
MUSIC_PROVIDER=mock
ELEVENLABS_API_KEY=
GEMINI_API_KEY=
```

- **`ANALYSIS_PROVIDER` is no longer read** — the analysis factory is hardcoded to Gemini, so `GEMINI_API_KEY` is effectively required to run the analyze step.
- Only `MUSIC_PROVIDER` still branches (default `'mock'`; options `mock` | `elevenlabs` | `elevenmusic`). `ELEVENLABS_API_KEY` is required when `MUSIC_PROVIDER=elevenlabs` **or** `elevenmusic`; the latter also requires the key to have **Music Generation = Access** enabled.

---

## Error Handling

- Wrong file type: inline error under dropzone (no API call made)
- File too large: inline error under dropzone (no API call made)
- Upload failure: error banner, step regresses to `idle`; user can start over
- Analyze failure: error banner, step regresses to `uploaded`; user can retry or start over
- Generate failure: error banner, step regresses to `analyzed`; user can retry or start over
- Gemini processing failure (state != ACTIVE): error message surfaced from provider
- ElevenLabs empty response: error message surfaced from provider
- Missing API keys: constructors throw on instantiation (caught by API route, surfaced as 500)

---

## Eleven Music Integration — IMPLEMENTED (Phases 1–2)

> **STATUS: shipped as `ElevenMusicProvider` (opt-in via `MUSIC_PROVIDER=elevenmusic`; mock stays default).** Composition-plan mode is live; Phase 3 (Gemini authoring per-section styles) remains future. **Runtime prerequisite:** the API key must have **Music Generation = Access** enabled. Implemented with `MAX_TOTAL_SECONDS = 180`, heuristic styles from existing Gemini fields (no analyze-step changes), always instrumental.

### Motivation
The original `ElevenLabsProvider` calls the ElevenLabs **sound-effects** endpoint (`/v1/sound-generation`): a single holistic clip with `duration_seconds` as the only temporal control, no sections/timing, and a 30 s cap that forces repetitive multi-segment stitching. To make scores **align with the video's structure** (Idea 1) and carry **richer musical direction** (Idea 3), `ElevenMusicProvider` uses the ElevenLabs **Music** API (`POST /v1/music`, `model_id: music_v1`), which supports up to 600 s in one call and a structured `composition_plan`. The sound-effects provider and mock remain for A/B and fallback.

### The Music API (verified)
- Two mutually exclusive modes:
  - **`prompt`** (string) + `music_length_ms` (3,000–600,000) + `force_instrumental` (prompt-mode only).
  - **`composition_plan`** (`MusicPrompt` for `music_v1`): `positive_global_styles[]`, `negative_global_styles[]`, and `sections[]` where each `SongSection` has `section_name`, `positive_local_styles[]`, `negative_local_styles[]`, `duration_ms` (3,000–120,000), and `lines[]` (lyrics; empty ⇒ instrumental). `respect_sections_durations` enforces section lengths.
- **Prerequisites/limits:** the API key needs **Music Generation = Access**; music costs ~600–700 credits/min (Creator plan = 100k credits/mo); paid-plan outputs carry commercial rights (no real artist names / copyrighted lyrics).

### Idea 1 — structural alignment
`buildCompositionPlan(result)` maps the Gemini `timeline` (3–5 arc segments) onto `composition_plan.sections`, one section per segment, so the score's section changes track the video's arc. Each section clamped to [3 s, 120 s] (short segments merged into a neighbour, long ones split into equal sub-sections), total capped at `MAX_TOTAL_SECONDS = 180` (3 min) and scaled to the real video length, with `respect_sections_durations: true`. This is sectional alignment, not frame-accurate scene-cut sync (the 3 s minimum precludes 2 s/3 s cuts — and that's musically correct).

### Idea 3 — richer direction
Per-section `positive_local_styles` and global `positive/negative_global_styles` sourced from Gemini's existing musical fields (`musicalRecommendation`, `sonicTexture`, `instrumentSuggestions`, `keyMode`, `rhythmicFeel`, `dynamicArc`, `genre`, `bpm`), filtered sound-only via the `VISUAL_LEAK` regex; instrumental enforced by empty `lines` + negative `vocals`. **Deepest variant (optional):** extend the Gemini schema so the model emits per-segment style keyword arrays directly.

### Rollout (additive, behind the factory)
`ElevenMusicProvider` implements the unchanged `MusicGenerationProvider` interface, selected by `MUSIC_PROVIDER=elevenmusic`; the sound-effects provider and mock remain for A/B and fallback. New files: `lib/providers/music/ElevenMusicProvider.ts`, `lib/providers/music/buildCompositionPlan.ts`. **Phase 2 (composition-plan mapping) is implemented; Phase 3 (Gemini-emitted per-section styles) is future.** The response is raw MP3 bytes, written to `public/generated/{uuid}.mp3`; the returned `GeneratedScore` includes an optional `sections[]` summary and a human-readable plan serialization in `prompt`. See CLAUDE.md → "Eleven Music Integration (Ideas 1 & 3)" for the full engineering detail.

---

## MVP Constraints (Not Built)

- No user authentication
- No database or persistence
- No payments
- No stem editing or DAW features
- No real-time streaming audio
- No multi-page routing
- No persisted state beyond the theme preference (`localStorage.theme` is the only stored value; all workflow state is React-only)

**Now implemented (previously listed as out of scope):**
- Multi-segment audio stitching for videos > 30s (`ElevenLabsProvider` fetches sequential ≤30s segments and concatenates the raw MP3 buffers)
- Light/dark theme toggle with `localStorage` persistence

---

## MVP Definition of Done

A user can:

1. Visit the site at `localhost:3000`
2. Upload a video via drag-and-drop or file picker (file is previewed before upload)
3. Click "Upload & Continue" to upload the video
4. See the step indicator appear
5. Click "Analyze Video" and receive a timeline arc + overall analysis card
6. See the timeline visualized as a colored proportional segment bar with hover tooltips
7. Click "Generate Score" and receive a real, playable MP3 (ElevenLabs or mock)
8. See the generation prompt that was used in a styled box
9. Play, pause, and seek through the audio in the custom player with waveform visualization
10. Switch to the "Video + Score" tab to watch the original video in sync with the generated score, and toggle "Include original audio" to A/B the pure score against the score layered over the video's own audio
11. Download the MP3 via direct anchor download

Additionally:
- `npm run build` succeeds with zero TypeScript errors
- `npm run lint` passes with zero ESLint errors
- Gemini analysis runs (always-on; requires `GEMINI_API_KEY`) and different videos produce different results/prompts
- ElevenLabs integration works when `MUSIC_PROVIDER=elevenlabs` and key is set (incl. multi-segment for long videos)
- The light/dark theme toggle works and persists across reloads
