# CLAUDE.md — BananaMOV

This file is the persistent technical memory for Claude Code working on this project. Read it fully at the start of every session before writing any code. It is the authoritative source of truth for architecture decisions, coding conventions, and implementation rules. SPEC.md is the product specification; this file is the engineering implementation guide.

---

## Project Identity

**Name:** BananaMOV
**Purpose:** AI-powered video scoring platform — upload a video, analyze its visual arc across the timeline, generate a matching music score via ElevenLabs.
**Context:** Built for JamHacks 2026. ElevenLabs is a track prize sponsor — ElevenLabs Sound Generation is the required production music API.
**Status:** MVP. Full workflow is mocked by default; ElevenLabs is enabled via env var.

---

## Repository Layout

```
jamhacks2026/
├── CLAUDE.md                          ← you are here
├── SPEC.md                            ← product specification
├── .env.local                         ← secrets (gitignored)
├── .env.example                       ← template (committed)
├── app/
│   ├── layout.tsx                     ← root layout, Providers wrapper, fonts
│   ├── page.tsx                       ← ONLY page — entire workflow lives here
│   ├── providers.tsx                  ← 'use client' QueryClientProvider wrapper
│   ├── globals.css                    ← Tailwind import + CSS vars + keyframes
│   └── api/
│       ├── upload/route.ts            ← POST /api/upload
│       ├── analyze/route.ts           ← POST /api/analyze
│       └── generate/route.ts          ← POST /api/generate
├── components/
│   ├── upload/
│   │   ├── DropZone.tsx
│   │   └── VideoPreview.tsx
│   ├── analysis/
│   │   ├── AnalysisCard.tsx           ← overall profile card
│   │   └── TimelineBar.tsx            ← horizontal colored segment timeline
│   ├── player/
│   │   ├── AudioPlayer.tsx            ← custom HTML Audio API player
│   │   └── DownloadButton.tsx
│   └── ui/                            ← shadcn/ui generated (never edit manually)
├── hooks/
│   └── useWorkflow.ts                 ← state machine + all TanStack Query mutations
├── lib/
│   ├── providers/
│   │   ├── types.ts                   ← VideoAnalysisProvider + MusicGenerationProvider interfaces
│   │   ├── factory.ts                 ← getAnalysisProvider(), getMusicProvider()
│   │   ├── analysis/
│   │   │   └── MockAnalyzer.ts
│   │   └── music/
│   │       ├── MockMusicProvider.ts   ← lamejs PCM synthesis → real MP3
│   │       └── ElevenLabsProvider.ts  ← ElevenLabs Sound Generation API
│   ├── audio/
│   │   └── generateTone.ts            ← PCM synthesis + lamejs MP3 encoding (mock only)
│   └── utils.ts                       ← cn, formatDuration, formatFileSize, seededRandom, hashString, generateId
├── types/
│   └── index.ts                       ← ALL shared TypeScript types
└── public/
    ├── uploads/                        ← uploaded videos (runtime, gitignored)
    └── generated/                      ← generated MP3s (runtime, gitignored)
```

**Rule:** Never create files outside this structure without a strong reason. Never add top-level directories.

---

## Tech Stack — Precise Rules

### Next.js 15 (App Router)
- App Router exclusively. No Pages Router patterns ever.
- API routes: `app/api/*/route.ts`, export named HTTP method handlers (`POST`, `GET`, etc.).
- Server Components are the default. Add `'use client'` only when the component uses browser APIs, event handlers, `useState`, or `useEffect`.
- Never use `getServerSideProps`, `getStaticProps`, or `pages/`. Those are Pages Router.
- Route handlers return `NextResponse.json(data)` for success and `NextResponse.json({ error }, { status: N })` for errors.

### TypeScript — Strict Mode
- `strict: true` is required. No `any` unless unavoidable; use `unknown` + type guards instead.
- All types shared across files live in `types/index.ts`. Never redeclare inline.
- Prefer `interface` for object shapes, `type` for unions and primitives.
- Handle `null` and `undefined` explicitly. Use `?.` and `??` liberally. No `!` non-null assertions unless provably safe.

