# Plan — FL-style Clip Tools + In-Clip dB Waveform

Status: **IMPLEMENTED.** Confirmed decisions: **A** = inward trim + restore out to source bounds; **B** = Move/Slice tool toggle in the transport; **C** = monochrome dB bars.

Two features for the DAW arrangement (`/daw`):
1. **Clip manipulation** — trim clip edges (inward), and **snip/split** a clip into two.
2. **In-clip dB graphic** — a waveform drawn inside each clip rectangle showing where the audio is silent vs. peaking, so you can read the loudness contour at a glance.

---

## 1. Data model changes — `types/daw.ts`

`DAWClip` currently plays its source from `0` for `durationSeconds`. Trimming and splitting need a source in-point and the true source length:

```ts
export interface DAWClip {
  id: string;
  trackId: string;
  libraryItemId: string;
  audioUrl: string;
  label: string;
  color: string;
  startSeconds: number;          // position on the timeline (unchanged)
  durationSeconds: number;       // visible/played length (now trimmable)
  offsetSeconds: number;         // NEW — in-point within the source audio (0 = source start)
  sourceDurationSeconds: number; // NEW — full decoded length of the source (trim bound)
}
```

- On clip creation (`makeTrackFromItem`, `dropLibraryItemOnTrack`): `offsetSeconds = 0`, `sourceDurationSeconds = item.durationSeconds ?? DEFAULT_CLIP_DURATION`.
- Invariant: `0 ≤ offsetSeconds` and `offsetSeconds + durationSeconds ≤ sourceDurationSeconds`.

---

## 2. Playback scheduling — `hooks/useDAW.ts`

The source window a clip plays is `[offsetSeconds, offsetSeconds + durationSeconds]`. Fold `offsetSeconds` into the buffer read position (and keep working with the pitch-preserved stretched buffer, whose seconds = source seconds ÷ `rate`):

- **Clip ahead of play offset:**
  `src.start(startAt + (clipStart − playOffset)/rate, offsetSeconds/rate, durationSeconds/rate)`
- **Clip straddling the play offset (resume mid-clip):** add the elapsed amount to the buffer position:
  `bufferPos = (offsetSeconds + (playOffset − clipStart)) / rate`, duration = remaining ÷ rate.
- **Export (`exportMix`):** `src.start(clipStart/rate, offsetSeconds/rate, durationSeconds/rate)`.

No other engine changes; gains/mixer/effects untouched.

---

## 3. Trim handles (drag edges) — `components/daw/Arrangement.tsx` (`Clip`)

- Render two thin hit-zones (~6 px) at the clip's left and right edges, with `cursor: ew-resize`. The clip **body** keeps the existing move-drag; the handles `stopPropagation` so a trim never moves the clip.
- **Left handle** (trim start): dragging right moves the start in — `startSeconds += Δ`, `offsetSeconds += Δ`, `durationSeconds −= Δ` (right edge stays put).
- **Right handle** (trim end): dragging left moves the end in — `durationSeconds −= Δ` (start unchanged).
- **Constraints:** `durationSeconds ≥ MIN_CLIP (e.g. 0.1 s)`; `offsetSeconds ≥ 0`; `offsetSeconds + durationSeconds ≤ sourceDurationSeconds`. Trimmed edges **snap to the beat grid** (same `secondsPerBeat` rounding as move/drop).
- **Inward vs outward:** see Decision A below — default is inward-trim with restore allowed only up to the real source bounds (never past the actual audio).
- New `useDAW` handlers (immutable state update + `restartIfPlaying()` so playback reschedules):
  - `trimClipStart(clipId, newStartSeconds)` — recomputes start/offset/duration together.
  - `trimClipEnd(clipId, newDurationSeconds)`.

---

## 4. Snip / split a clip

