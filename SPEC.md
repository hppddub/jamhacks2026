# SPEC.md — BananaMOV

> AI-powered video scoring platform. Built for JamHacks 2026.
> ElevenLabs is a track prize sponsor — ElevenLabs Sound Generation is the required music generation API.

---

## Overview

BananaMOV accepts a user-uploaded video, analyzes its visual characteristics across the video's timeline, and generates a matching music score via the ElevenLabs Sound Generation API. The MVP validates the full core workflow end-to-end: **Upload → Analyze → Generate → Preview → Download**.

The video analysis produces a time-segmented arc (how mood and energy evolve throughout the video), which is collapsed into a single rich text prompt sent to ElevenLabs. The returned audio is served for preview and download.

All AI integrations are mocked in the MVP but must sit behind swappable provider interfaces so real models can be substituted without architectural changes.

---

## User Flow (Single-Page)

The entire workflow lives on one page (`/`). No routing between steps. No localStorage or sessionStorage. All state is managed in React component state on the root page.

### Step progression

```
idle → uploading → uploaded → analyzing → analyzed → generating → completed
```

Each step renders a distinct UI section below the previous. The page does not navigate — it reveals new sections as state advances.

| Step | UI shown |
|---|---|
| `idle` | Upload dropzone with CTA |
| `uploading` | Upload progress indicator |
| `uploaded` | Video preview + "Analyze Video" button |
| `analyzing` | Analysis loading state |
| `analyzed` | Analysis results card (timeline arc + overall profile) + "Generate Score" button |
| `generating` | Generation loading state |
| `completed` | Audio player + analysis summary + download button |

On error at any step, show inline error with a "Try again" reset to the previous stable step.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| Data fetching | TanStack Query v5 |
| Music generation | ElevenLabs Sound Generation API |
| File storage | Local filesystem (`public/uploads`, `public/generated`) |
| Database | None for MVP |
| Auth | None for MVP |

---

## Folder Structure

```
/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      # Single-page workflow
│   ├── providers.tsx                 # TanStack QueryClientProvider wrapper
│   ├── globals.css
│   └── api/
│       ├── upload/route.ts           # POST — receives video, saves to disk
│       ├── analyze/route.ts          # POST — returns VideoAnalysis + TimelineSegment[]
│       └── generate/route.ts         # POST — calls ElevenLabs, returns GeneratedScore
├── components/
│   ├── upload/
│   │   ├── DropZone.tsx
│   │   └── VideoPreview.tsx
│   ├── analysis/
│   │   ├── AnalysisCard.tsx          # Overall profile summary
│   │   └── TimelineBar.tsx           # Visual timeline of mood segments
│   ├── player/
│   │   ├── AudioPlayer.tsx           # Custom player (play/pause/seek/time)
│   │   └── DownloadButton.tsx
│   └── ui/                           # shadcn generated components (do not edit)
├── lib/
│   ├── providers/
│   │   ├── types.ts                  # VideoAnalysisProvider, MusicGenerationProvider interfaces
│   │   ├── factory.ts                # getAnalysisProvider(), getMusicProvider()
│   │   ├── analysis/
│   │   │   └── MockAnalyzer.ts
│   │   └── music/
│   │       ├── MockMusicProvider.ts  # Generates real MP3 via lamejs PCM synthesis
│   │       └── ElevenLabsProvider.ts # Calls ElevenLabs Sound Generation API
│   ├── audio/
│   │   └── generateTone.ts           # PCM synthesis + lamejs MP3 encoding (mock only)
│   └── utils.ts
├── hooks/
│   └── useWorkflow.ts                # Central state machine + TanStack Query mutations
├── types/
│   └── index.ts                      # All shared TypeScript types
└── public/
    ├── uploads/                      # Uploaded videos (runtime, gitignored)
    └── generated/                    # Generated MP3s (runtime, gitignored)
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

The active provider is selected by env var in a factory (`lib/providers/factory.ts`):
- `ANALYSIS_PROVIDER=mock` (default)
- `MUSIC_PROVIDER=mock` | `elevenlabs`

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
  durationSeconds?: number;
}

// A single time segment in the video's analyzed arc
export interface TimelineSegment {
  startSeconds: number;       // start of segment
  endSeconds: number;         // end of segment
  mood: Mood;
  energyLevel: EnergyLevel;
  label: string;              // human-readable, e.g. "Opening — calm, low energy"
}

export interface VideoAnalysis {
  mood: Mood;                  // dominant mood overall
  energyLevel: EnergyLevel;   // dominant energy overall
  pace: Pace;
  bpm: number;                 // integer, 60–160
  genre: string;               // e.g. "cinematic", "electronic", "ambient"
  sceneCount: number;          // estimated scene cuts
  motionScore: number;         // 0.0–1.0
  instrumentSuggestions: string[];
  analysisSummary: string;     // 1–2 sentence human-readable summary
  timeline: TimelineSegment[]; // time-ordered arc of the video
}

// Full result returned by the analysis provider
export interface AnalysisResult {
  videoPath: string;
  metadata: VideoMetadata;
  analysis: VideoAnalysis;
}

export interface GeneratedScore {
  audioUrl: string;            // relative path, e.g. /generated/uuid.mp3
  durationSeconds: number;
  bpm: number;
  genre: string;
  mood: Mood;
  filename: string;            // e.g. "score-dramatic-95bpm.mp3"
  prompt: string;              // the ElevenLabs prompt that was used
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
```

