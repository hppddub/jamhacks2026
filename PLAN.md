# PLAN.md — BananaMOV Multi-Page Platform

Implementation plan for evolving BananaMOV from a single-page workflow into a 5-page
authenticated platform with persisted projects and a (future) mixing/mastering stage.

> **Status:** Planning. No code written yet. This document is the source of truth for the
> build; update it as phases land. Companion docs: `SPEC.md` (product), `CLAUDE.md` (engineering rules).

---

## 0. Confirmed decisions

| Decision | Choice |
|---|---|
| File storage | **Object storage (Vercel Blob) + Neon for metadata/URLs** |
| Auth gating | **Generator open to all; sign-in only to save/view projects** (`/projects`, `/mix` gated) |
| Save model | **Explicit "Save to project" with a user-assigned name** after generation |
| DB access layer | **Drizzle ORM** over `@neondatabase/serverless` |
| Storage vendor | **Vercel Blob** (`@vercel/blob`), behind a swappable provider interface |
| Generator route | **`/studio`** (the current workflow, relocated) |
| Auth provider | **Clerk** (`@clerk/nextjs`) |

**Guiding principle:** additive and incremental. The live `/studio` workflow keeps writing
artifacts to local disk exactly as today (Gemini needs a local video path; Demucs reads a
local MP3). Persistence is an **explicit promotion** of those artifacts to durable object
storage at save time. Each phase below leaves the app fully working.

---

## 1. Page map (5 pages)

| Route | Page | Auth | Summary |
|---|---|---|---|
| `/` | Home | Public | Aesthetic scroll: hero → About section → feature highlights → CTA; top nav menu. |
| `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]` | Login | Public | Clerk catch-all auth pages. |
| `/studio` | Generator | Public | Current upload → analyze → generate → stems flow + "Save to project" + "Open Mixing". |
| `/projects`, `/projects/[id]` | Projects DB | **Gated** | Grid of saved generations; detail page replays a saved generation. |
| `/mix/[projectId]` | Mixing/Mastering | **Gated** | Scaffold: receives a generation's files + musical metadata via a defined contract. |

"About" is a scroll section of Home, not a separate page. The existing `app/page.tsx`
workflow is relocated to `app/studio/page.tsx`; `/` becomes the new marketing home.

---

## 2. Dependencies to add

```
@clerk/nextjs                # auth
drizzle-orm                  # ORM
@neondatabase/serverless     # Neon driver
@vercel/blob                 # object storage
-D drizzle-kit               # migrations / studio
```

No existing dependency is removed.

---

## 3. Environment variables (additions)

Append to `.env.local` (real values) and `.env.example` (blanks):

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/projects
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/projects

# Neon
DATABASE_URL=                 # Neon pooled connection string

# Storage
STORAGE_PROVIDER=vercel-blob  # vercel-blob | local
BLOB_READ_WRITE_TOKEN=        # required when STORAGE_PROVIDER=vercel-blob
```

`STORAGE_PROVIDER=local` is a dev fallback that serves persisted files from `public/` (no
durable storage) so the app runs without a Blob token.

---

## 4. Directory structure (new + moved)

```
app/
  layout.tsx                         # EDIT: wrap with <ClerkProvider> (outside <Providers>)
  (marketing)/
    page.tsx                         # NEW: Home (hero + About + features + CTA)
  sign-in/[[...sign-in]]/page.tsx    # NEW
  sign-up/[[...sign-up]]/page.tsx    # NEW
  studio/page.tsx                    # MOVED from app/page.tsx (current workflow)
  projects/
    page.tsx                         # NEW: grid (RSC, gated)
    [id]/page.tsx                    # NEW: detail (RSC, gated)
  mix/[projectId]/page.tsx           # NEW: mixing scaffold (gated)
  api/
    upload/route.ts                  # unchanged
    analyze/route.ts                 # unchanged
    generate/route.ts                # unchanged
    stems/route.ts                   # unchanged
    projects/route.ts                # NEW: POST create, GET list
    projects/[id]/route.ts           # NEW: GET one, PATCH rename, DELETE
middleware.ts                        # NEW: clerkMiddleware, protect /projects, /mix
drizzle.config.ts                    # NEW
drizzle/                             # NEW: generated migrations
lib/
  db/
    index.ts                         # NEW: drizzle client (neon http)
    schema.ts                        # NEW: tables
  projects/
    queries.ts                       # NEW: typed read/write helpers (own-row checks)
    serialize.ts                     # NEW: workflow state <-> DB row mappers
  storage/
    types.ts                         # NEW: StorageProvider interface
    factory.ts                       # NEW: getStorageProvider()
    VercelBlobProvider.ts            # NEW
    LocalStorageProvider.ts          # NEW (dev fallback)
