# SPEC.md — BananaMOV

> AI-powered video scoring platform. Built for JamHacks 2026.
> ElevenLabs is a track prize sponsor — ElevenLabs Sound Generation is the required music generation API.

---

## Overview

BananaMOV accepts a user-uploaded video, analyzes its visual characteristics across the video's timeline, and generates a matching music score via the ElevenLabs Sound Generation API. The MVP validates the full core workflow end-to-end: **Upload → Analyze → Generate → Preview → Download**.

The video analysis produces a time-segmented arc (how mood and energy evolve throughout the video), which is collapsed into a single rich text prompt sent to ElevenLabs. The returned audio is served for preview and download.

All AI integrations sit behind swappable provider interfaces. The analysis provider defaults to a deterministic mock but supports Google Gemini 2.5 Flash for real video understanding. The music provider defaults to a mock that synthesizes real PCM audio but supports ElevenLabs Sound Generation for production use.

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
| `completed` | Video preview + step indicator + analysis card + score section (player + download) |

On error at any step: an error banner appears with a "Retry" button (for analyze/generate failures) and a "Start Over" button. On error, the step regresses to the previous stable step (`uploaded` after analyze failure, `analyzed` after generate failure).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 (`tw-animate-css`, `shadcn/tailwind.css`) |
| Components | shadcn/ui (`button`, `badge`, `card`) |
| Data fetching | TanStack Query v5 (`useMutation` only) |
| Video analysis | Mock (default) or Google Gemini 2.5 Flash |
| Music generation | Mock PCM synthesis (default) or ElevenLabs Sound Generation API |
| File storage | Local filesystem (`public/uploads`, `public/generated`) |
| Database | None |
| Auth | None |

---

## Folder Structure

```
/
├── app/
│   ├── layout.tsx                     # Root layout, Geist fonts, Providers, metadata
│   ├── page.tsx                       # Single-page workflow (entire UI)
│   ├── providers.tsx                  # 'use client' TanStack QueryClientProvider wrapper
│   ├── globals.css                    # Tailwind imports, CSS vars, fadeIn keyframe
│   └── api/
│       ├── upload/route.ts            # POST — receives video, saves to disk
│       ├── analyze/route.ts           # POST — returns AnalysisResult
│       └── generate/route.ts          # POST — returns GeneratedScore
├── components/
│   ├── upload/
│   │   ├── DropZone.tsx               # Drag-and-drop with client-side validation
│   │   └── VideoPreview.tsx           # Native video element with metadata + remove button
│   ├── analysis/
│   │   ├── AnalysisCard.tsx           # Overall profile summary card
│   │   └── TimelineBar.tsx            # Colored segment timeline bar
│   ├── player/
│   │   ├── AudioPlayer.tsx            # Custom player (play/pause/seek/waveform)
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
│   │       ├── buildPrompt.ts         # Shared prompt + tags generation (used by both providers)
│   │       ├── MockMusicProvider.ts   # Generates real MP3 via lamejs PCM synthesis
│   │       └── ElevenLabsProvider.ts  # Calls ElevenLabs Sound Generation API
│   ├── audio/
│   │   └── generateTone.ts            # PCM synthesis + lamejs MP3 encoding (mock only)
│   └── utils.ts                       # cn, formatDuration, formatFileSize, seededRandom,
│                                      #   hashString, generateId, delay
├── hooks/
│   └── useWorkflow.ts                 # Central state machine + TanStack Query mutations
├── types/
│   └── index.ts                       # All shared TypeScript types
└── public/
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

The active provider is selected by env var in `lib/providers/factory.ts`:

| Env var | Value | Provider |
|---|---|---|
| `ANALYSIS_PROVIDER` | `mock` (default) | `MockAnalyzer` |
| `ANALYSIS_PROVIDER` | `gemini` | `GeminiAnalyzer` |
| `MUSIC_PROVIDER` | `mock` (default) | `MockMusicProvider` |
| `MUSIC_PROVIDER` | `elevenlabs` | `ElevenLabsProvider` |

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

export interface VideoMetadata {
  filename: string;
  sizeBytes: number;
  durationSeconds?: number;  // set by GeminiAnalyzer; absent for MockAnalyzer inputs
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
  analysis: AnalysisResult | null;
  score: GeneratedScore | null;
  error: string | null;
}
```

---

## API Routes

### POST `/api/upload`