### Tailwind CSS
- Use utility classes directly. `cn()` from `lib/utils.ts` for conditional merging (combines `clsx` + `tailwind-merge`).
- Do not write custom CSS unless it cannot be expressed in Tailwind utilities (keyframe animations are the exception).

### shadcn/ui
- Components live in `components/ui/`. Do not edit them manually.
- Import from `@/components/ui/<component>`.
- Use shadcn primitives (Button, Badge, Card, Separator, etc.) as the foundation.

### TanStack Query v5
- `QueryClientProvider` lives in `app/providers.tsx` (a `'use client'` wrapper component).
- Use `useMutation` for all three workflow steps — not `useQuery`. These are user-triggered actions, not passive fetches.
- All mutations live inside `hooks/useWorkflow.ts`. Components never call `fetch` directly.

### lamejs (Mock MP3 encoding)
- CommonJS module. Import with `require`:
  ```ts
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lamejs = require('lamejs') as { Mp3Encoder: new (...) => LameMp3Encoder };
  ```
- Define `LameMp3Encoder` interface locally in `generateTone.ts`.
- Chunk size must be **1152 samples** (lamejs internal requirement — multiple of 576).
- Only used in `generateTone.ts` and `MockMusicProvider.ts`. Never imported elsewhere.

### ElevenLabs SDK
- Install: `npm install elevenlabs`
- Import: `import { ElevenLabsClient } from 'elevenlabs'`
- Used only in `ElevenLabsProvider.ts`. Never imported in routes or components directly.
- The client is instantiated with `new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })`.

---

## State Machine — The Heart of the Application

Single `WorkflowState` object managed in `hooks/useWorkflow.ts`. No other source of truth.

### Valid Step Transitions
```
idle        → uploading   (user selects a file)
uploading   → uploaded    (POST /api/upload succeeds)
uploaded    → analyzing   (user clicks "Analyze Video")
analyzing   → analyzed    (POST /api/analyze succeeds)
analyzed    → generating  (user clicks "Generate Score")
generating  → completed   (POST /api/generate succeeds)
any step    → idle        (handleReset() or fatal error the user clears)
```

### Error Behavior
- Errors do NOT advance the step.
- On mutation error: set `state.error`, keep current `state.step`.
- "Try again" clears `state.error` without regressing the step (user can retry the same action).
- `handleReset()` wipes everything back to the idle default.

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
- Reads `process.env.ANALYSIS_PROVIDER` (default: `'mock'`)
- Reads `process.env.MUSIC_PROVIDER` (default: `'mock'`)
- This is the ONLY place that imports concrete providers.
- API routes call the factory, never import `MockAnalyzer` or `ElevenLabsProvider` directly.

### Adding a New Provider Later
1. Create the file (e.g. `lib/providers/music/SunoProvider.ts`) implementing the interface
2. Add a case to the factory switch
3. Set `MUSIC_PROVIDER=suno` in `.env.local`
4. Zero changes to routes, hooks, or components

---

## ElevenLabs Provider — Implementation Rules

**File:** `lib/providers/music/ElevenLabsProvider.ts`

### Prompt Construction
Build from `AnalysisResult.analysis`:
1. Open with style: `"{genre} music score, approximately {bpm} BPM"`
2. Narrate the timeline arc in order, one clause per segment:
   `"beginning with {segment.label}, building to {segment.label}, climaxing with {segment.label}"`
3. Add instrument color: `"featuring {instrumentSuggestions.join(', ')}"`
4. Close with overall emotional intent based on dominant mood

**Example output:**
> "Cinematic orchestral score, approximately 95 BPM. Begins quietly with piano and soft strings, calm and contemplative. Tension builds with low brass entering. Climaxes with full orchestra — dramatic and intense. Resolves softly. Features strings, piano, and low brass. Emotional and cinematic."

