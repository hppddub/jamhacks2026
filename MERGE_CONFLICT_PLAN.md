# Merge Conflict Resolution Plan — `maxim` → `main`

Status: **PLAN ONLY — do not execute until the canonical-direction decision is confirmed.**

## Diagnosis

The PR merges **`maxim`** into **`main`**. They diverged at base `89abb30`; each side has ~10 commits of **large, overlapping** work, so this is not a routine merge — **two different feature tracks collided**, including **two independent DAW implementations**.

- **`origin/main`** (the team's infra track — alvin/stanley/linda):
  - **Auth** (Clerk): `app/sign-in`, `app/sign-up`, `lib/auth`.
  - **Persistence**: Neon Postgres + Vercel Blob — `app/api/projects/*`, `hooks/useProjects.ts`, `useSaveProject.ts`, `useSaveMaster.ts`, `components/projects/*`.
  - **Route restructure**: landing moved to `app/(marketing)/page.tsx`; the upload→analyze→generate **workflow moved to `app/studio/page.tsx`**; added `/projects`, `/mix/[projectId]`.
  - **Its own DAW** at `/daw` via `components/daw/DAWWorkspace.tsx`.
  - Provider edits: `factory.ts` (`hasKey`→mock fallback + `sound-generation` opt-in), `ElevenLabsProvider.ts` (heavy rewrite, +59/−52), `buildCompositionPlan.ts` (+89), `.env.example` (+Clerk/DB/Blob).

- **`maxim`** (our DAW + generation track):
  - **Advanced DAW** at `/daw`: `components/daw/*`, `hooks/useDAW.ts`, `lib/audio/dawGraph.ts`, plus maxim-only `Knob.tsx`, `lib/audio/timeStretch.ts`, `lib/audio/waveform.ts` — ADSR filter envelope, BPM time-stretch, clip trim/split, in-clip waveforms, generic numbered tracks, mixer.
  - Workflow still at `app/page.tsx`.
  - Provider edits: `factory.ts` (default `elevenmusic`), `ElevenLabsProvider.ts` (parallel segments, +8/−8), `buildCompositionPlan.ts` (layer-floor guarantee + genre reweight, +72).

## The conflicting files (15), by class

**Class 1 — Two DAW implementations (add/add — both branches created the file):**
`app/daw/page.tsx`, `components/daw/Arrangement.tsx`, `components/daw/Mixer.tsx`, `components/daw/PluginPalette.tsx`, `components/daw/Transport.tsx`, `hooks/useDAW.ts`, `lib/audio/dawGraph.ts`, `types/daw.ts`.
(`components/daw/TrackLibrary.tsx` and `ExportPanel.tsx` exist on both but are **identical** → auto-merged, no conflict. `Knob/timeStretch/waveform` are maxim-only → arrive cleanly.)

**Class 2 — Workflow page restructure:**
`app/page.tsx` (maxim modified) vs main **deleted** it, moving content to `app/studio/page.tsx` (content conflict) + `app/(marketing)/page.tsx`. On GitHub this shows as the `app/page.tsx` conflict.

**Class 3 — Shared files, real content merges:**
`lib/providers/factory.ts`, `lib/providers/music/ElevenLabsProvider.ts`, `lib/providers/music/buildCompositionPlan.ts`, `components/player/ScoreOutput.tsx`, `.env.example`, `CLAUDE.md`.

## Critical coupling (the "make no mistakes" risk)

`main`'s persistence/DAW are wired to **main's** DAW API:
- `app/mix/[projectId]/page.tsx` and `hooks/useSaveMaster.ts` import `DAWWorkspace` / main's `DAWProject` shape.
- `types/daw.ts` differs: **maxim's is a superset** (`DAWClip.offsetSeconds`/`sourceDurationSeconds`, `DAWProject.inserts`, `DAWToolMode`, `filter-adsr`); main's `DAWProject` is what the save/load layer serializes.

If we keep maxim's DAW + types (recommended), **main's `DAWWorkspace.tsx`, `app/mix/[projectId]/page.tsx`, and `useSaveMaster.ts` will not compile unchanged** and must be rewired or stubbed.

## Recommended strategy — keep BOTH tracks

**Adopt `main`'s infra (auth + persistence + marketing/studio routes) and layer `maxim`'s superior DAW on top.** Nobody's work is thrown away. Resolution per file:

| File | Resolution |
|---|---|
| `types/daw.ts` | **maxim** (superset). Then make main's save layer compile against it. |
| `hooks/useDAW.ts`, `lib/audio/dawGraph.ts` | **maxim** wholesale. |
| `components/daw/{Arrangement,Mixer,PluginPalette,Transport}.tsx` | **maxim** wholesale. |
| `app/daw/page.tsx` | **maxim** (renders maxim's components). |
| `components/daw/DAWWorkspace.tsx` (main-only) | **Delete** (orphaned by maxim's `/daw`). |
| `app/mix/[projectId]/page.tsx` (main-only) | **Rewire** off `DAWWorkspace` → maxim's DAW, or temporarily route to `/daw`. |
| `hooks/useSaveMaster.ts` (main-only) | Reconcile against maxim's `DAWProject` shape. |
| `app/page.tsx` (maxim) | **Delete** — superseded by main's `app/studio/page.tsx`. Port any maxim-only bits (e.g. the "Open in Studio/DAW" link, score tabs) into `app/studio/page.tsx`. |
| `app/(marketing)/page.tsx`, `app/studio/page.tsx`, sign-in/up, `/projects`, `api/projects`, `lib/auth`, `components/projects/*`, `useProjects/useSaveProject` | **Keep main** (additive infra). |
| `lib/providers/factory.ts` | **main** (its `hasKey`→mock fallback + `sound-generation` opt-in is a superset; both already default to the Music API). |
| `.env.example` | **main** (superset: Clerk/DB/Blob). Ignore maxim's only change (it just removed the two REPLICATE lines). |
| `lib/providers/music/ElevenLabsProvider.ts` | **Base on main's rewrite**, then re-apply maxim's **parallel segment fetch** if main is still sequential. Verify the segment cap (main mentions a 22s legacy cap). |
| `lib/providers/music/buildCompositionPlan.ts` | **Hand-merge**: main's additions **+** maxim's layer-floor guarantee + genre reweight. Read both fully. |
| `components/player/ScoreOutput.tsx` | **Hand-merge** (small, ±6/±4 lines — both tweaked tabs/props). |
| `CLAUDE.md` | **Hand-merge / union** — keep main's auth/projects docs + maxim's DAW docs. |
| `package.json` / `package-lock.json` | Auto-merged by git; **verify** the union (main: clerk/drizzle/blob; maxim: soundtouchjs) then `npm install`. |

## Procedure (local, reversible)

1. **Safety branch:** `git checkout -b merge/main-into-maxim maxim` (resolve here, not on `maxim`).
2. `git merge origin/main` → reproduces the 15 conflicts. (During this merge, **`--ours` = maxim**, `--theirs` = main.)
3. **Wholesale picks:** `git checkout --ours` the maxim DAW files (`hooks/useDAW.ts`, `lib/audio/dawGraph.ts`, `components/daw/{Arrangement,Mixer,PluginPalette,Transport}.tsx`, `app/daw/page.tsx`, `types/daw.ts`). `git checkout --theirs .env.example lib/providers/factory.ts`.
4. **Deletions / rewires:** `git rm app/page.tsx components/daw/DAWWorkspace.tsx`; rewire `app/mix/[projectId]/page.tsx` + `hooks/useSaveMaster.ts` to maxim's DAW/types (or stub the mix route → redirect to `/daw`).
5. **Hand-merge:** `ElevenLabsProvider.ts`, `buildCompositionPlan.ts`, `ScoreOutput.tsx`, `CLAUDE.md` (combine both sides per the table).
6. **Port** maxim's workflow extras into `app/studio/page.tsx`; confirm a link to `/daw` exists there.
7. `npm install` (reconcile deps) → `npm run build` → `npm run lint` until green.
8. **Smoke test routes:** `/` (marketing), `/studio` (workflow, auth-disabled path), `/daw` (DAW: play, BPM, trim/split, mixer, ADSR), `/projects` + `/mix` if DB configured.
9. `git commit` → merge `merge/main-into-maxim` back into `maxim` → push. GitHub PR conflicts clear.

## Verification checklist
- [ ] `npm run build` passes (esp. `app/mix/[projectId]`, `useSaveMaster`, `app/studio` against maxim's `types/daw`).
- [ ] `npm run lint` introduces no new warnings.
- [ ] `/`, `/studio`, `/daw` all render; DAW features work; workflow→DAW link works.
- [ ] Music provider: no key → mock; key set → Music API; `sound-generation` opt-in still works.
- [ ] No dangling imports of `DAWWorkspace` or `app/page.tsx`.

## Open decision (governs everything)
See the question accompanying this plan: **which feature tracks do we keep?** The table above assumes *"main's infra + maxim's DAW"*. The alternatives (keep main's DAW and discard maxim's; or keep maxim-only and discard main's auth/persistence) change every row.