---

## API Routes

### POST `/api/upload`

- Accepts: `multipart/form-data` with `video` field
- Validates: MP4/MOV/WEBM only, max 100 MB
- Saves to: `public/uploads/{uuid}.{ext}`
- Returns: `{ videoPath: string, filename: string, sizeBytes: number }`

### POST `/api/analyze`

- Accepts: `{ videoPath: string, filename: string, sizeBytes: number }`
- Calls: `getAnalysisProvider().analyze(...)`
- Returns: `AnalysisResult`

### POST `/api/generate`

- Accepts: `AnalysisResult`
- Calls: `getMusicProvider().generate(...)`
- Returns: `GeneratedScore`
- The `audioUrl` must be a real, playable, downloadable MP3 served from `public/`

---

## Video Analysis — Timeline Arc

The analyzer divides the video's estimated duration into 3–5 segments, assigning each segment its own mood and energy level. This creates a narrative arc:

**Example arc for a 30-second dramatic video:**
```
[0s–8s]   calm, low        "Opening — quiet and contemplative"
[8s–18s]  suspenseful, med  "Build — tension rising"
[18s–26s] dramatic, high    "Peak — full intensity"
[26s–30s] emotional, low    "Resolution — soft landing"
```

The mock analyzer seeds this arc deterministically from `videoPath + sizeBytes` so the same video always returns the same result, but different videos return different arcs.

---

## ElevenLabs Integration

### API

- Endpoint: `POST https://api.elevenlabs.io/v1/sound-generation`
- Auth header: `xi-api-key: {ELEVENLABS_API_KEY}`
- Request body (JSON):
  ```json
  {
    "text": "<rich music description prompt>",
    "duration_seconds": <target duration, max ~22>,
    "prompt_influence": 0.5
  }
  ```
- Response: binary audio stream (MP3)

### Prompt Construction

The `ElevenLabsProvider` builds its prompt from the `AnalysisResult` by:

1. Describing the overall style: genre, BPM, dominant mood, instrument suggestions
2. Narrating the timeline arc in order: *"beginning with [segment 1 description], transitioning to [segment 2 description], building to [segment 3 description]"*
3. Closing with emotional intent: overall feeling to leave the listener with

**Example prompt:**
> "Cinematic orchestral score, approximately 95 BPM. Begins with a quiet piano melody, calm and contemplative. Builds gradually with strings and low brass adding tension. Climaxes with full orchestra — dramatic and intense. Resolves softly with strings fading out. Emotional, cinematic, suitable for a short film."

### Duration Handling (Option A — MVP)

ElevenLabs Sound Generation supports up to approximately 22 seconds per request. For the MVP:
- Cap `duration_seconds` at `Math.min(videoDuration, 22)` when calling the API
- The audio player plays whatever duration was returned
- The UI notes the duration of the generated score

This is intentional for MVP simplicity. Multi-segment stitching is a future feature.

### Response Handling

The ElevenLabs API returns a binary audio stream directly (not a URL). The provider must:
1. Collect the response body as a Buffer
2. Write it to `public/generated/{uuid}.mp3`
3. Return `GeneratedScore` with `audioUrl: /generated/{uuid}.mp3`

