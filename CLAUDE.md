# CLAUDE.md — BananaMOV

This file is the persistent technical memory for Claude Code working on this project. Read it fully at the start of every session before writing any code. It is the authoritative source of truth for architecture decisions, coding conventions, and implementation rules. SPEC.md is the product specification; this file is the engineering implementation guide.

---

## Project Identity

**Name:** BananaMOV
**Purpose:** AI-powered video scoring platform — upload a video, analyze its visual and audio arc across the timeline, generate a matching music score via ElevenLabs.
**Context:** Built for JamHacks 2026. ElevenLabs is a track prize sponsor — ElevenLabs Sound Generation is the required production music API.
**Status:** MVP complete. All phases implemented and building.
- **Analysis is always real Gemini.** `getAnalysisProvider()` is hardcoded to return `new GeminiAnalyzer()`; it no longer reads `ANALYSIS_PROVIDER` and does not fall back to `MockAnalyzer`. A valid `GEMINI_API_KEY` is therefore **required** to run the analyze step. `MockAnalyzer` is still fully maintained but is currently **unreferenced by the factory** (kept for offline/dev use and as a reference implementation).
- **Music defaults to ElevenLabs Music** (`ElevenMusicProvider`, `MUSIC_PROVIDER` default `'elevenmusic'`) — the `/v1/music` composition-plan endpoint that renders layered, sectioned scores. `MockMusicProvider` (`mock`) and the sound-effects `ElevenLabsProvider` (`elevenlabs`) remain selectable. Requires the API key to have **Music Generation = Access**.
- **Branding/theme:** The UI was rebranded ("Big change" + "rebrand to BananaMOV" commits) to a **navy + cream + banana-yellow (`#ffcc18`)** palette with a **light/dark theme toggle** (defaults to dark). The older zinc/amber palette described in earlier revisions of this file is gone — see the Visual Design System section for the current tokens.

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
│   ├── page.tsx                           ← main workflow page (upload → analyze → generate → stems)
│   ├── providers.tsx                      ← 'use client' QueryClientProvider wrapper
│   ├── globals.css                        ← Tailwind v4 imports, CSS vars, fadeIn keyframe
│   ├── daw/
│   │   └── page.tsx                       ← /daw route — BananaMOV Studio (DAW page, 'use client')
│   └── api/
│       ├── upload/route.ts                ← POST /api/upload
│       ├── analyze/route.ts               ← POST /api/analyze
│       ├── generate/route.ts              ← POST /api/generate
│       └── stems/route.ts                 ← POST /api/stems (maxDuration=180)
├── components/
│   ├── ThemeToggle.tsx                    ← 'use client' light/dark toggle (localStorage)
│   ├── upload/
│   │   ├── DropZone.tsx
│   │   └── VideoPreview.tsx
│   ├── analysis/
│   │   ├── AnalysisCard.tsx               ← overall profile card
│   │   └── TimelineBar.tsx                ← horizontal colored segment timeline
│   ├── player/
│   │   ├── ScoreOutput.tsx                ← tabbed output panel (Generated Score | Video + Score) + original-audio toggle
│   │   ├── AudioPlayer.tsx                ← custom HTML Audio API player + waveform
│   │   ├── CombinedVideoPlayer.tsx        ← original video synced to generated score; live mute toggle for original audio
│   │   ├── DownloadButton.tsx
│   │   └── StemPlayer.tsx                 ← per-stem mini player grid
│   ├── daw/
│   │   ├── Transport.tsx                  ← play/pause/stop, BPM input, time display, zoom, mixer toggle
│   │   ├── TrackLibrary.tsx               ← left panel: grouped audio sources, draggable into arrangement
│   │   ├── PluginPalette.tsx             ← left panel "Plugins" section — adds effects (incl. Filter Envelope) to the selected insert
│   │   ├── Arrangement.tsx               ← scrollable timeline: bar/beat ruler+grid, sticky headers, snapping clips, insert routing, playhead
│   │   ├── Knob.tsx                       ← SVG rotary knob (drag/scroll) — used by the ADSR Filter Envelope plugin
│   │   ├── Mixer.tsx                      ← bottom-dock FL-style mixer: insert strips + selected insert's effect rack (knobs + ADSR curve for filter-adsr)
│   │   └── ExportPanel.tsx               ← collapsible export/import section (audio import, WAV mix, per-track MP3, save project JSON)
│   └── ui/                                ← shadcn/ui generated (never edit manually)
├── hooks/
│   ├── useWorkflow.ts                     ← state machine + all TanStack Query mutations
│   └── useDAW.ts                          ← DAW state: project, transport, Web Audio scheduling + mixer graph, export
├── lib/
│   ├── providers/
│   │   ├── types.ts                       ← VideoAnalysisProvider + MusicGenerationProvider interfaces
│   │   ├── factory.ts                     ← getAnalysisProvider(), getMusicProvider()
│   │   ├── analysis/
│   │   │   ├── MockAnalyzer.ts            ← seeded-random arc + analysis
│   │   │   └── GeminiAnalyzer.ts          ← Google Gemini 2.5 Flash video analysis
│   │   └── music/
│   │       ├── buildPrompt.ts             ← sound-effects prompt + tags construction
│   │       ├── buildCompositionPlan.ts    ← timeline → Eleven Music composition plan + styles
│   │       ├── MockMusicProvider.ts       ← lamejs PCM synthesis → real MP3
│   │       ├── ElevenLabsProvider.ts      ← ElevenLabs Sound Generation API (/v1/sound-generation)
│   │       └── ElevenMusicProvider.ts     ← ElevenLabs Music API (/v1/music, composition plan)
│   │       └── ElevenLabsProvider.ts      ← ElevenLabs Sound Generation API
│   │   └── stems/
│   │       ├── types.ts                   ← StemSeparationProvider interface
│   │       ├── factory.ts                 ← getStemProvider()
│   │       ├── MockStemProvider.ts        ← PCM-synthesised mock stems
│   │       ├── LocalDemucsProvider.ts     ← free: runs python -m demucs as subprocess
│   │       └── ReplicateProvider.ts       ← Replicate Demucs v4 stem separation (costs $)
│   ├── audio/
│   │   ├── generateTone.ts               ← PCM synthesis + lamejs MP3 encoding; generateStemMp3 for mock stems
│   │   ├── dawGraph.ts                   ← DAW Web Audio: effect builders (EQ/reverb/delay/compressor/distortion/filter-adsr), buildMixGraph(), effect param specs
│   │   ├── timeStretch.ts                ← pitch-preserving time-stretch (soundtouchjs) for BPM-as-tempo
│   │   ├── waveform.ts                   ← cached getPeaks(url): decode source once → peak array for in-clip waveforms
│   │   ├── ffmpegEnv.ts                  ← resolvedPath(): merges Windows HKCU PATH so winget ffmpeg is found (shared by Demucs + extractor)
│   │   └── extractOriginalAudio.ts       ← ffmpeg: transcode a video's original audio track to browser-playable MP3 (best-effort)
│   └── utils.ts                           ← cn, formatDuration, formatFileSize,
│                                          ←   seededRandom, hashString, generateId, delay
├── types/
│   ├── index.ts                           ← ALL shared TypeScript types (re-exports daw.ts)
│   └── daw.ts                             ← DAW-specific types (DAWLibraryItem, DAWClip, DAWTrack, DAWProject, DAWTransportState)
└── public/
    ├── banana-logo.svg                     ← header logo (committed)
    ├── uploads/                            ← uploaded videos (runtime, gitignored)
    └── generated/                          ← generated MP3s (runtime, gitignored)