### API Call
```ts
const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

const audioStream = await client.textToSoundEffects.convert({
  text: prompt,
  duration_seconds: Math.min(videoDurationSeconds ?? 20, 22), // cap at 22s (API limit)
  prompt_influence: 0.5,
});
```

### Response Handling
The ElevenLabs SDK returns an async iterable (stream). Collect into a Buffer, then write to disk:
```ts
const chunks: Buffer[] = [];
for await (const chunk of audioStream) {
  chunks.push(Buffer.from(chunk));
}
const buffer = Buffer.concat(chunks);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, buffer);
```

### Duration Cap (Option A)
- `duration_seconds = Math.min(videoDurationEstimate ?? 20, 22)`
- If the video duration is unknown, default to 20 seconds
- The audio player plays whatever duration was returned — no additional handling needed

---

## Mock Provider — Implementation Rules

### MockAnalyzer (`lib/providers/analysis/MockAnalyzer.ts`)

**Seeded PRNG:** Use `seededRandom(hashString(videoPath + sizeBytes))` from `lib/utils.ts`. Same video → same result. Different video → different result.

**Timeline generation:**
- Generate 3–5 segments that span the estimated video duration (default: 30 seconds if unknown)
- Segments must be time-ordered and non-overlapping
- The arc follows a narrative shape: calm/low opening → building middle → peak → softer resolution
- Each segment gets: `startSeconds`, `endSeconds`, `mood`, `energyLevel`, `label` (built from mood + energy)

**Overall profile:**
- `mood`: the mood of the peak/dominant segment
- `energyLevel`: weighted average leaning toward the peak segment
- `bpm`: integer in `[60, 160]`, weighted by energy (low→60-90, medium→90-120, high→120-160)
- `genre`: pick from `['cinematic', 'electronic', 'acoustic', 'orchestral', 'ambient', 'jazz']`
- `sceneCount`: integer in `[3, 40]`
- `motionScore`: float `[0.0, 1.0]` rounded to 2 decimal places
- `instrumentSuggestions`: 2–4 from a pool of ~15
- `analysisSummary`: template sentence using the generated values (not hardcoded)

**Delay:** `await delay(2000 + rand() * 1000)` (2–3 seconds)

### MockMusicProvider (`lib/providers/music/MockMusicProvider.ts`)

Uses `lib/audio/generateTone.ts` to generate a real playable MP3.

**Must:**
- Call the same `buildPrompt(analysis)` function that `ElevenLabsProvider` uses — so both providers return a `prompt` field and it's identical logic
- Generate 15–22 seconds of audio with actual non-silence content
- Match mood/energy in a basic audible way (frequency → mood, tempo → BPM, amplitude → energy)

**Delay:** `await delay(3000 + Math.random() * 2000)` (3–5 seconds)

---

## Shared Prompt Builder

The prompt construction logic lives in **`lib/providers/music/buildPrompt.ts`** as a pure exported function:

```ts
export function buildPrompt(analysis: AnalysisResult): string
```

Both `MockMusicProvider` and `ElevenLabsProvider` import and call this. This ensures the mock and production providers return identical prompt strings, which is used in the UI to show what was sent.

---

## Audio Generation (generateTone.ts) — Implementation Details

**File:** `lib/audio/generateTone.ts`

**Signature:**
```ts
export function generateMp3(analysis: VideoAnalysis, outputPath: string): number
// returns durationSeconds
```

**PCM synthesis approach:**
1. `sampleRate = 44100`, `channels = 1`, `bitrate = 128`
2. `duration = { low: 15, medium: 18, high: 22 }[energyLevel]`
3. `rootFreq` from mood map (C4=261.63 for calm, G4=392 for energetic, A3=220 for dramatic, etc.)
4. Chord progression: I → IV → V → I (frequency ratios, 4 bars each)
5. Each sample: sum 3 chord frequencies via `Math.sin(2π × freq × t)`, divide by chord count
6. Envelope per bar: linear attack (2%), sustain, linear release (15% before bar end)
7. Amplitude: `{ low: 0.25, medium: 0.45, high: 0.65 }[energyLevel]`
8. Convert float `[-1, 1]` → `Int16Array` (× 32767, clamped)
9. Encode with lamejs in 1152-sample chunks (the 1152 is a lamejs requirement)
10. Flush encoder, concatenate `Int8Array` chunks → `Buffer`
11. `fs.mkdirSync(dir, { recursive: true })` then `fs.writeFileSync(path, buffer)`