hooks/
  useWorkflow.ts                     # EDIT: add saveProject action + saved projectId
  useProjects.ts                     # NEW: list/detail/rename/delete query hooks
  useSaveProject.ts                  # NEW (or folded into useWorkflow)
components/
  layout/
    SiteHeader.tsx                   # NEW: nav menu + UserButton + ThemeToggle
  marketing/
    Hero.tsx                         # NEW
    AboutSection.tsx                 # NEW
    FeatureSection.tsx               # NEW
  projects/
    ProjectGrid.tsx                  # NEW
    ProjectCard.tsx                  # NEW
    SaveProjectDialog.tsx            # NEW (name prompt)
  mix/
    MixWorkspace.tsx                 # NEW (placeholder)
types/index.ts                       # EDIT: add Project, ProjectFile, MixSession, etc.
```

`AnalysisCard`, `ScoreOutput`, `CombinedVideoPlayer`, `AudioPlayer`, `StemPlayer`,
`DownloadButton`, `ThemeToggle` are reused unchanged.

---

## 5. Data model (Neon + Drizzle)

`lib/db/schema.ts`:

```
projects
  id           uuid pk default gen_random_uuid()
  user_id      text not null                 # Clerk user id (indexed)
  name         text not null                 # user-assigned project name
  status       text not null default 'saved'
  duration_s   real
  bpm          integer
  genre        text
  mood         text
  analysis     jsonb not null                # full AnalysisResult
  score        jsonb not null                # full GeneratedScore (prompt, backendPrompt, instrumentSpec, sections)
  mix_state    jsonb                          # reserved for future mixing settings (null for now)
  created_at   timestamptz not null default now()
  updated_at   timestamptz not null default now()
  index (user_id, created_at desc)

project_files
  id           uuid pk default gen_random_uuid()
  project_id   uuid not null references projects(id) on delete cascade
  kind         text not null                 # 'source_video' | 'original_audio' | 'score' | 'stem'
  stem_id      text                          # 'drums'|'bass'|'melody'|'vocals' when kind='stem', else null
  url          text not null                 # object-storage URL
  filename     text
  size_bytes   integer
  mime_type    text
  created_at   timestamptz not null default now()
  index (project_id)
```

Notes:
- One **project = one saved generation**. The full `AnalysisResult`/`GeneratedScore`
  (including `instrumentSpec`, `backendPrompt`, timeline `valence`/`arousal`) serialize
  cleanly into `jsonb`, so a detail page reconstructs the generation exactly.
- `bpm`/`genre`/`mood`/`duration_s` are denormalized onto `projects` for cheap card rendering.
- Migrations via `drizzle-kit generate` + `drizzle-kit migrate` (npm scripts: `db:generate`, `db:migrate`, `db:studio`).

---

## 6. Storage provider interface

`lib/storage/types.ts`:

```ts
export type StoredFileKind = 'source_video' | 'original_audio' | 'score' | 'stem';