```

(The default Next.js sample SVGs — `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — also remain in `public/` but are unused.)

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
- `globals.css` also imports `"tw-animate-css"` and `"shadcn/tailwind.css"`, and declares `@custom-variant dark (&:is(.dark *))`.
- **Custom design tokens.** `@theme inline` maps Tailwind color utilities (`navy-950..600`, `cream-50..500`) to CSS variables (`--navy-*`, `--cream-*`). Those variables are defined twice:
  - `:root` → **light mode** ("warm parchment" palette). Note the token names are semantic, not literal: in light mode the `navy-*` tokens hold parchment/cream hex values and the `cream-*` tokens hold dark navy/brown text values, so `bg-navy-950 text-cream-50` reads correctly in both themes.
  - `.dark` → **dark mode** (true navy surfaces, cream text).
  - The shadcn token set (`--background`, `--foreground`, `--primary`, etc.) is also redefined under both `:root` and `.dark`.
- **Dark mode is the default, but no longer hardcoded-only.** `layout.tsx` puts `dark` on `<html>` as the initial class; `components/ThemeToggle.tsx` adds/removes the `.dark` class at runtime and persists the choice in `localStorage` under key `theme`.
- The banana-yellow accent `#ffcc18` (and its hover `#ffd84d`) is applied as a **literal arbitrary value** in className strings (e.g. `bg-[#ffcc18]`), not as a token — it stays constant across light/dark.
- Use utility classes directly. `cn()` from `lib/utils.ts` for conditional merging (combines `clsx` + `tailwind-merge`).
- Do not write custom CSS unless it cannot be expressed in Tailwind utilities (keyframe animations are the exception; the `fadeIn` keyframe in `globals.css` is the only custom CSS).

### shadcn/ui
- Components live in `components/ui/`. Do not edit them manually.
- Import from `@/components/ui/<component>`.
- Current installed components: `button`, `badge`, `card`.
- `ThemeToggle.tsx` is a **hand-written** `'use client'` component (not generated by shadcn) living directly under `components/`.

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

### ElevenLabs (raw REST — no SDK)
- **`ElevenLabsProvider.ts` does NOT use the `elevenlabs` SDK.** It calls the Sound Generation REST endpoint directly with the global `fetch`:
  - Endpoint: `https://api.elevenlabs.io/v1/sound-generation`
  - Headers: `xi-api-key: <key>`, `Content-Type: application/json`, `Accept: audio/mpeg`
  - Reads the response with `Buffer.from(await response.arrayBuffer())`
- The `elevenlabs` and `@elevenlabs/elevenlabs-js` packages remain in `package.json` but are **no longer imported anywhere**.
- Constructor throws if `ELEVENLABS_API_KEY` is absent. Used only in `ElevenLabsProvider.ts` — never imported in routes or components directly.

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

### Client-side duration extraction