---

## API Routes — Implementation Pattern

### General
```ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // validate...
    const result = await someOperation(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/route]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### POST `/api/upload`
- Read `request.formData()`, get field `'video'`
- Validate MIME type: `['video/mp4', 'video/quicktime', 'video/webm']`
- Validate size: `≤ 100 * 1024 * 1024`
- Path: `path.join(process.cwd(), 'public', 'uploads', `${generateId()}.${ext}`)`
- `fs.mkdirSync(dir, { recursive: true })`
- Write with `fs.writeFileSync(fullPath, Buffer.from(await file.arrayBuffer()))`
- Return: `{ videoPath: string, filename: string, sizeBytes: number }`
- `videoPath` is the filesystem path string passed to the analyzer

### POST `/api/analyze`
- Validate: `videoPath`, `filename`, `sizeBytes` all present
- Call `getAnalysisProvider().analyze(videoPath, { filename, sizeBytes })`
- Return the `AnalysisResult` directly

### POST `/api/generate`
- Validate: `analysis` object is present with required fields
- Call `getMusicProvider().generate(analysisResult)`
- Return `GeneratedScore` directly

---

## Component Rules

### DropZone
- `'use client'`
- Validates file BEFORE calling `onFileSelected` — no API call on invalid input
- `accept="video/mp4,video/quicktime,video/webm"` on hidden `<input type="file">`
- Drag-over visual: `border-amber-500 bg-amber-500/5` (normally `border-zinc-700`)
- Shows inline validation error text below the zone

### VideoPreview
- Native `<video>` element with `controls` — no autoplay
- Shows filename (truncated if >30 chars) and formatted file size
- "Remove" button → `handleReset()`

### AnalysisCard
- BPM is the hero number (large + prominent)
- Badges for mood (violet), energyLevel (green/yellow/red by level), pace (blue)
- Instrument tags as a wrapping chip list
- `analysisSummary` as italic muted text
- `motionScore` as a labeled progress bar (0–100%)
- `<TimelineBar segments={analysis.timeline} />` rendered at the bottom of the card

### TimelineBar
- Horizontal flex container, full width
- Each segment is a `<div>` with proportional `flex` width (relative to total duration)
- Color by energy: `bg-green-500` (low), `bg-yellow-500` (medium), `bg-red-500` (high)
- Rounded ends on first and last segment
- Tooltip on hover: segment label (use `title` attribute for simplicity)
- Text label centered inside each segment if wide enough (>80px estimated)

### AudioPlayer
- `'use client'`
- `useRef<HTMLAudioElement>` — no library
- Local state: `isPlaying`, `currentTime`, `duration`, `isLoaded`
- `useEffect` attaches: `timeupdate`, `loadedmetadata`, `ended` event listeners; cleans up on unmount
- Seek bar: `<input type="range">` with inline `background` style for amber fill:
  ```
  background: `linear-gradient(to right, #f59e0b ${pct}%, #3f3f46 ${pct}%)`
  ```
- Play/pause: inline SVG icons that swap
- Time display: `{formatDuration(currentTime)} / {formatDuration(duration)}`
- `formatDuration` imported from `lib/utils.ts` — formats as `m:ss`

### DownloadButton
- `<a href={score.audioUrl} download={score.filename}>` wrapped with shadcn `<Button asChild>`
- No JavaScript fetch or Blob approach — direct anchor download only
- Shows the filename so the user knows what they're getting

---

## Page Layout (`app/page.tsx`)

Sections are revealed progressively as `state.step` advances. Use a vertical `space-y-8` stack. Wrap each section in a `key`-ed fragment or `AnimatedSection` that applies a `animate-fade-in` class when it appears.

Section visibility rules:
- `DropZone`: visible when `step === 'idle' || step === 'uploading'`
- `VideoPreview`: visible when `step !== 'idle' && step !== 'uploading'`
- "Analyze Video" button: visible when `step === 'uploaded'`
- Analysis loading: visible when `step === 'analyzing'`
- `AnalysisCard`: visible when `step` is one of `['analyzed', 'generating', 'completed']`
- "Generate Score" button: visible when `step === 'analyzed'`
- Generation loading: visible when `step === 'generating'`
- `AudioPlayer` + `DownloadButton`: visible when `step === 'completed'`
- Error banner: visible when `state.error !== null`

---

## Visual Design System

### Color Palette (use Tailwind classes directly — these are all standard zinc/amber)
| Role | Class |
|---|---|
| Page background | `bg-zinc-950` |
| Card surface | `bg-zinc-900` |
| Elevated / hover | `bg-zinc-800` |
| Borders | `border-zinc-700` |
| Primary accent | `text-amber-500`, `bg-amber-500` |
| Accent hover | `hover:bg-amber-600` |
| Primary text | `text-zinc-50` |
| Secondary text | `text-zinc-400` |
| Muted text | `text-zinc-500` |
| Error | `text-red-400`, `bg-red-950` |
| Success | `text-green-400` |

### Animation
Add to `globals.css`:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.35s ease-out both;
}
```