export interface StorageProvider {
  /** Upload a local file to durable storage and return its public URL. */
  upload(localPath: string, key: string, contentType: string): Promise<string>;
  /** Best-effort delete by URL (used when a project is deleted). */
  delete(url: string): Promise<void>;
}
```

- `factory.ts` reads `STORAGE_PROVIDER` (default `vercel-blob`); returns `VercelBlobProvider`
  or `LocalStorageProvider`. Same pattern as the analysis/music/stem factories — concrete
  providers are imported only here.
- `VercelBlobProvider`: `put(key, fileStream, { access: 'public', contentType })`.
- `LocalStorageProvider`: copies into `public/projects/{projectId}/…` and returns the
  relative URL (dev only; ephemeral on serverless).
- Object key convention: `projects/{projectId}/{kind}{-stemId?}.{ext}`.

---

## 7. Auth (Clerk)

- `middleware.ts`: `clerkMiddleware` + `createRouteMatcher(['/projects(.*)', '/mix(.*)', '/api/projects(.*)'])` → `auth().protect()` for matched routes. `/studio` and its `/api/{upload,analyze,generate,stems}` stay public.
- `app/layout.tsx`: `<ClerkProvider>` wraps the existing `<Providers>` (Query) and shell.
- `SiteHeader`: `<SignedIn><UserButton/></SignedIn>` + `<SignedOut><SignInButton/></SignedOut>`.
- Saving while signed-out: `SaveProjectDialog`'s save triggers Clerk sign-in, then resumes.
- **Ownership checks:** every project/mix read & write re-checks `auth().userId === project.user_id` server-side (middleware is the first gate, not the only one).

---

## 8. Persistence flow (explicit save)

1. User completes a generation (± stems) in `/studio`.
2. Clicks **"Save to project"** → sign-in if needed → `SaveProjectDialog` (name pre-filled from `mood + genre`).
3. Client `POST /api/projects` with `{ name, analysis, score, stems, originalAudioUrl, uploadedVideoPath, durationSeconds }` (the in-memory workflow state).
4. Server route handler:
   - `auth()` → `userId` (401 if absent).
   - Generate `projectId`.
   - For each artifact (source video, original audio MP3, score MP3, each stem MP3): resolve its local path → `storage.upload(...)` → URL.
   - Insert `projects` row (jsonb `analysis`/`score` + denormalized fields) and `project_files` rows.
   - Return `{ projectId }`.
5. Client shows success → "Open project" (`/projects/[id]`) / "Open Mixing" (`/mix/[projectId]`).

`hooks/useWorkflow.ts` gains a `saveProject(name)` action + `savedProjectId` in state (or a
dedicated `useSaveProject` mutation). Reads use `hooks/useProjects.ts`.

---

## 9. Projects pages

- `/projects` (RSC, gated): `getProjectsForUser(userId)` via Drizzle → `<ProjectGrid>` of
  `<ProjectCard>` (name, mood/genre/bpm badges, duration, date; actions: Open, Open Mixing,
  Rename, Delete). Empty state with CTA to `/studio`.
- `/projects/[id]` (RSC, gated, ownership-checked): load project + files → feed jsonb
  `analysis`/`score` and object-storage URLs into the **existing** `AnalysisCard`,
  `ScoreOutput`, `StemPlayer`. `ScoreOutput`/`CombinedVideoPlayer` already accept
  `videoSrc`/`originalAudioUrl` as plain strings, so stored URLs slot in with **zero
  component changes**. Plus a prominent "Open Mixing" button.
- `PATCH /api/projects/[id]` (rename), `DELETE /api/projects/[id]` (delete rows + best-effort blob deletes).

---

## 10. Mixing / Mastering page (connect now, implement later)

- **Entry:** "Open Mixing" on `/studio` (saves first if unsaved — mixing is per-saved
  generation) and on `/projects/[id]` → navigates to `/mix/[projectId]`.
- **Handoff contract** (the future DSP tool consumes this):
  ```ts
  interface MixTrack { id: string; label: string; kind: 'score' | 'original' | 'stem'; url: string; }
  interface MixSession {
    projectId: string;
    bpm: number;
    keyMode?: 'major' | 'minor' | 'modal';
    durationSeconds: number;
    tracks: MixTrack[];
  }
  ```
- `/mix/[projectId]` (RSC, gated): build `MixSession` from the project + files → render
  `<MixWorkspace session={...} />`.
- `MixWorkspace` (placeholder): lists tracks with players; reserves labeled UI regions for
  **mixing**, **mastering**, and **filter envelopes**. No DSP yet. Future settings persist to
  the reserved `projects.mix_state` jsonb (or a later `mix_sessions` table).

---

## 11. Type additions (`types/index.ts`)

```ts
export interface ProjectFile {
  id: string;
  kind: 'source_video' | 'original_audio' | 'score' | 'stem';
  stemId?: StemId;
  url: string;
  filename?: string;
  sizeBytes?: number;
  mimeType?: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  status: 'saved';
  durationSeconds?: number;
  bpm?: number;
  genre?: string;
  mood?: Mood;
  analysis: AnalysisResult;
  score: GeneratedScore;
  files: ProjectFile[];
  createdAt: string;
  updatedAt: string;
}