- Accepts: `multipart/form-data` with `video` field
- Validates: MIME type must be one of `video/mp4`, `video/quicktime`, `video/webm`; max 100 MB
- Saves to: `public/uploads/{uuid}.{ext}` using `fs.writeFileSync`
- Returns: `{ videoPath: string, filename: string, sizeBytes: number }`
- `videoPath` is the absolute filesystem path passed verbatim to the analysis provider

### POST `/api/analyze`

- Accepts: `{ videoPath: string, filename: string, sizeBytes: number }`
- Validates: all three fields required and correctly typed
- Calls: `getAnalysisProvider().analyze(...)`
- Returns: `AnalysisResult`
- Error messages from providers (e.g. Gemini processing failures) are surfaced directly to the client

### POST `/api/generate`

- Accepts: full `AnalysisResult` body (`{ analysis, videoPath, metadata }`)
- Validates: `analysis`, `videoPath`, and `metadata` must all be present
- Calls: `getMusicProvider().generate(...)`
- Returns: `GeneratedScore`
- The `audioUrl` is a real, playable, downloadable MP3 at a path under `public/generated/`
- Error messages from providers are surfaced directly to the client

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

Sends the actual video to Gemini 2.5 Flash via the File API with a detailed JSON schema prompt. Receives real analysis of visual content, color grading, camera motion, and emotional tone. The model returns `videoDurationSeconds` which is stored into `metadata.durationSeconds`. The returned timeline is sorted by `startSeconds`, forced to start at 0 and end at `videoDurationSeconds`. Falls back to a 3-equal-segment timeline if the model returns fewer than 2 segments or invalid JSON.

---

## ElevenLabs Integration

### SDK usage

```ts
import { ElevenLabsClient } from 'elevenlabs';
const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const audioStream = await client.textToSoundEffects.convert({
  text: prompt,
  duration_seconds: Math.min(metadata.durationSeconds ?? 20, 22),
  prompt_influence: 0.5,
});
```

### Prompt construction (`lib/providers/music/buildPrompt.ts`)

The `buildPrompt()` function is a pure function shared by both `MockMusicProvider` and `ElevenLabsProvider`:

1. Opens with: `"{genre} music score, approximately {bpm} BPM,"`
2. Describes each timeline segment:
   - First: `"beginning with a {energy}-energy, {mood} feel"`
   - Middle: `"building through a {energy}-energy, {mood} section"`
   - Last: `"ending with a {energy}-energy, {mood} resolution"`
3. Lists instruments: `"Features {instrumentSuggestions[0..3]}."`
4. Closes with a mood-specific sentence from `MOOD_CLOSINGS`:
   - `dramatic` → "Cinematic, powerful, and emotionally impactful."
   - `calm` → "Peaceful, reflective, and serene."
   - `energetic` → "Dynamic, driving, and high-energy."
   - `emotional` → "Heartfelt, tender, and deeply moving."
   - `inspirational` → "Uplifting, hopeful, and motivating."
   - `suspenseful` → "Tense, mysterious, and full of anticipation."
   - `corporate` → "Professional, polished, and confident."
   - `happy` → "Bright, playful, and optimistic."
5. Truncated to 1000 characters (ElevenLabs `description` field limit)

**Example prompt:**
> "Cinematic music score, approximately 95 BPM, beginning with a low-energy, calm feel, building through a medium-energy, suspenseful section, ending with a high-energy, dramatic resolution. Features strings, piano, brass, cello. Cinematic, powerful, and emotionally impactful."

`buildPrompt.ts` also exports `buildTags(result: AnalysisResult): string[]`, which returns up to 10 tags for the ElevenLabs request (mood, genre, energy level, pace, and top 3 instruments).

### Duration handling

- `duration_seconds = Math.min(metadata.durationSeconds ?? 20, 22)` — capped at 22s (ElevenLabs limit)
- If video duration is unknown (mock analysis), defaults to 20 seconds
- The audio player plays whatever duration was actually returned

### Response handling

The ElevenLabs SDK returns an async iterable. Collect into a `Buffer`, validate non-empty, write to disk:

```ts
const chunks: Buffer[] = [];
for await (const chunk of audioStream) {
  chunks.push(Buffer.from(chunk));
}
const buffer = Buffer.concat(chunks);
if (buffer.length === 0) throw new Error('ElevenLabs returned an empty audio response.');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, buffer);
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

All fields are validated through guard functions (`toMood`, `toEnergy`, `toPace`, `toGenre`, `toNumber`, `toStringArray`) that fall back to safe defaults rather than throwing. BPM is clamped to [60, 160]. MotionScore is clamped to [0.0, 1.0]. The timeline is sorted and boundary-corrected.

---

## Mock Providers

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
- Simulated delay: 2–3 seconds (`delay(2000 + Math.random() * 1000)`)

### MockMusicProvider

- Calls `buildPrompt(result)` (same function as ElevenLabsProvider)
- Calls `generateMp3(analysis, outputPath)` to produce a real playable MP3 via PCM synthesis
- Returns duration from `generateMp3` (energy-dependent: low=15s, medium=18s, high=22s)
- Simulated delay: 3–5 seconds (`delay(3000 + Math.random() * 2000)`)
- Filename: `score-{mood}-{bpm}bpm.mp3`

### PCM synthesis (`lib/audio/generateTone.ts`)

Generates real audio content from the analysis:

- **Sample rate**: 44,100 Hz, mono, 128 kbps
- **Root frequency by mood**: calm=C4 (261.63 Hz), happy=E4 (329.63 Hz), energetic=G4 (392.0 Hz), dramatic=A3 (220.0 Hz), suspenseful=B3 (246.94 Hz), inspirational=F4 (349.23 Hz), emotional=D4 (293.66 Hz), corporate=Eb4 (311.13 Hz)
- **Chord progression**: I–IV–V–I (major triads as frequency ratios relative to root)
- **Bar duration**: `(60 / bpm) * 4` seconds
- **Per-bar envelope**: linear attack first 2%, sustain, linear release for final 15%
- **Amplitude**: low=0.25, medium=0.45, high=0.65
- **Noise**: light noise texture (`(Math.random()-0.5) * 0.015`) added only at high energy
- **Encoding**: lamejs `Mp3Encoder` in 1152-sample chunks (lamejs internal requirement, multiple of 576)
- **Output**: writes directly to `outputPath`, returns `durationSeconds`

---

## Components

### DropZone

- Drag-and-drop + click-to-browse (uses hidden `<input type="file">`)
- `accept="video/mp4,video/quicktime,video/webm"`
- Client-side validation before `onFileSelect` fires: type check + size ≤ 100 MB
- Shows inline error below the zone on validation failure
- Drag-over visual: `border-amber-500 bg-amber-500/5 scale-[1.01]`
- Keyboard accessible: Enter/Space triggers file browser
- Callback: `onFileSelect(file: File)` — does NOT directly trigger upload

### VideoPreview

- Native `<video>` element with `controls`, `preload="metadata"`, no autoplay
- Filename truncated to 42 characters (appends `…` if longer)
- Shows formatted file size via `formatFileSize()`
- "Remove" button calls `onRemove()` (mapped to `removeFile` in the page)
- Accepts `disabled` prop — disables remove button during loading states

### AnalysisCard

- BPM is the hero number: `text-4xl font-bold text-amber-500` in the top-right corner
- **Mood badges** are mood-specific colors:
  - `inspirational` → sky, `emotional` → violet, `dramatic` → red, `energetic` → orange
  - `suspenseful` → purple, `corporate` → blue, `happy` → yellow, `calm` → green
- Energy badge: green (low), yellow (medium), red (high)
- Pace badge: blue
- Genre badge: zinc (neutral)
- Stats grid (2-column): Est. Scene Cuts (integer) + Motion Score (progress bar, amber fill)
- Instrument chips: flat zinc-800 bordered tags
- `analysisSummary`: italic, zinc-400, border-t separator
- `<TimelineBar>`: border-t separator below summary

### TimelineBar

- Horizontal `flex` row, `h-9`, `rounded-lg`, `overflow-hidden`
- Each segment's width is `((endSeconds - startSeconds) / totalDuration) * 100%`
- Colors by energy: `bg-green-500` (low), `bg-yellow-500` (medium), `bg-red-500` (high)
- Text color by energy (dark): `text-green-950`, `text-yellow-950`, `text-red-950`
- First segment: `rounded-l-lg`, last: `rounded-r-lg`
- Text label (the mood word) shown only when `widthPct > 16%`
- Hover: `hover:opacity-80`
- Title tooltip: `${seg.label} (${seg.startSeconds}s – ${seg.endSeconds}s)`
- Time axis below: "0s" on left, `{totalDuration}s` on right

### AudioPlayer

- `'use client'`; `useRef<HTMLAudioElement>` — no library
- Local state: `isPlaying`, `currentTime`, `duration`, `isLoaded`
- `useEffect` attaches `timeupdate`, `loadedmetadata`, `ended`; cleans up on unmount
- **Decorative waveform**: 40 bars with heights computed once from sine/cosine formula; bars to the left of playback position colored amber-500, others zinc-700
- **Seek bar**: `<input type="range">` with amber gradient fill via inline `background` style: `linear-gradient(to right, #f59e0b ${pct}%, #3f3f46 ${pct}%)`
- Thumb styled via Tailwind arbitrary pseudo-selector variants `[&::-webkit-slider-thumb]` and `[&::-moz-range-thumb]`
- Play/pause: amber filled circle button with inline SVG icons
- Time display: `{formatDuration(currentTime)} / {formatDuration(duration)}`
- Shows "Loading audio…" in zinc-600 while `!isLoaded`

### DownloadButton

- `<a href={score.audioUrl} download={score.filename} className="block">` wrapping shadcn `<Button>`
- Button styled as `bg-zinc-800 text-zinc-100 hover:bg-zinc-700` (dark secondary style, not amber)
- Shows `Download {score.filename}`
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

## Page Layout (`app/page.tsx`)

The page is `'use client'`. It computes `STEP_ORDER` (numeric values per step) to drive the step indicator's done/active/pending states.

### Hero section
- Visible only when `step === 'idle'`
- Headline: "Score your video with AI"
- Subtext describes the workflow

### Step indicator
- Visible when `step !== 'idle'`
- Three labeled circles: Upload (1), Analyze (2), Generate (3)
- Done steps: filled amber-500 circle with checkmark icon + amber-400 label
- Active step: amber-500 border outline + zinc-200 label
- Pending: zinc-700 border + zinc-600 label
- Connecting lines between circles: amber-500 when preceding step is done, zinc-700 otherwise
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
- Generation prompt box (italic zinc-400 text in zinc-950/50 box)
- `<AudioPlayer src={score.audioUrl} />`
- `<DownloadButton score={score} />`
- "Score another video" link → `reset()`

### Error banner
- Visible when `error && !isLoading`
- Red border/background, warning SVG icon
- "Retry" button: calls `analyze` when `step === 'uploaded'`, `generate` when `step === 'analyzed'`, absent otherwise
- "Start Over" button always present

### Spinner component (inline)
- `h-12 w-12 animate-spin` border spinner (zinc-700 base, amber-500 top)
- Single label string beneath

---

## Visual Design

- Dark theme: zinc-950 background, zinc-900 cards, zinc-800 elevated, zinc-700 borders
- Accent: amber-500 (`#f59e0b`) for CTAs, progress, highlights, spinner top border
- Header: sticky, `bg-zinc-950/80 backdrop-blur-sm`, `border-b border-zinc-800`
- Content: `max-w-3xl`, `space-y-8`, `px-6 py-12`
- Card pattern: `rounded-xl border border-zinc-700 bg-zinc-900 p-6`
- Buttons: `rounded-xl bg-amber-500 py-3 text-sm font-semibold text-zinc-950` with `hover:bg-amber-400 active:scale-[0.99]`
- Typography: Geist Sans (body) and Geist Mono (code) from `next/font/google`
- Animations: `animate-fade-in` (`fadeIn` keyframe: `opacity: 0, translateY(8px) → opacity: 1, translateY(0)`, 0.35s ease-out)
- The CSS also imports `tw-animate-css` and the full shadcn CSS variable system (light + dark modes defined using oklch colors)

---

## Environment Variables

```bash
# .env.local (gitignored — never commit)
ANALYSIS_PROVIDER=mock          # 'mock' or 'gemini'
MUSIC_PROVIDER=elevenlabs       # 'mock' or 'elevenlabs'
ELEVENLABS_API_KEY=your_key
GEMINI_API_KEY=your_key         # required only when ANALYSIS_PROVIDER=gemini
```

```bash
# .env.example (committed — no real keys)
ANALYSIS_PROVIDER=mock
MUSIC_PROVIDER=mock
ELEVENLABS_API_KEY=
GEMINI_API_KEY=
```

Both factory functions default to `'mock'` if env vars are absent. No API keys required for full local mock workflow.

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

## MVP Constraints (Not Built)

- No user authentication
- No database or persistence
- No payments
- No stem editing or DAW features
- No multi-segment audio stitching (single ElevenLabs call, max 22s)
- No real-time streaming audio
- No multi-page routing
- No localStorage / sessionStorage

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
10. Download the MP3 via direct anchor download

Additionally:
- `npm run build` succeeds with zero TypeScript errors
- `npm run lint` passes with zero ESLint errors
- Different videos produce different analysis results and prompts (via seeded PRNG)
- ElevenLabs integration works when `MUSIC_PROVIDER=elevenlabs` and key is set
- Gemini integration works when `ANALYSIS_PROVIDER=gemini` and key is set