The upload mutation first calls `extractVideoDuration(file)` (a helper in `useWorkflow.ts`): it creates an off-DOM `<video>` element with `preload="metadata"`, reads `video.duration` on `loadedmetadata`, revokes the object URL, and resolves to the number (or `undefined` if unavailable/non-finite). The duration is appended to the upload `FormData` as `durationSeconds`. This is how the real video length reaches the server (and ultimately ElevenLabs) without any server-side video decoding. `uploadedMetadata.durationSeconds` is populated from the upload response and forwarded to both `analyze()` and `generate()`.

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
  originalAudioUrl: null,   // ffmpeg-extracted browser-playable original audio (or null)
  analysis: null,
  score: null,
  error: null,
  stemStep: 'idle',
  stems: null,
  stemError: null,
};
```

`originalAudioUrl` is set from the upload response (`data.originalAudioUrl ?? null`), persists through to the `completed` step, and is cleared by `reset()`/`removeFile()` (which reset to `defaultState`). It feeds the "Video + Score" tab's original-audio track.

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
export function getAnalysisProvider(): VideoAnalysisProvider {
  return new GeminiAnalyzer();           // hardcoded — env var NOT consulted
}
export function getMusicProvider(): MusicGenerationProvider {
  const provider = process.env.MUSIC_PROVIDER ?? 'elevenmusic';   // default = Music API
  if (provider === 'elevenmusic') return new ElevenMusicProvider();
  if (provider === 'elevenlabs') return new ElevenLabsProvider();
  if (provider === 'mock') return new MockMusicProvider();
  return new ElevenMusicProvider();
}
```
- **`getAnalysisProvider()` always returns `new GeminiAnalyzer()`.** It does **not** read `ANALYSIS_PROVIDER` and never returns `MockAnalyzer`. `factory.ts` does not even import `MockAnalyzer`. (Because `GeminiAnalyzer`'s constructor throws without `GEMINI_API_KEY`, the analyze route will 500 with that message when the key is missing.)
- `getMusicProvider()`: reads `process.env.MUSIC_PROVIDER` (**default `'elevenmusic'`**); returns `ElevenMusicProvider` for `'elevenmusic'` (Eleven Music, composition plan — the default), `ElevenLabsProvider` for `'elevenlabs'` (sound effects), `MockMusicProvider` for `'mock'`, else falls back to `ElevenMusicProvider`. `.env.local` sets `MUSIC_PROVIDER=elevenmusic`.
- This is the ONLY place that imports concrete providers.
- API routes call the factory and never import concrete providers directly.
- **To re-enable mock analysis** (e.g. for offline dev), restore the env-driven branch in `getAnalysisProvider()` and import `MockAnalyzer` — no other file needs to change.

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

// Poll until ACTIVE (max 40 attempts at 1.2s intervals = ~48s) — fast interval
// so short clips clear quickly (was 3s × 30). 
while (file.state === FileState.PROCESSING && attempts < 40) {
  await delay(1200);
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
- `sceneCount`: `Math.round(Math.max(1, toNumber(parsed.sceneCount, 5)))`
- MotionScore clamped: `Math.round(Math.min(1, Math.max(0, toNumber(parsed.motionScore, 0.5))) * 100) / 100`
- Timeline sorted by `startSeconds`, then `segments[0].startSeconds = 0` and `segments[last].endSeconds = totalDuration` forced
- Each timeline segment now includes optional `audioNote` parsed from the response

### Timeline fallback
If `raw.timeline` is not an array or has fewer than 2 entries, `fallbackTimeline(duration)` returns 3 equal-width (`duration/3`) segments: `calm/low` (Opening) → `emotional/medium` (Mid) → `inspirational/high` (Resolution).

### Cleanup
After successful analysis, `this.ai.files.delete({ name: file.name! }).catch(() => undefined)` — best-effort, never throws.

---

## ElevenLabs Provider — Implementation Details

**File:** `lib/providers/music/ElevenLabsProvider.ts`

### Constructor validation
Throws immediately if `ELEVENLABS_API_KEY` is not set, with a helpful message. Stores the key on `this.apiKey` (no SDK client is constructed).

### API call (raw `fetch`, not the SDK)
```ts
const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/sound-generation';
const body: Record<string, unknown> = { text: prompt, prompt_influence: 0.3 };
if (durationSeconds !== undefined) body.duration_seconds = durationSeconds;

const response = await fetch(ELEVENLABS_API, {
  method: 'POST',
  headers: { 'xi-api-key': this.apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
  body: JSON.stringify(body),
});
if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`ElevenLabs ${response.status}: ${errorText || '(empty response)'}`);
}
const buffer = Buffer.from(await response.arrayBuffer());
if (buffer.length === 0) throw new Error('ElevenLabs returned an empty audio response.');
```
- `prompt` comes from `buildPrompt()` (≤ **450** chars — see prompt builder).
- `prompt_influence` is **0.3**.
- `duration_seconds` is **only sent when the video duration is known** (`metadata.durationSeconds >= 0.5`); otherwise it is omitted and ElevenLabs picks a default length. There is **no 22s cap**.
- The provider logs the prompt and per-segment request bodies/errors via `console.log`/`console.error`.

### Multi-segment stitching (long videos)
`MAX_SEGMENT_SECONDS = 30`. The Sound Generation endpoint caps a single request at 30s, so:
- If `totalDuration > 30`, `fetchMultiSegment()` splits the duration into `ceil(total / 30)` chunks (`[30, 30, …, remainder]`), fetches them **all in parallel** via `Promise.all` (which preserves array order), and concatenates the raw MP3 buffers in order with `Buffer.concat`. (Parallelised for speed — was previously a sequential await loop.)
- Otherwise a single `fetchSegment()` call is made.

> Note: this contradicts the earlier "no multi-segment stitching" boundary — long-video stitching is now implemented (a naive MP3-byte concatenation, not a re-encode).

### Output + return value
```ts
const id = generateId();
const outputDir = path.join(process.cwd(), 'public', 'generated');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, `${id}.mp3`), buffer);

return {
  audioUrl: `/generated/${id}.mp3`,
  durationSeconds: totalDuration ?? 20,   // falls back to 20 when duration unknown
  bpm: analysis.bpm,
  genre: analysis.genre,
  mood: analysis.mood,
  filename: `score-${analysis.mood}-${analysis.bpm}bpm.mp3`,
  prompt,
};
```

---

## Shared Prompt Builder (`lib/providers/music/buildPrompt.ts`)

Two exported functions. Both `MockMusicProvider` and `ElevenLabsProvider` import from here. The builder was rewritten to exploit the richer Gemini analysis and to keep the prompt **sound-only** (no visual language) under a tight budget.

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

> **Currently unreferenced by the factory** (see Factory rules) but fully maintained and updated to emit the same expanded `VideoAnalysis` shape as `GeminiAnalyzer`.

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
- Calls `generateMp3(analysis, outputPath, result.metadata.durationSeconds)` to synthesize real PCM audio **matched to the actual video duration** (third arg added)
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
- Command: `python -m demucs --mp3 --mp3-bitrate 128 -n htdemucs --jobs 4 --segment 7 --out {tmpDir} {localPath}` — uses the single `htdemucs` model (≈4× faster than the `htdemucs_ft` bagging model), parallel `--jobs`, bounded `--segment` (**must be ≤ 7.8 s — `htdemucs` is a Transformer model with a hard segment cap**), and 128k MP3, all for speed.
- **Requirements:** `pip install demucs` + `ffmpeg` in PATH
- Output structure: `.tmp-demucs/{jobId}/htdemucs/{trackName}/{stem}.mp3`
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
export function generateMp3(
  analysis: VideoAnalysis,
  outputPath: string,
  targetDurationSeconds?: number,    // added — matches the synthesized length to the real video
): number
// returns durationSeconds (rounded to 1 decimal)
```

**Duration resolution:** `durationSeconds = clamp(targetDurationSeconds ?? ENERGY_DURATION[energy], 1, MAX_MOCK_DURATION)` where `MAX_MOCK_DURATION = 120` (caps synthesis at 2 min to bound memory). When no target is passed it falls back to the energy-based length below.

**Constants:**
```ts
SAMPLE_RATE = 44100
CHANNELS = 1
BITRATE = 128
CHUNK_SIZE = 1152        // lamejs internal requirement — multiple of 576
MAX_MOCK_DURATION = 120  // seconds, hard cap
```

**Mood-to-root-frequency map:**
```ts
calm: 261.63 (C4), happy: 329.63 (E4), energetic: 392.0 (G4),
dramatic: 220.0 (A3), suspenseful: 246.94 (B3), inspirational: 349.23 (F4),
emotional: 293.66 (D4), corporate: 311.13 (Eb4)
```

**Duration and amplitude by energy** (`ENERGY_DURATION` is only the fallback when `targetDurationSeconds` is omitted):
```ts
ENERGY_DURATION:   { low: 15, medium: 18, high: 22 }   // seconds (fallback only)
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
7. Returns `Math.round(durationSeconds * 10) / 10`

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
- `request.formData()`, fields `'video'` (the file) and optional `'durationSeconds'` (string, supplied by the client's `extractVideoDuration`)
- Validates MIME: `{ 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }`
- Validates size: `≤ 100 * 1024 * 1024`
- Path: `path.join(process.cwd(), 'public', 'uploads', `${generateId()}.${ext}`)`
- `fs.mkdirSync(uploadDir, { recursive: true })` before writing
- `fs.writeFileSync(fullPath, Buffer.from(await file.arrayBuffer()))`
- `durationSeconds` is `parseFloat`'d and only echoed back when finite and `> 0`, else `undefined`
- **Original-audio extraction:** after writing the video, calls `extractOriginalAudio(fullPath, id)` (ffmpeg → browser-playable MP3 at `public/uploads/{id}-original.mp3`). This is **best-effort and non-fatal** — returns `undefined` (and does not throw) when the source has no audio stream, ffmpeg is missing, or anything fails, so it never breaks an upload.
- Returns: `{ videoPath: string, filename: string, sizeBytes: number, durationSeconds?: number, originalAudioUrl?: string }`
  - `videoPath` is the absolute filesystem path — passed verbatim to the analyzer
  - `filename` is `file.name` (the original user filename)
  - `originalAudioUrl` is `/uploads/{id}-original.mp3` when extraction succeeded, else omitted/`undefined`
- **Error handling exception:** this route returns a generic `'Upload failed. Please try again.'` (status 500) — it does **not** surface the raw error message (unlike analyze/generate).

### POST `/api/analyze`
- Validates: `videoPath` (string), `filename` (string), `sizeBytes` (number) — all required
- Calls `getAnalysisProvider().analyze(body.videoPath, { filename, sizeBytes })` (i.e. **always `GeminiAnalyzer`**). Note `durationSeconds` is sent by the client but the route does not read it into the metadata object — Gemini infers duration itself.
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

> All components were recolored in the rebrand. They now use the `navy-*` / `cream-*` tokens (theme-aware) plus the literal banana-yellow `#ffcc18` / hover `#ffd84d`. The old `zinc-*` / `amber-500` classes are gone.

### ThemeToggle (`components/ThemeToggle.tsx`)
- `'use client'`. Renders an 8×8 icon button in the header (sun icon in dark mode, moon in light).
- State `isDark` defaults to `true`. On mount, reads `localStorage.getItem('theme')`; if `'light'`, removes the `.dark` class from `<html>`.
- `toggle()` flips the `.dark` class on `document.documentElement` and writes `'dark'`/`'light'` to `localStorage`.

### DropZone
- `'use client'`
- `onFileSelect(file: File)` callback — does NOT trigger upload
- Validates file BEFORE calling callback: type check + `≤ 100 MB`
- `accept="video/mp4,video/quicktime,video/webm"` on hidden `<input type="file">`
- Drag-over: `border-[#ffcc18] bg-[#ffcc18]/5 scale-[1.01]` (normal: `border-navy-700 hover:border-navy-600 hover:bg-navy-900/50`)
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
- Colors by energy: low = `bg-[#6EA556]` (green), medium = `bg-[#fdf3ab]` (pale yellow), high = `bg-[#FFCC18]` (banana)
- Text color is navy `text-[#1D2F45]` for all three energies (dark text on the light bars)
- First segment `rounded-l-lg`, last `rounded-r-lg`; container is `h-9 overflow-hidden`
- Text label (the mood word) only rendered when `widthPct > 16`
- Hover: `hover:opacity-80`
- `title` attribute: `"${seg.label} (${seg.startSeconds}s – ${seg.endSeconds}s)"`
- Heading "Video Arc"; time axis below bar: "0s" left, `{totalDuration}s` right (`text-cream-400`)

### AudioPlayer
- `'use client'`
- Accepts `{ src: string }`
- `useRef<HTMLAudioElement>` — no library
- Local state: `isPlaying`, `currentTime`, `duration`, `isLoaded`
- `useEffect` keyed on `[src]` attaches: `timeupdate`, `loadedmetadata`, `ended`; cleans up on unmount
- **Decorative waveform**: 40 bars, heights computed once with: `Math.max(4, Math.min(44, 20 + Math.sin(i*0.9)*14 + Math.cos(i*0.4)*9 + Math.abs(Math.sin(i*1.4))*7))`
- Bars filled `bg-[#ffcc18]` when `(i / waveHeights.length) * 100 < progress`, else `bg-navy-700`
- Seek bar: `<input type="range" min=0 max={duration||0} step=0.01>` with inline background gradient:
  ```
  background: `linear-gradient(to right, #ffcc18 ${progress}%, #2D4B6E ${progress}%)`
  ```
- Thumb styled via Tailwind arbitrary pseudo-selector variants `[&::-webkit-slider-thumb]` / `[&::-moz-range-thumb]`, colored `#ffcc18`
- Play/pause: `bg-[#ffcc18]` circle button (`h-10 w-10`, `hover:bg-[#ffd84d]`, `text-navy-950`), inline SVG icons (pause = two rects, play = triangle path)
- Time display: `{formatDuration(currentTime)} / {formatDuration(duration)}`
- Shows "Loading audio…" (`text-cream-400`) when `!isLoaded`
- `togglePlay` is `async` — catches errors from `audio.play()` silently

### ScoreOutput (`components/player/ScoreOutput.tsx`)
- `'use client'`. Accepts `{ score: GeneratedScore; videoSrc: string; originalAudioUrl: string | null }`. This is what the `completed` step renders in place of a bare `AudioPlayer`.
- Local UI state only (no workflow/hook state): `tab: 'audio' | 'combined'` (default `'audio'`) and `includeOriginalAudio: boolean` (**default `false`** — pure generated score first).
- Derives `hasOriginalAudio = originalAudioUrl !== null && originalAudioUrl.length > 0`.
- **Tab bar** (banana-filled active tab `bg-[#ffcc18] text-navy-950`): "Generated Score" → `<AudioPlayer src={score.audioUrl} />`; "Video + Score" → `<CombinedVideoPlayer …/>`.
- **Only the active tab is mounted** (conditional render, not hidden) — unmounting the inactive player tears down its `<audio>`/`<video>` so there is never overlapping audio when switching tabs.
- **Bottom-right toggle switch** "Include original audio" (`role="switch"`, `aria-checked`) rendered **only on the combined tab**. When `hasOriginalAudio` is false it is **disabled** and the label changes to "Original video has no usable audio track" (`text-cream-500`, `opacity-40`). It drives `CombinedVideoPlayer`'s `includeOriginalAudio` (passed as `hasOriginalAudio && includeOriginalAudio`).
- **Graceful fallback:** when `videoSrc === ''` (no original video available), it returns just `<AudioPlayer src={score.audioUrl} />` with no tabs. Page passes `videoObjectUrl ?? ''` (the object URL persists from `selectFile` through `completed`, so it is normally present).

### CombinedVideoPlayer (`components/player/CombinedVideoPlayer.tsx`)
- `'use client'`. Accepts `{ videoSrc: string; audioSrc: string; originalAudioUrl: string | null; includeOriginalAudio: boolean }`.
- **Why the original audio is a separate track, not the `<video>`'s own audio:** browsers ship only a few audio decoders, so an uploaded clip whose audio is e.g. **AC-3 / E-AC-3 or PCM-in-MOV** plays its video track but is **silent** — the bytes aren't stripped, the browser just can't decode them. Toggling `video.muted` therefore can't produce sound for those files. Instead, the upload step extracts the original audio to a browser-playable MP3 via ffmpeg (`extractOriginalAudio`), and this player plays **that** as a slaved track.
- Refs: `videoRef`, `scoreRef` (generated score), `originalRef` (extracted original audio, only rendered when `originalAudioUrl` is non-null). Custom transport styled to match `AudioPlayer` (banana play/pause circle, gradient seek bar, `mm:ss / mm:ss` readout); the `<video>` has **no native `controls`**.
- **The `<video>` is ALWAYS muted** (`muted` attr + a `[videoSrc]` effect forcing `video.muted = true`); it provides frames + the master clock only. Audio always comes from the slaved `<audio>` elements.
- **Master clock = video.** `togglePlay` plays/pauses the video + every slaved audio (aligned to the video's `currentTime` first); `handleSeek` sets `currentTime` on all three; on the video's `timeupdate` each slaved audio is **drift-corrected** (`if |a.currentTime − video.currentTime| > 0.25 → a.currentTime = video.currentTime`, the `DRIFT_TOLERANCE_SECONDS` constant).
- A `useEffect` keyed on `[includeOriginalAudio, originalAudioUrl]` sets `originalRef.muted = !includeOriginalAudio` **live** (no playback interruption). The score `<audio>` is always audible; the original-audio `<audio>` is muted/unmuted instantly.
- Controls disabled until **video + score** both fire `loadedmetadata` (`videoReady && scoreReady` — the original-audio track is not gated on, so a slow/absent extra track never blocks playback). Shows "Loading video…" until then; video `duration` is the displayed timeline.
- `video` `pause`/`play` listeners keep all slaved audios in lockstep; on `ended` everything pauses and resets to 0; on unmount all elements are paused (refs copied into the effect for a clean teardown).
- Score/video length mismatch is tolerated by design — video is the timeline; a shorter track ends early, a longer one is cut at video end. No time-stretching.

### DownloadButton
- Accepts `{ score: GeneratedScore }`
- `<a href={score.audioUrl} download={score.filename} className="block">` wrapping shadcn `<Button size="lg">`
- Button styled: `bg-navy-800 text-cream-50 border border-navy-700 hover:bg-navy-700` (dark secondary, NOT banana-yellow)
- Shows `Download {score.filename}` with a download SVG icon
- Direct anchor download — no JavaScript fetch or Blob

---

## Page Layout (`app/page.tsx`)

The page is `'use client'`. Section rendering is controlled by `state.step` and the `videoFile` presence.

### Header (always visible)
Sticky header (`bg-navy-950/80 backdrop-blur-sm`, `border-b border-navy-800`) containing: the `banana-logo.svg` + "BananaMOV" wordmark on the left, and on the right a "Powered by ElevenLabs" pill plus the `<ThemeToggle />`. A footer ("Built for JamHacks 2026 · Powered by ElevenLabs") sits below `<main>`.

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
- **Score section** (`score && step === 'completed'`): divider, score metadata badges, prompt box, `ScoreOutput` (tabbed Generated Score / Video + Score panel — receives `videoSrc={videoObjectUrl ?? ''}` and `originalAudioUrl={originalAudioUrl}`), DownloadButton, stem-separation controls, "Score another video" link.

---

## Visual Design System

The palette is theme-aware via custom tokens. Tailwind utilities `navy-*` and `cream-*` resolve to CSS variables that flip between `:root` (light = warm parchment) and `.dark` (dark = navy). **Token names are semantic, not literal** — `navy-*` is always "surface/background" and `cream-*` is always "text/foreground", regardless of theme. The banana accent `#ffcc18` is a constant literal across themes.

### Token roles
| Role | Class / token |
|---|---|
| Page background | `bg-navy-950` |
| Card surface | `bg-navy-900` |
| Elevated / hover | `bg-navy-800` |
| Elevated stats bg | `bg-navy-800/50` |
| Borders | `border-navy-700` or `border-navy-800` (`navy-600` on hover) |
| Header border | `border-navy-800` |
| Primary accent | `text-[#ffcc18]`, `bg-[#ffcc18]` (literal) |
| Accent hover | `hover:bg-[#ffd84d]` |
| Primary text | `text-cream-50` |
| Secondary text | `text-cream-200` / `text-cream-300` |
| Muted text | `text-cream-400` |
| Very muted text | `text-cream-500` |
| Error | `text-red-400`, `bg-red-950/40`, `border-red-800/60` |

### Token hex values (from `globals.css`)
**Dark mode (`.dark`, default):** navy-950 `#1D2F45`, navy-900 `#1F3550`, navy-800 `#243D5C`, navy-700 `#2D4B6E`, navy-600 `#3D5E84`; cream-50 `#FDF6EB`, cream-100 `#EDE3D4`, cream-200/300 `#D7C09B`, cream-400/500 `#B28B52`.
**Light mode (`:root`, "warm parchment"):** navy-950 `#F8F0E2`, navy-900 `#EFE3CA`, navy-800 `#E4D3B2`, navy-700 `#CFBB92`, navy-600 `#BAA478`; cream-50 `#1D2F45`, cream-100 `#243D5C`, cream-200/300 `#6B5240`, cream-400/500 `#4A3220`.
**Brand accents (theme-constant):** banana `#ffcc18`, banana-hover `#ffd84d`, pale-yellow `#fdf3ab`, slate-blue `#7CA0CB`, leaf-green `#6EA556`, bronze `#B28B52`.

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
<div className="rounded-xl border border-navy-700 bg-navy-900 p-6">
  ...
</div>
```

### CTA button pattern
```tsx
<button className="w-full rounded-xl bg-[#ffcc18] py-3 text-sm font-semibold text-navy-950 transition-all hover:bg-[#ffd84d] active:scale-[0.99]">
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
| `MUSIC_PROVIDER` | `elevenmusic` | `elevenmusic`, `elevenlabs`, `mock` |
| `ELEVENLABS_API_KEY` | — | Required when `MUSIC_PROVIDER=elevenmusic` or `elevenlabs` |
| `GEMINI_API_KEY` | — | Required when `ANALYSIS_PROVIDER=gemini` |
| `STEM_PROVIDER` | `mock` | `mock`, `local`, `replicate` |
| `DEMUCS_PYTHON_CMD` | `python` | Override Python executable when `STEM_PROVIDER=local` (e.g. `python3`) |
| `FFMPEG_CMD` | `ffmpeg` | Override the ffmpeg executable used by `extractOriginalAudio` (original-audio extraction at upload) |
| `REPLICATE_API_KEY` | — | Required when `STEM_PROVIDER=replicate` |
| `REPLICATE_MODEL_VERSION` | — | Required when `STEM_PROVIDER=replicate`; find hash at replicate.com/lucataco/demucs |
### Notes
- **`ANALYSIS_PROVIDER` is no longer read.** Analysis is hardcoded to Gemini, so `GEMINI_API_KEY` is effectively required to use the app end-to-end. (`.env.example` no longer lists `ANALYSIS_PROVIDER`.)
- Only the **music** factory still branches on an env var (`MUSIC_PROVIDER`, **default `'elevenmusic'`** — the Music API; requires Music Generation access on the key).
- **ffmpeg** (in PATH, or set `FFMPEG_CMD`) is used by both `STEM_PROVIDER=local` (Demucs) and the upload step's original-audio extraction. It is **optional** for upload: if absent, uploads still succeed and the "Video + Score" tab simply shows the original-audio toggle disabled. On Windows, `resolvedPath()` merges the user registry PATH so a freshly-winget-installed ffmpeg is found without restarting the dev server.

| Var | Default | Options | Notes |
|---|---|---|---|
| `MUSIC_PROVIDER` | `elevenmusic` | `elevenmusic`, `elevenlabs`, `mock` | Selects the music provider; default is the Music API (layered composition plan) |
| `GEMINI_API_KEY` | — | — | **Required** — analyze step always uses Gemini |
| `ELEVENLABS_API_KEY` | — | — | Required when `MUSIC_PROVIDER=elevenlabs` **or** `elevenmusic` |
| `ANALYSIS_PROVIDER` | *(ignored)* | — | Read by neither factory anymore |

- `elevenlabs` → sound-effects endpoint (`/v1/sound-generation`). `elevenmusic` → Eleven Music (`/v1/music`, composition plan). **`elevenmusic` requires the API key to have Music Generation = Access enabled.**

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

## Eleven Music Integration (Ideas 1 & 3) — IMPLEMENTED (Phases 0–2)

> **STATUS: Phases 1–2 implemented and building** as `ElevenMusicProvider` (`MUSIC_PROVIDER=elevenmusic`, opt-in; mock stays default). This moves music generation from the ElevenLabs **sound-effects** endpoint (`/v1/sound-generation`) to the ElevenLabs **Music** endpoint (`/v1/music`, `model_id: music_v1`) for timeline alignment ("Idea 1") and richer musical direction ("Idea 3"). **Phase 3** (Gemini authoring per-section styles) remains future. **Prerequisite for runtime:** the API key must have **Music Generation = Access** enabled. The decisions captured here: heuristic styles from existing Gemini fields (no analyze-step changes), `MAX_TOTAL_SECONDS = 180`, always instrumental.

### Why
The current `ElevenLabsProvider` uses the sound-effects model: one holistic clip, `duration_seconds` as the only temporal control, no notion of sections/timing, and a 30 s cap that forces repetitive multi-segment stitching. The Music API supports up to 600 s in one call and a structured `composition_plan` with named, timed sections — natively enabling sectional alignment to the video arc and per-section musical direction.

### Design principle
Additive and behind the existing factory. A new `ElevenMusicProvider` implements the unchanged `MusicGenerationProvider` interface and is selected by `MUSIC_PROVIDER=elevenmusic`. The current sound-effects `ElevenLabsProvider` and `MockMusicProvider` stay (A/B + fallback). **No changes to routes, hooks, or components.**

### Eleven Music API facts (verified from docs)
- `POST https://api.elevenlabs.io/v1/music`, `model_id: 'music_v1'` (default), `output_format` query param (e.g. `mp3_44100_128`).
- Two **mutually exclusive** input modes:
  - **`prompt`** (string) + `music_length_ms` (3,000–600,000) + `force_instrumental` (bool, prompt-mode only).
  - **`composition_plan`** — for `music_v1` this is a `MusicPrompt` object:
    - `positive_global_styles: string[]`, `negative_global_styles: string[]`
    - `sections: SongSection[]`, each: `section_name` (1–100 chars), `positive_local_styles: string[]`, `negative_local_styles: string[]`, `duration_ms` (3,000–120,000), `lines: string[]` (lyrics; empty ⇒ instrumental)
  - `respect_sections_durations: bool` strictly enforces per-section lengths when `true`.
  - (`music_v2` uses a different `chunks`/`GenerationChunk` shape — out of scope for v1 of this work.)
- **Key prerequisite:** the API key must have **Music Generation = Access** enabled (it currently does not on the dev key).
- **Cost:** ~600–700 credits/min (confirm via the in-app pre-generation estimate). The dev key's 5,000-credit cap ≈ ~7.5 min total — the binding constraint, not the Creator plan (100k credits/mo).
- **Licensing:** paid plans (incl. Creator) include commercial rights; trained on licensed data (Kobalt/Merlin). Do **not** prompt with real artist names or copyrighted lyrics.

### Files (implemented)
- **New** `lib/providers/music/ElevenMusicProvider.ts` — implements `MusicGenerationProvider` via `POST /v1/music` (composition-plan mode).
- **New** `lib/providers/music/buildCompositionPlan.ts` — `buildCompositionPlan(result): CompositionPlan` (timeline→sections + heuristic styles). Leaves the sound-effects `buildPrompt.ts` untouched.
- **Edit** `lib/providers/factory.ts` — `if (provider === 'elevenmusic') return new ElevenMusicProvider();`.
- **Edit** `types/index.ts` — added `MusicSection`, `CompositionPlan`, `ScoreSection`, and optional `GeneratedScore.sections`.
- **Edit** `.env.example` — documented `MUSIC_PROVIDER=elevenmusic` + the Music-access prerequisite.

### Phases (status)
1. **Phase 0 — manual spike:** enable Music access on the key, hand-build a `composition_plan` via `curl` to confirm access/quality. *(Runtime prerequisite; not code.)*
2. **Phase 1 — prompt mode:** *Skipped in favour of going straight to composition-plan mode (Phase 2), which delivers Idea 1.* Prompt mode (`prompt` + `music_length_ms` + `force_instrumental`) remains available as a future fallback if needed.
3. **Phase 2 — `composition_plan` mapping (Idea 1) — ✅ DONE:** maps the Gemini `timeline` to `sections[]` with `respect_sections_durations: true`; heuristic styles.
4. **Phase 3 — Gemini emits styles (deepest Idea 3) — FUTURE:** extend `ANALYSIS_PROMPT` so the model returns per-segment `positiveStyles`/global `negativeStyles`; `buildCompositionPlan` would consume them, falling back to the current heuristics.

### Idea 1 — timeline → `composition_plan` algorithm (`buildCompositionPlan`)
Constants in the module: `MAX_TOTAL_SECONDS = 180`, `MIN_SECTION_SECONDS = 3`, `MAX_SECTION_SECONDS = 120`. Each `duration_ms ∈ [3000, 120000]`; `lines: []` everywhere (instrumental).
1. `target = clamp(round(metadata.durationSeconds ?? Σ timeline ?? 30), MIN_SECTION_SECONDS, MAX_TOTAL_SECONDS)`.
2. Per timeline segment: `segMs = (end - start) * 1000`, scaled by `targetMs / (timelineSpan*1000)`.
3. Normalize to section bounds: **<3 s** → merge into adjacent block (into previous; first merges into second) — handles Gemini's short openings; **>120 s** → split into equal ≤120 s sub-sections sharing styles.
4. Absorb rounding drift into the last section (clamped to `[MIN_MS, MAX_MS]`).
5. Emit one `MusicSection` per resulting block (intro/peak/outro position hints applied).

Result: section changes line up with the video's arc (structural alignment), not frame-accurate per scene-cut (the 3 s minimum precludes literal 2 s/3 s cuts, which is musically correct).

### Idea 3 — style construction (sound-only; local `VISUAL_LEAK` filter via `clean()`)
- **Layer-floor guarantee (richness):** `buildGlobalStyles()` prepends explicit instrument-layer descriptors so every score is layered — **always** a genre-appropriate `bassLayer()` (electric bass / upright / sub-bass / low cello foundation — never cello *as* bass) plus `'clear melodic lead'` and `'rich harmonic texture'` (≥2 layers), **plus** a `drumLayer()` when `drumsAppropriate !== false` and the genre has a rhythm section, **plus** a wordless `vocalLayer()` (choir pads / backing harmonies / vocal chops / humming / scat) when `vocalPresence !== 'none'`. Net: at least two, usually three, of bass/drums/melody/vocals. These layer styles come **first** so the ≤20 cap never drops them.
- `positive_global_styles` (deduped, ≤20, each ≤100 chars): the layer descriptors above, then `genre`, `mood`, `${bpm} BPM`, `${keyMode} key`, `${pace} pace`, top 3 `instrumentSuggestions`, plus cleaned `sonicTexture` / `musicalRecommendation` / `rhythmicFeel` / `dynamicArc`.
- `negative_global_styles`: always `['lyrics','spoken word']`; **`'vocals'` is added only when `vocalLayer()` is null** (so wordless choir/backing textures are allowed when the analysis asks for them). Plus contextual avoidances — `+['loud lead melody','dense mix']` when `audioDialogueDominant` or `musicRole === 'background-underscore'`; `+['harsh distortion','aggressive percussion']` when `mood === 'calm'` or `energyLevel === 'low'`.
- `positive_local_styles` (per section): segment `mood`, `${energyLevel} energy`, the cleaned `musicalDescription` (for per-section texture), and a position hint — first → `'gentle introduction, sparse texture'`, peak → `'full arrangement, climactic'`, last → `'resolving, settling cadence'`. `negative_local_styles` is empty.
- `section_name` = the segment's `label` (or `Section {n} — {mood}`), capped at 100 chars.
- **Genre reweighting (analysis):** `ANALYSIS_PROMPT` now includes a "GENRE DIVERSITY" rule telling Gemini *not* to default to hip-hop / orchestral / cinematic, and to prefer everyday genres (pop, indie, rock, folk, acoustic, electronic, lo-fi-hip-hop, r-and-b, blues, jazz, ambient, world) that match the real vibe — opening up the full 18-genre range.

### Provider details (`ElevenMusicProvider`)
- Constructor throws if `ELEVENLABS_API_KEY` missing.
- Request: `POST https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128`, headers `xi-api-key` / `Content-Type: application/json` / `Accept: audio/mpeg`.
- Body (implemented): `{ model_id: 'music_v1', respect_sections_durations: true, composition_plan: { positive_global_styles, negative_global_styles, sections } }`. (Prompt-mode body `{ model_id, prompt, music_length_ms, force_instrumental: true }` is not used — kept as a future fallback.)
- Response is **raw MP3 bytes** (confirmed `application/octet-stream`): `Buffer.from(await res.arrayBuffer())`, validate non-empty, write `public/generated/{id}.mp3`.
- Returns `GeneratedScore` with `durationSeconds` = plan total, `prompt` = human-readable serialization of the plan (global styles + per-section line) for the UI's prompt box, and `sections` (`ScoreSection[]`) for optional display.

### Cross-cutting
- **Duration cap:** `MAX_TOTAL_SECONDS = 180` bounds the track at 3 min for now (credit cost is not a current concern per sponsor allocation).
- **Error handling:** `/api/generate` already surfaces provider messages, so a missing-Music-access (`403`) error reaches the UI verbatim. (No automatic fallback to `ElevenLabsProvider` is wired — switch via `MUSIC_PROVIDER` if needed.)

### Resolved during implementation
- `/v1/music` returns raw audio bytes (no JSON envelope). ✅
- `music_v1` is the default model and takes the `MusicPrompt`-shaped `composition_plan`. ✅
- `.env.local` already has `ELEVENLABS_API_KEY` + `GEMINI_API_KEY`. ✅

### Still open (verify when first run live)
Max section count / total-duration ceiling for a plan; whether `respect_sections_durations: true` degrades musical quality enough to prefer `false`; exact credit cost (visible in-app pre-generation).

---

## BananaMOV Studio (DAW) — `/daw`

A full-viewport online audio workstation reachable at `/daw`. Linked from `app/page.tsx` via an "Open in BananaMOV Studio →" button that appears after `stemStep === 'stems_ready'`. Audio URLs are passed as URL query params:

```
/daw?score=/generated/uuid.mp3&original=/uploads/uuid-original.mp3&stems=drums:/stems/id/drums.mp3,bass:/stems/id/bass.mp3,...
```

### Layout

Full viewport — no scrolling page. `h-screen flex-col overflow-hidden`:

```
┌─────────────────────────────────────────────────┐
│ Page header (logo, ← Back, ElevenLabs)         │
│ Transport (play/pause/stop/BPM/Mixer/zoom)      │
├──────────────┬──────────────────────────────────┤
│ TrackLibrary │ Arrangement (bar/beat grid)      │
│ + Plugins    │                                  │
│ (220px left) ├──────────────────────────────────┤
│              │ ExportPanel (collapsible)        │
├──────────────┴──────────────────────────────────┤
│ Mixer (bottom dock, toggled — full width)       │
└─────────────────────────────────────────────────┘
```

### State — `hooks/useDAW.ts`

All DAW state lives in `useDAW(initialItems: DAWLibraryItem[])`. No TanStack Query — no server mutations in the DAW. The hook:

- **Initialisation:** on mount, loads each seed library item's duration via a hidden `<Audio>` element; builds one **generic numbered `DAWTrack`** per item (`name: 'Track N'`, colour from `TRACK_PALETTE`) with one `DAWClip` at `startSeconds=0`, routed to `'master'`. Tracks are plain lanes — **any library item can be dragged into any track** (drums + melody can share one); each clip keeps its own colour/label. Imported items only populate the library, not tracks.
- **Timeline length:** `computeTotalDuration()` = the **end of the last clip** (max `startSeconds + durationSeconds`), no floor/padding; falls back to `EMPTY_TIMELINE_SECONDS = 30` when there are no clips. (Was floored at 60 s +10 s, which showed a misleading 1:10 default.)
- **Audio engine + single clock:** Web Audio API (`AudioContext`). On `play()` it captures **one** `ctx.currentTime + LOOKAHEAD` (0.06 s) into `playStartCtxRef`, schedules all `AudioBufferSourceNode`s off that value, and the RAF loop derives `currentTime = (ctx.currentTime − playStartCtxRef) × rate + offset`. **The playhead and the top-left readout both read this single `currentTime`**, so they stay paired. `pause()` suspends; `stop()` resets to 0; `seek()` restarts scheduling from the new offset if playing.
  - **Playhead/pause race fix:** `transportRef.current` is set **imperatively** in `play()`/`pause()`/`stop()` (and the end-of-track branch), not just via a `useEffect`. Previously the first RAF tick could fire before the transport effect committed and bail (`transportRef !== 'playing'`), freezing the playhead and making pause look like a reset. Setting the ref imperatively before `startRaf()` removes the race.
- **BPM = tempo (pitch-preserved):** `bpmToRate(bpm) = clamp(bpm/120, 0.25, 4)` (120 BPM = native speed). At play time each clip's buffer is rendered through `stretchAudioBuffer()` ([lib/audio/timeStretch.ts](lib/audio/timeStretch.ts), SoundTouch via `soundtouchjs`) to a **pitch-preserving** stretched buffer of length `clipDuration/rate`, cached by `url@rate` in `stretchedBuffersRef` (rate ≈ 1 bypasses stretching). Scheduling offsets are divided by `rate`; the RAF clock advances at `rate × wall-time` so the ruler stays in project seconds. Changing BPM while playing re-renders the buffers and `restartIfPlaying()`s. Export (`OfflineAudioContext`) stretches the same way and renders a timeline of length `total/rate`.
- **Per-clip source tracking:** `clipSourcesRef: Map<clipId, AudioBufferSourceNode[]>`. `deleteClip()` (right-click) and `removeTrack()` immediately `.stop()` the matching nodes, so deleted audio goes silent **mid-playback** (fixes the prior "keeps playing" bug).
- **Clip tools (trim / split):** every clip plays the source window `[offsetSeconds, offsetSeconds + durationSeconds]`; scheduling reads from `offsetSeconds` (in both `play()` and `exportMix()`, divided by `rate`). Handlers (`MIN_CLIP_SECONDS = 0.1`):
  - `trimClipStart(clipId, newStart)` — left-edge trim: moves `startSeconds` + `offsetSeconds` together and adjusts `durationSeconds` (right edge fixed). Clamped to `offsetSeconds ≥ 0` and `durationSeconds ≥ MIN` — so you can trim inward **and drag back out only to the real source start** (never past actual audio).
  - `trimClipEnd(clipId, newDuration)` — right-edge trim: clamps `durationSeconds` to `[MIN, sourceDurationSeconds − offsetSeconds]` (can't extend past the source end).
  - `splitClip(clipId, atSeconds)` — slices one clip into two; the right half inherits `offsetSeconds + (at − start)` so its audio is continuous. Guards `MIN` on both sides.
  - All three `restartIfPlaying()` so live playback reschedules. `toolMode: 'move' | 'slice'` (state) selects clip-body behaviour (drag-move vs click-to-split).
- **Mixer graph:** built fresh each `play()` by `buildMixGraph()` (in `lib/audio/dawGraph.ts`). Signal path: `bufferSource → trackGain → insert.input → [effect chain] → insert.volume → insert.panner → master → destination`. Non-master inserts feed the master strip's input. `trackGain` applies track mute/solo/volume; the insert strip applies insert mute/solo/volume/pan.
- **Live updates:** `refreshGains()` (a `useEffect` on `project.tracks`/`project.inserts`) sets every track & insert gain/pan live. Effect **param** tweaks call the built effect's `update()` closure live (no rebuild). **Structural** changes (add/remove/bypass effect, re-route a track's insert) call `restartIfPlaying()` which re-schedules in place.
- **Exports:** `exportMix()` reuses `buildMixGraph()` inside an `OfflineAudioContext` (so effects + routing are rendered), encodes WAV via a hand-written encoder, downloads. `exportTrack()` re-downloads the source MP3. `saveProject()` downloads `DAWProject` as `.json`.

### Types — `types/daw.ts`

```ts
DAWLibraryItem { id, label, group: 'score'|'stems'|'original'|'imported', audioUrl, color, durationSeconds? }
DAWClip        { id, trackId, libraryItemId, audioUrl, label, color, startSeconds, durationSeconds,
                 offsetSeconds, sourceDurationSeconds }   // offset = source in-point; sourceDuration = trim bound
DAWTrack       { id, name, color, muted, solo, collapsed, volume, insertId, clips }
EffectType     = 'eq' | 'reverb' | 'delay' | 'compressor' | 'distortion' | 'filter-adsr'
Effect         { id, type, enabled, params: Record<string, number> }
MixerInsert    { id, name, volume, pan, muted, solo, effects: Effect[] }   // id 'master' = master strip
DAWProject     { tracks, inserts, bpm, totalDurationSeconds }
DAWTransportState = 'stopped' | 'playing' | 'paused'
DAWToolMode    = 'move' | 'slice'
```

Re-exported from `types/index.ts`. Initial project has `Master` + 4 empty inserts (`makeInitialInserts()`); `addInsert()` appends more.

### Effects — `lib/audio/dawGraph.ts`

Each effect compiles to a Web Audio sub-graph via `buildEffect(ctx, effect, opts)` returning `{ input, output, update(params) }`. `opts: { bpm, startTime }` lets tempo-synced effects schedule against the playback anchor; `buildMixGraph(ctx, project, { startTime })` passes it through.
- **eq** — three `BiquadFilter`s in series (lowshelf 320 Hz / peaking 1 kHz / highshelf 3.2 kHz), gains in dB.
- **compressor** — `DynamicsCompressorNode` (threshold/ratio/attack/release).
- **distortion** — `WaveShaperNode` (curve from `amount`) with wet/dry blend (`mix`).
- **delay** — `DelayNode` + feedback `GainNode` loop, wet/dry (`time`/`feedback`/`mix`).
- **reverb** — `ConvolverNode` with a generated noise-burst impulse (`decay`), wet/dry (`mix`).
- **filter-adsr** (Filter Envelope) — lowpass `BiquadFilter` whose cutoff is swept by an **ADSR envelope re-triggered every bar** (tempo-synced via `opts.bpm`/`opts.startTime`, scheduled with `setValueAtTime`/`linearRampToValueAtTime`). Params: `attack/decay/sustain/release`, `cutoff` (base Hz), `resonance` (Q), `amount` (env depth). Live `update()` applies resonance instantly and re-schedules the envelope (which also lands on the next play/restart). Rendered with **rotary knobs** + a live ADSR-curve SVG in the mixer rack (not sliders).

`EFFECT_DEFAULTS`, `EFFECT_LABELS`, and `EFFECT_PARAM_SPECS` (the `[key,label,min,max,step]` UI descriptors) live here too.

### Components — `components/daw/`

**`Transport.tsx`** — play/pause (banana circle), stop, `mm:ss / mm:ss` readout, BPM `<input>`, **Move/Slice tool toggle**, **Mixer toggle**, zoom in/out. Loading spinner during buffer decode.

**`TrackLibrary.tsx`** — grouped audio sources: **Generated Score / Audio Tracks (stems) / Original Audio / Imported**. Stems are labelled `Drums Stem`, `Bass Stem`, `Melody Stem`, `Vocals Stem`. Each item: colored dot, label, duration, `+` add button, and `draggable` (`application/daw-item`). Root is a plain `<div>` (width/border come from the left-column wrapper in `page.tsx`).

**`PluginPalette.tsx`** — left-panel **"Plugins"** section under the library. Lists the 5 effects; clicking one calls `addEffect(selectedInsertId, type)` (adds to the insert currently selected in the mixer). Shows the target insert name; "Mixer ↕" opens the dock.

**`Arrangement.tsx`** — dual-axis scroll. `Ruler` shows **bar numbers** (1,2,3…) with a beat-subdivided grid driven by BPM (`secondsPerBeat = 60/bpm`, 4/bar); clicking seeks. Each clip lane paints a beat/bar grid via layered `repeating-linear-gradient`. Track header (`sticky left-0`, two rows when expanded): row 1 = collapse / dot / name / × remove; row 2 = M / S / **insert routing `<select>`**. Playhead is a yellow 1px line at `currentTime * pxPerSecond + HEADER_WIDTH`.
- **`Clip`** — body drag-moves (snaps to beat) in **move** tool; in **slice** tool a body click splits at the cursor (`onSplit`). Left/right **trim handles** (`TRIM_HANDLE_PX = 6`, `cursor-ew-resize`, appear on hover) resize the clip with a live preview committed on mouse-up (snapped to beat). Right-click deletes. A `<canvas>` (`ClipWaveform`) draws the **monochrome peak waveform** of the clip's trimmed window (`getPeaks(audioUrl)` cached; windowed by `offsetSeconds`/`durationSeconds`/`sourceDurationSeconds`), behind the label — silent ≈ flat, peaks = tall.

**`Mixer.tsx`** — **bottom dock** (240 px, toggled). Horizontal `InsertStrip`s (name, fx/track counts, pan slider, vertical volume fader, M/S) — clicking selects a strip. Selected strip's `EffectRack` shows its effects with per-param sliders, bypass dot, and remove — **except `filter-adsr`**, which renders an `AdsrEffectBody` (a live ADSR-curve SVG + a row of rotary `Knob`s). "+ Insert" adds a strip; chevron closes the dock.

**`Knob.tsx`** — reusable SVG rotary knob: 270° sweep, drag up/down or scroll to change, banana value-arc + indicator. Used by the Filter Envelope plugin.

**`ExportPanel.tsx`** — collapsible "Export & Import" bar. **Import Audio** (`<input accept="audio/*">`) → object URL + duration → appended to the **Imported** library group via `onImportAudio`. Plus "Export Mix (WAV)", per-track MP3 buttons, "Save Project (.json)".

### Navigation from main page

`app/page.tsx` exports `buildDAWUrl(score, originalAudioUrl, stems)`. The "Open in BananaMOV Studio →" button appears when `stemStep === 'stems_ready'`. `app/daw/page.tsx` wraps `DAWContent` (which calls `useSearchParams`) in `<Suspense>` (Next.js 16 requirement) and holds the **library list in state** (seeded from the URL) so imports can append.

### DAW Constants (in source)

- `TRACK_HEIGHT = 60` px, `COLLAPSED_HEIGHT = 28` px, `RULER_HEIGHT = 30` px, `HEADER_WIDTH = 200` px
- `LOOKAHEAD = 0.06` s (schedule-ahead that the clock subtracts back out)
- `REFERENCE_BPM = 120` (native playback speed; `bpmToRate` clamps the multiplier to `[0.25, 4]`)
- `DEFAULT_BPM = 120`, `DEFAULT_CLIP_DURATION = 30` s, `EMPTY_TIMELINE_SECONDS = 30` s (empty-project placeholder; total otherwise = last clip end)
- `TRACK_PALETTE` = 7 colours cycled for generic "Track N" lanes
- `MIN_CLIP_SECONDS = 0.1` (trim/split floor), `TRIM_HANDLE_PX = 6`, waveform peak buckets = `2000`
- Mixer dock height `240` px; initial inserts = Master + 4

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
| ~~Multi-segment audio stitching~~ | **Now implemented** for >30s videos in `ElevenLabsProvider` (sequential ≤30s fetches, raw MP3-buffer concat) — no longer forbidden |
| Real-time generation streaming | Future feature |
| DAW timeline editing (move clips, mute/solo, per-stem export) | **Implemented** — see BananaMOV Studio section |
| Direct imports of concrete providers in routes | Always use factory |

---

## Implementation Checklist

All phases are complete. This checklist reflects the completed state.

### Phase 1 — Foundation ✅
- [x] Scaffold Next.js 16 project
- [x] Install dependencies: `@tanstack/react-query`, `@google/genai`, `lamejs`, `clsx`, `tailwind-merge`, `tw-animate-css`, `soundtouchjs` (DAW pitch-preserving time-stretch; typed locally via `types/soundtouchjs.d.ts`) — (the `elevenlabs` / `@elevenlabs/elevenlabs-js` SDKs are installed but no longer imported — the provider uses raw `fetch`)
- [x] Initialize shadcn/ui, add: `button`, `badge`, `card`
- [x] Configure `.gitignore`
- [x] Create `.env.local` and `.env.example`

### Phase 2 — Types and Utilities ✅
- [x] `types/index.ts` — all shared types
- [x] `lib/utils.ts` — cn, formatDuration, formatFileSize, seededRandom, hashString, generateId, delay

### Phase 3 — Provider Layer ✅
- [x] `lib/providers/types.ts` — VideoAnalysisProvider, MusicGenerationProvider interfaces
- [x] `lib/providers/factory.ts` — getAnalysisProvider() (**hardcoded Gemini**), getMusicProvider() (mock/elevenlabs)
- [x] `lib/providers/analysis/MockAnalyzer.ts` — seeded arc templates + full analysis (now emits expanded fields; unused by factory)
- [x] `lib/providers/analysis/GeminiAnalyzer.ts` — Gemini 2.5 Flash + File API + retry + expanded JSON schema parsing
- [x] `lib/audio/generateTone.ts` — PCM synthesis + lamejs MP3 encoding (duration-matched)
- [x] `lib/providers/music/buildPrompt.ts` — buildPrompt() (450-char, visual-leak filtered, 2 paths) + buildTags()
- [x] `lib/providers/music/ElevenLabsProvider.ts` — **raw `fetch` to Sound Generation REST** + multi-segment stitching + buildPrompt

### Phase 4 — API Routes ✅
- [x] `app/api/upload/route.ts`
- [x] `app/api/analyze/route.ts`
- [x] `app/api/generate/route.ts`

### Phase 5 — Workflow Hook ✅
- [x] `hooks/useWorkflow.ts` — state machine + selectFile + removeFile + upload + analyze + generate + reset

### Phase 6 — Components ✅
- [x] `components/ThemeToggle.tsx` (light/dark, localStorage)
- [x] `components/upload/DropZone.tsx`
- [x] `components/upload/VideoPreview.tsx`
- [x] `components/analysis/TimelineBar.tsx`
- [x] `components/analysis/AnalysisCard.tsx`
- [x] `components/player/AudioPlayer.tsx`
- [x] `components/player/ScoreOutput.tsx` (tabbed Generated Score / Video + Score panel + original-audio toggle)
- [x] `components/player/CombinedVideoPlayer.tsx` (video synced to generated score, master-clock + drift correction)
- [x] `components/player/DownloadButton.tsx`

### Phase 7 — App Shell ✅
- [x] `app/providers.tsx` — QueryClientProvider wrapper (retry: 0)
- [x] `app/globals.css` — Tailwind v4 imports, navy/cream token system (light + dark), shadcn CSS vars, fadeIn keyframe
- [x] `app/layout.tsx` — Geist fonts, Providers, `dark` default class, metadata
- [x] `app/page.tsx` — full single-page workflow with header/logo/theme-toggle, step indicator, hero, error banner

### Phase 8 — Validation ✅
- [x] `npm run build` passes with zero errors
- [x] `npm run lint` passes with zero warnings
- [x] End-to-end flow: upload → analyze → generate → play → download
- [x] ElevenLabs integration works when `MUSIC_PROVIDER=elevenlabs` and key is set
- [x] Gemini integration works (always-on; requires `GEMINI_API_KEY`)
- [x] Light/dark theme toggle persists across reloads

---

## Session Startup Checklist

Every new Claude Code session on this project:
1. Read this file completely
2. Read `SPEC.md` for product requirements
3. Run `git status` to understand current state
4. Run `npm run build` to check for existing errors before making changes
5. All phases are complete — focus is on fixing bugs or extending features, not building from scratch
6. Do not refactor working code — fix what is broken, build what is missing