export interface MixTrack { id: string; label: string; kind: 'score' | 'original' | 'stem'; url: string; }
export interface MixSession {
  projectId: string;
  bpm: number;
  keyMode?: 'major' | 'minor' | 'modal';
  durationSeconds: number;
  tracks: MixTrack[];
}
```

---

## 12. Build phases (each ships independently)

### Phase A — Routing & shell — ✅ DONE
- [x] Add `(marketing)/page.tsx` Home (`Hero` + `AboutSection` + `FeatureSection` + CTA).
- [x] Add `SiteHeader` (nav menu + theme + "Powered by ElevenLabs" pill) and `SiteFooter`; wire the global shell into `app/layout.tsx` (header + `{children}` + footer inside `<Providers>`).
- [x] Move workflow `app/page.tsx` → `app/studio/page.tsx` (git-tracked rename, component renamed `Home`→`Studio`, inline header/footer removed in favour of the global shell).
- [x] `npm run build` green; `/` and `/studio` both serve 200; full upload→analyze→generate→stems flow intact at `/studio`.
- [x] Incidental fix: `ElevenMusicProvider` now returns `backendPrompt` + `instrumentSpec` (a pre-existing type break from the in-progress instrument-spec work, surfaced by a clean `next build`; fixed to mirror `MockMusicProvider`/`ElevenLabsProvider`).

### Phase B — Clerk auth — ✅ DONE
- [x] Install `@clerk/nextjs` (**v7.5.2**); add Clerk env vars to `.env.local` + `.env.example`.
- [x] **`clerkEnabled` guard** (`lib/auth.ts`, reads `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`): the app builds/runs with **no keys** (ClerkProvider + auth UI + protection all stay dormant) and activates automatically once keys are added — preserves the "each phase ships working" principle.
- [x] Guarded `<ClerkProvider afterSignOutUrl="/" appearance={{variables:{colorPrimary:'#ffcc18'}}}>` in `app/layout.tsx`.
- [x] `middleware.ts`: `clerkMiddleware` + `createRouteMatcher(['/projects(.*)','/mix(.*)','/api/projects(.*)'])` → `auth.protect()`; `config.matcher` scoped to those trees; no-op passthrough when keys absent.
- [x] `app/sign-in/[[...sign-in]]/page.tsx` + `app/sign-up/[[...sign-up]]/page.tsx` (render Clerk `<SignIn/>`/`<SignUp/>`, or a "not configured" notice when keyless).
- [x] Header auth: `components/layout/HeaderAuth.tsx` (client) branches on `useUser()` → `<UserButton/>` or `<SignInButton/>`; rendered by `SiteHeader` only when `clerkEnabled`.
- [x] **Clerk v7 API notes (learned during build):** `<SignedIn>/<SignedOut>` are *server-only* in v7 — a client header must use `useUser()`; `UserButton` dropped `afterSignOutUrl` (now on `<ClerkProvider>`).
- [x] Verified keyless: `npm run build` green; `/`,`/studio`,`/sign-in`,`/sign-up` → 200; `/projects` → 404 (not 500); header shows no auth control; lint clean. **With-keys path requires the user to paste real Clerk keys** (cannot be runtime-verified here).

### Phase C — Data + storage — ✅ DONE (migration applied + services verified)
- [x] Install `drizzle-orm` (0.45.2), `@neondatabase/serverless` (1.1), `drizzle-kit` (0.31.10), `@vercel/blob` (2.4), `dotenv` (dev).
- [x] `lib/db/schema.ts` (`projects` + `project_files`, jsonb analysis/score, denormalized bpm/genre/mood/duration, `mix_state` reserved, indexes) + inferred row types; `lib/db/index.ts` (Neon HTTP drizzle client, throws if `DATABASE_URL` unset — only imported by on-demand server code).
- [x] `drizzle.config.ts` (loads `.env.local` via dotenv) + npm scripts `db:generate` / `db:migrate` / `db:studio`.
- [x] **Migration generated & applied**: `drizzle/0000_late_warlock.sql` (both tables, cascade FK, 2 indexes, timestamptz defaults). `npm run db:migrate` ran successfully against Neon; tables/columns/indexes/FK verified via `information_schema`.
- [x] `lib/storage/` — `StorageProvider` interface + `getStorageProvider()` factory (`STORAGE_PROVIDER`, default `vercel-blob`) + `VercelBlobProvider` (`put`/`del`, `addRandomSuffix:false`, `allowOverwrite:true`) + `LocalStorageProvider` dev fallback (`public/projects/{key}`).
- [x] Types: `Project`, `ProjectFile`, `ProjectFileKind`, `MixTrack`, `MixSession` added to `types/index.ts`.
- [x] `.env.example` + `.env.local` got `DATABASE_URL`, `STORAGE_PROVIDER`, `BLOB_READ_WRITE_TOKEN`; `.gitignore` now ignores `public/projects/` (and `drizzle/` is committed).
- [x] `npm run build` green **with Clerk keys now live** (`/`, `/studio` still prerender static); lint clean on all Phase C files.
- [x] **Incidental Phase B fix:** the middleware `config.matcher` was widened to the canonical Clerk pattern — the previous narrow matcher (`/projects/:path*`) did **not** match the *bare* `/projects`, so the page would have been unprotected. Verified live: `/projects` now returns Clerk `protect-rewrite` (gated), `/studio` stays public.

**Services verified (ready for Phase D):** Neon `DATABASE_URL` connects and the tables are migrated; the Vercel Blob store is **public** and a real upload→public-GET(200)→delete round-trip passed through `VercelBlobProvider`'s exact `put`/`del` options. (Note: the Blob store must be **public** — a private store rejects `access:'public'`; and `DATABASE_URL` must be the `postgresql://` pooled string, not the dashboard/API URL.)