---

## Mock Providers

### MockAnalyzer

- Seeded PRNG from `hashString(videoPath + sizeBytes)` — same video = same result
- Generates a full `VideoAnalysis` including a `timeline` of 3–5 segments
- Each segment has randomized but contextually coherent mood + energy
- The arc follows a basic narrative shape: start → build → peak → resolve
- Simulates 2–3 second processing delay

### MockMusicProvider

- Generates a real playable MP3 using `lamejs` PCM synthesis (sine wave chords)
- Audio matches mood/BPM in a basic way (frequency, tempo, amplitude)
- Duration: 15–22 seconds
- Saves to `public/generated/{uuid}.mp3`
- Also constructs and returns the `prompt` field (same prompt logic as ElevenLabs)
- Simulates 3–5 second generation delay

---

## Components

### DropZone
- Drag-and-drop + click-to-browse
- Client-side validation: type (MP4/MOV/WEBM) and size (≤100 MB)
- Shows inline validation errors before any API call
- Triggers upload on file selection

### VideoPreview
- Native `<video>` element, no autoplay
- Shows filename + file size
- "Remove" button calls `handleReset()`

### AnalysisCard
- Shows overall profile: mood badge, energy badge, pace badge, BPM (hero number)
- Instrument suggestions as tags
- `analysisSummary` as italic text
- Includes `TimelineBar` component below

### TimelineBar
- Horizontal bar divided into segments
- Each segment colored by energy level (green=low, yellow=medium, red=high)
- Hover tooltip shows segment label
- Proportional widths based on segment duration

### AudioPlayer
- Custom-built with HTML `Audio` API via `useRef<HTMLAudioElement>`
- No third-party player library
- Play/pause toggle, seek bar with progress fill, current/total time display
- Seek bar uses `<input type="range">` with amber progress fill via inline `background` style

### DownloadButton
- `<a href={score.audioUrl} download={score.filename}>` wrapped in shadcn Button (`asChild`)
- Direct download — no server redirect

---

## Workflow Hook (`hooks/useWorkflow.ts`)

Central state machine. Exports:

```ts
{
  state: WorkflowState;
  handleFileSelected: (file: File) => Promise<void>;
  handleAnalyze: () => Promise<void>;
  handleGenerate: () => Promise<void>;
  handleReset: () => void;
}
```

Three TanStack Query `useMutation` instances — one per API step. Each updates `state.step` on success or sets `state.error` on failure without advancing the step.

---

## Visual Design

- Dark theme: zinc-950 background, zinc-900 cards, zinc-700 borders
- Accent: amber-500 (`#f59e0b`) for CTAs, progress fills, highlights
- Typography: clear size hierarchy, generous whitespace
- Responsive: 375px mobile → 1280px desktop, `max-w-3xl` content container
- Loading states: animated spinners + descriptive text (no blank screens)
- Transitions: fade-in + slight upward translate when new sections appear
- All interactive elements: hover + active states

---

## Environment Variables

```
# .env.local
ANALYSIS_PROVIDER=mock
MUSIC_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_key_here
```

---

## Error Handling

- Wrong file type: inline error under dropzone (no API call)
- File too large: inline error under dropzone (no API call)
- API error (any step): inline error banner + "Try again" (resets to previous stable step)
- ElevenLabs API error (rate limit, invalid key, etc.): surface as API error with clear message

---

## MVP Constraints (Do Not Build)

- No user authentication
- No database
- No payments
- No stem editing or DAW features
- No multi-segment audio stitching (future)
- No real-time streaming audio
- No multi-page routing
- No localStorage / sessionStorage

---

## MVP Definition of Done

A user can:

1. Visit the site at `localhost:3000`
2. Upload a video via drag-and-drop or file picker
3. See a video preview
4. Click "Analyze Video" and receive a timeline arc + overall analysis
5. See the timeline visualized as a colored segment bar
6. Click "Generate Score" and receive a real, playable MP3 (ElevenLabs or mock)
7. Play and pause the audio in the custom player with seek support
8. Download the MP3 with actual audio content

Additionally:
- `npm run build` succeeds with zero TypeScript errors
- `npm run lint` passes with zero ESLint errors
- Different videos produce different analysis results and prompts