- `splitClip(clipId, atProjectSeconds)` in `useDAW`: replaces the clip with two:
  - **A:** `start = clip.start`, `offset = clip.offset`, `duration = at − clip.start`.
  - **B:** `start = at`, `offset = clip.offset + (at − clip.start)`, `duration = clipEnd − at`.
  - Both keep `audioUrl / color / label / sourceDurationSeconds`; new ids. Guard against splits within `MIN_CLIP` of either edge.
- **UI trigger:** a **tool toggle** in the transport — *Move* (default) vs *Slice* (scissors icon). In Slice mode, clicking a clip splits it at the click X (snapped to grid); cursor becomes a crosshair. Right-click stays "delete clip". (See Decision B for alternatives.)
- Tool state (`'move' | 'slice'`) lives in `useDAW` and is passed to `Arrangement`/`Transport`.

---

## 5. In-clip dB waveform

### Peak data — new `lib/audio/waveform.ts`
- `getPeaks(audioUrl, buckets = 2000): Promise<Float32Array>` — fetches + `decodeAudioData` once per URL (reusing a shared decode `AudioContext`), reduces the source to `buckets` **peak-amplitude** values (max |sample| per bucket across channels), and caches the result in a module `Map<url, Float32Array>` (+ an in-flight promise map to dedupe). Cheap, computed once per source regardless of how many clips/zoom.

### Rendering inside the clip
- The `Clip` draws a `<canvas>` sized to the clip's pixel `width × height`, layered behind the label.
- It shows only the **trimmed window**: map `[offsetSeconds, offsetSeconds + durationSeconds] / sourceDurationSeconds` to a sub-range of the peak array, then draw one vertical bar per pixel column scaled by that column's peak.
- **dB read-out via height + colour:** convert peak → dB (`20·log10(peak)`), map `[−60 dB … 0 dB]` to bar height and a colour ramp so **silent ≈ flat baseline**, mids dim, and **peaks bright/hot** (e.g. clip colour → white/red near 0 dB). This makes "mute vs peak" obvious at a glance (see Decision C for the exact style).
- Redraw on change of `[peaks, offsetSeconds, durationSeconds, pxPerSecond, clipWidth]` via `useEffect`. Canvas (not SVG) for performance with many columns.
- Collapsed tracks (28 px) skip the waveform; only expanded clips draw it.

---

## 6. Files touched

| File | Change |
|---|---|
| `types/daw.ts` | `DAWClip` gains `offsetSeconds`, `sourceDurationSeconds` |
| `hooks/useDAW.ts` | offset-aware scheduling (play + export); `trimClipStart/End`, `splitClip`; `toolMode` state |
| `lib/audio/waveform.ts` | **new** — cached `getPeaks(url, buckets)` |
| `components/daw/Arrangement.tsx` | trim handles, slice-click, in-clip waveform `<canvas>` |
| `components/daw/Transport.tsx` | Move/Slice tool toggle |
| `app/daw/page.tsx` | wire new handlers + tool state |
| `CLAUDE.md` | document the above |

No new dependencies. Build + lint kept green; CLAUDE.md updated at the end.

---

## Open decisions (please confirm)

**A. Outward edge dragging.** You said "drag inwards, not outwards." Strict reading = edges can *only* shrink (no way to undo a trim by dragging). Most DAWs let you drag back **out only up to the real source length** (restoring trimmed-off audio) but never beyond it (no looping/stretch). Which do you want?
- *(Recommended)* Inward trim + restore out only up to the actual source bounds.
- Strictly inward-only (a trim can't be dragged back; re-add the clip to reset).

**B. Split UX.** How should snipping be triggered?
- *(Recommended)* Move/Slice tool toggle in the transport; click a clip in Slice mode to cut at the click.
- "Split at playhead" button/shortcut (cuts every clip under the playhead).
- Right-click menu on the clip ("Split here" / "Delete").

**C. Waveform style.** 
- *(Recommended)* Filled peak waveform, colour-graded by dB (silent = flat, peaks = hot colour).
- Simple monochrome bars (height only, no colour ramp).
- Peak outline + RMS (loudness) fill overlaid.