### Phase D — Save + Projects — ✅ DONE (data layer verified live)
- [x] `POST /api/projects` — `auth()`-gated; validates name/payload → `saveProjectFromWorkflow` (promote local artifacts → Blob, insert rows). `export const maxDuration = 180`.
- [x] `lib/projects/`: `serialize.ts` (row↔domain mappers + `buildPlayback`), `queries.ts` (`insertProject`/`getProjectSummaries`/`getProject`/`renameProject`/`deleteProjectRow`, all **ownership-scoped** by `userId`), `save.ts` (path-traversal-guarded upload + rollback on failure — neon-http has no transactions, so partial saves are manually cleaned up).
- [x] Save UI: `useSaveProject` hook + `SaveProjectControl` (gated on `clerkEnabled`; signed-out → **modal** sign-in so the in-memory generation survives; signed-in → opens dialog) + `SaveProjectDialog` (name → POST → redirect to `/projects/[id]`). Used a dedicated hook instead of extending `useWorkflow` (cleaner separation).
- [x] `/projects` grid (RSC, gated, `getProjectSummaries`) + `/projects/[id]` detail (RSC, gated, `getProject` + `buildPlayback`) — **reuses `AnalysisCard`/`ScoreOutput`/`StemPlayer`/`DownloadButton` with zero changes**, fed from stored jsonb + Blob URLs. Score's `audioUrl` is rewritten to its Blob URL at save so the detail page plays it directly.
- [x] `PATCH`/`DELETE /api/projects/[id]` (ownership-checked) + `ProjectCard` inline rename + two-step delete (`useProjects` mutations → `router.refresh()`), and `DeleteProjectButton` on the detail page.
- [x] Header gains a **Projects** nav link (when `clerkEnabled`); post-sign-in landing moved to `/projects` in `.env.example`.
- [x] **Verified:** `npm run build` green (all project routes dynamic); lint clean; a live round-trip against Neon+Blob passed — jsonb `analysis`/`score` round-trip (incl. nested `instrumentSpec`), file rows, **ownership scoping** (wrong user → 0 rows), **cascade delete**, and Blob upload→public-GET(200)→delete, with full cleanup.
- [ ] **Not runtime-tested here** (needs a browser Clerk session): the authenticated HTTP path through `/api/projects` and the interactive UI. Covered by type-check + build + the live data-layer round-trip; worth a manual click-through (upload → generate → Save → see it under /projects → open → rename → delete).

### Phase E — Mixing scaffold — ✅ DONE
- [x] `MixSession` handoff built by `lib/mix/buildMixSession.ts` (Project → `{ projectId, bpm, keyMode, durationSeconds, tracks: [{id,label,kind,url}] }`; tracks = score → stems (canonical order) → original audio).
- [x] `/mix/[projectId]` page — gated RSC (`auth()` → `getProject(id, userId)` → `buildMixSession` → `MixWorkspace`); `notFound()` if missing/not owned. Verified gated live (`protect-rewrite`).
- [x] `MixWorkspace` placeholder — track list (reuses `AudioPlayer`, now with an optional `label` prop) + session-meta badges + three reserved "Coming soon" regions (Mixing / Mastering / Filter Envelopes). No DSP; `projects.mix_state` jsonb stays reserved for future settings.
- [x] "Open Mixing" entry points: `/projects/[id]` detail has a direct link; the studio adds a **"Save & open mixing →"** button (extends `SaveProjectControl`/`SaveProjectDialog` with a `redirectTo: 'project' | 'mix'` so an unsaved generation is saved first, then routed to `/mix/[id]`).
- [x] `npm run build` green (all routes incl. `/mix/[projectId]`); lint clean. Full UI requires a browser Clerk session to exercise (covered by type-check + build + the gating check).