### Card Pattern
```tsx
<div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
  ...
</div>
```

### Loading States
- Analyzing: spinner + "Analyzing your video..." + 3 animated progress dots
- Generating: different icon + "Composing your score with ElevenLabs..." + waveform bars (pure CSS)
- Never a blank area during loading

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

Required exports:
```ts
export function cn(...inputs: ClassValue[]): string          // clsx + twMerge
export function formatDuration(seconds: number): string     // 75 → "1:15"
export function formatFileSize(bytes: number): string       // 5242880 → "5.0 MB"
export function seededRandom(seed: number): () => number    // mulberry32 PRNG
export function hashString(str: string): number             // djb2 string hash
export function generateId(): string                        // crypto.randomUUID()
export function delay(ms: number): Promise<void>            // setTimeout wrapper
```

### seededRandom (mulberry32 algorithm — name it in a comment)
```ts
export function seededRandom(seed: number): () => number {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### hashString (djb2 — name it in a comment)
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

### .env.local (gitignored, never committed)
```
ANALYSIS_PROVIDER=mock
MUSIC_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_key_here
```

### .env.example (committed — no real keys)
```
ANALYSIS_PROVIDER=mock
MUSIC_PROVIDER=mock
ELEVENLABS_API_KEY=
```

### Factory defaults
If env vars are absent, both factories default to `'mock'`. No API key needed for local dev with mock providers.

---

## File System Conventions

- Always use `path.join(process.cwd(), 'public', ...)` for absolute paths server-side
- Always call `fs.mkdirSync(dir, { recursive: true })` before writing — never assume the dir exists
- Client-side `audioUrl` returned to browser: relative path `/generated/{uuid}.mp3` (Next.js serves `public/` at root)
- `videoObjectUrl` for preview: `URL.createObjectURL(file)` — created in `useWorkflow` when file is selected

---

## .gitignore Additions Required

```
public/uploads/
public/generated/
.env.local
```

---

## Error Handling Rules

### API Routes
- Validate all input first, return 400 with a descriptive message on invalid input
- Catch all async errors, log with `console.error('[/api/route-name]', error)`, return 500
- Never expose stack traces or internal error details to the client

### Client (useWorkflow)
```ts
onError: (error: Error) => {
  setState(prev => ({ ...prev, error: error.message || 'Something went wrong. Please try again.' }));
}
```
- Show error banner when `state.error !== null`
- "Try again" button: clear `state.error` (user can retry the failed step without resetting)
- "Start over" button: call `handleReset()` (resets to idle)

---

## What NOT to Build (Hard Boundaries)

| Forbidden | Why |
|---|---|
| User auth / Clerk | Out of scope MVP |
| Database / ORM | No persistence needed |
| Payments | Out of scope |
| `pages/` directory | App Router only |
| localStorage / sessionStorage | State is React-only |
| External audio player libraries | Build the custom player |
| Multi-segment audio stitching | Future feature (Option B) |
| Real-time generation streaming | Future feature |
| Stem editing / DAW | Future feature |
| Direct imports of concrete providers in routes | Always use factory |

---

## Implementation Checklist

When building this project for the first time, complete in this order:

### Phase 1 — Foundation
- [ ] Scaffold Next.js 15 project (`--typescript --tailwind --eslint --app --no-src-dir`)
- [ ] Install dependencies: `@tanstack/react-query`, `elevenlabs`, `lamejs`, `clsx`, `tailwind-merge`
- [ ] Initialize shadcn/ui and add: `button`, `badge`, `card`, `separator`
- [ ] Configure `.gitignore` (add `public/uploads/`, `public/generated/`, `.env.local`)
- [ ] Create `.env.local` and `.env.example`

### Phase 2 — Types and Utilities
- [ ] `types/index.ts` — all shared types
- [ ] `lib/utils.ts` — cn, formatDuration, formatFileSize, seededRandom, hashString, generateId, delay

### Phase 3 — Provider Layer
- [ ] `lib/providers/types.ts` — VideoAnalysisProvider, MusicGenerationProvider interfaces
- [ ] `lib/providers/factory.ts` — getAnalysisProvider(), getMusicProvider()
- [ ] `lib/providers/analysis/MockAnalyzer.ts` — seeded random timeline + analysis
- [ ] `lib/audio/generateTone.ts` — PCM synthesis + lamejs MP3 encoding
- [ ] `lib/providers/music/buildPrompt.ts` — shared prompt construction function
- [ ] `lib/providers/music/MockMusicProvider.ts` — uses generateTone + buildPrompt
- [ ] `lib/providers/music/ElevenLabsProvider.ts` — ElevenLabs SDK + buildPrompt

### Phase 4 — API Routes
- [ ] `app/api/upload/route.ts`
- [ ] `app/api/analyze/route.ts`
- [ ] `app/api/generate/route.ts`

### Phase 5 — Workflow Hook
- [ ] `hooks/useWorkflow.ts` — state machine + 3 TanStack Query mutations

### Phase 6 — Components
- [ ] `components/upload/DropZone.tsx`
- [ ] `components/upload/VideoPreview.tsx`
- [ ] `components/analysis/TimelineBar.tsx`
- [ ] `components/analysis/AnalysisCard.tsx`
- [ ] `components/player/AudioPlayer.tsx`
- [ ] `components/player/DownloadButton.tsx`

### Phase 7 — App Shell
- [ ] `app/providers.tsx` — QueryClientProvider wrapper
- [ ] `app/globals.css` — Tailwind import, CSS vars, fade-in keyframe
- [ ] `app/layout.tsx` — root layout with Providers, font, metadata
- [ ] `app/page.tsx` — full single-page workflow

### Phase 8 — Validation
- [ ] `npm run build` passes with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] End-to-end flow works: upload → analyze → generate → play → download
- [ ] Different videos produce different analysis results and prompts
- [ ] ElevenLabs integration works when `MUSIC_PROVIDER=elevenlabs` and key is set

---

## Session Startup Checklist

Every new Claude Code session on this project:
1. Read this file completely
2. Read `SPEC.md` for product requirements
3. Run `git status` to understand current state
4. Run `npm run build` to check for existing errors before making changes
5. Identify which checklist phase is complete and what is next
6. Do not refactor working code — fix what is broken, build what is missing