### Phase F — Polish
- [ ] Project thumbnails (ffmpeg single-frame grab at save).
- [ ] Loading/empty/error states; optimistic rename/delete.
- [ ] Retention policy for local working files after save.

### Phase G — DAW (mixing/mastering) integration — ✅ DONE

Replaced the Phase E `MixWorkspace` placeholder with the real Web-Audio DAW from `origin/maxim`.

- [x] **Brought the additive DAW files** from `origin/maxim` (`app/daw/page.tsx`, `components/daw/*`, `hooks/useDAW.ts`, `lib/audio/dawGraph.ts`, `types/daw.ts`) — they predate the Phase A restructure, so maxim's edits to `app/page.tsx`/`ScoreOutput`/`types/index.ts`/`CLAUDE.md`/`.env.example` were **not** merged; the DAW was re-wired into the current architecture instead. **No new npm dependencies** (pure Web Audio + existing `lamejs`).
- [x] **CORS de-risked:** Vercel Blob serves `access-control-allow-origin: *`, so the DAW's `fetch`+`decodeAudioData` works on cross-origin Blob URLs with no proxy.
- [x] **Mount point:** extracted `components/daw/DAWWorkspace.tsx` from the page (props `{ seedItems, projectId?, projectName?, savedState? }`); `app/daw/page.tsx` kept as a thin URL-seeded wrapper. `/mix/[projectId]` now renders `<DAWWorkspace>` **full-bleed under the global header** (`h-[calc(100vh-65px)]`), seeded via `mixSessionToDAWSeed(buildMixSession(project))`.
- [x] **Export & save master:** `useDAW` gained `renderMixBlob()`; `DAWWorkspace` has a "Save master to project" button → `useSaveMaster` POSTs the rendered WAV + DAW session JSON to **`POST /api/projects/[id]/master`** (auth+ownership) → `storage.uploadBytes` (new interface method) to `{id}/master.wav` → `project_files` row `kind:'master'` (free-text, no migration) → persists the session to `projects.mix_state`. The detail page shows a **"Download mastered mix (.wav)"** link when a master exists.
- [x] **Reload:** `useDAW(seedItems, savedProject?)` restores a saved session from `mix_state` (validated; falls back to seeding from tracks). `Project.mixState` plumbed through `rowToProject`.
- [x] `npm run build` green (adds `/daw`, `/api/projects/[id]/master`); lint clean across all imported DAW files; `/daw` renders publicly, `/mix` + master route gated. Full DAW UX needs a browser Clerk session to exercise.

---

## 13. Impact on existing code

- **Unchanged:** all `/api/{upload,analyze,generate,stems}` routes; analysis/music/stem
  factories & providers; `lib/audio/*`; all current player/analysis components.
- **Edited:** `app/layout.tsx` (ClerkProvider), `app/page.tsx` → `app/studio/page.tsx`,
  `hooks/useWorkflow.ts` (add save), `types/index.ts` (new types).
- **Reused as-is on `/projects/[id]`:** `AnalysisCard`, `ScoreOutput`, `CombinedVideoPlayer`,
  `StemPlayer`, `DownloadButton` — they already take plain props/URLs.

---

## 14. Open items (defaulted; revisit at build time)

- Reads via RSC + Drizzle; writes via route handlers (server actions optional later).
- Local working-file retention after save — default: keep for the session.
- Thumbnails — Phase F.
- Persist mix settings — schema reserved (`mix_state`), populated when DSP lands.
- `.gitignore`: add `public/projects/` (local storage fallback) + `drizzle/` is committed.

---

## 15. Acceptance criteria (end state)

- [ ] 5 routes live; nav menu reaches all; theme + auth state correct in header.
- [ ] Generator usable signed-out at `/studio`; full upload→analyze→generate→stems works.
- [ ] "Save to project" (signed-in) persists a named project: artifacts in Vercel Blob, rows in Neon.
- [ ] `/projects` lists only the current user's projects; `/projects/[id]` faithfully replays a saved generation from stored data.
- [ ] `/mix/[projectId]` receives a valid `MixSession` (tracks + bpm/key/duration) and renders the placeholder workspace.
- [ ] `/projects` and `/mix` reject signed-out users; cross-user access is blocked server-side.
- [ ] `npm run build` and `npm run lint` pass clean.
