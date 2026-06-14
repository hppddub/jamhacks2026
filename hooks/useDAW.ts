'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateId } from '@/lib/utils';
import {
  buildMixGraph, defaultEffectParams, insertActive, trackActive,
  type BuiltInsert,
} from '@/lib/audio/dawGraph';
import { stretchAudioBuffer } from '@/lib/audio/timeStretch';
import type {
  DAWClip, DAWLibraryItem, DAWProject, DAWTrack, DAWTransportState,
  EffectType, MixerInsert,
} from '@/types/daw';

const DEFAULT_BPM = 120;
const DEFAULT_CLIP_DURATION = 30;
const MIN_TOTAL_DURATION = 60;
const LOOKAHEAD = 0.06; // s — schedule slightly ahead so the clock and audio align
const REFERENCE_BPM = 120; // BPM at which playback runs at native speed (rate 1.0)

/** BPM → playback-rate multiplier (higher BPM = faster). */
function bpmToRate(bpm: number): number {
  return Math.max(0.25, Math.min(4, bpm / REFERENCE_BPM));
}

function makeInitialInserts(): MixerInsert[] {
  const inserts: MixerInsert[] = [
    { id: 'master', name: 'Master', volume: 1, pan: 0, muted: false, solo: false, effects: [] },
  ];
  for (let i = 1; i <= 4; i++) {
    inserts.push({ id: generateId(), name: `Insert ${i}`, volume: 1, pan: 0, muted: false, solo: false, effects: [] });
  }
  return inserts;
}

function makeTrackFromItem(item: DAWLibraryItem): DAWTrack {
  const trackId = generateId();
  const clip: DAWClip = {
    id: generateId(),
    trackId,
    libraryItemId: item.id,
    audioUrl: item.audioUrl,
    label: item.label,
    color: item.color,
    startSeconds: 0,
    durationSeconds: item.durationSeconds ?? DEFAULT_CLIP_DURATION,
  };
  return {
    id: trackId,
    name: item.label,
    color: item.color,
    muted: false, solo: false, collapsed: false, volume: 1,
    insertId: 'master',
    clips: [clip],
  };
}

function computeTotalDuration(tracks: DAWTrack[]): number {
  let max = MIN_TOTAL_DURATION;
  for (const t of tracks) {
    for (const c of t.clips) max = Math.max(max, c.startSeconds + c.durationSeconds);
  }
  return max + 10;
}

function loadDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => resolve(isFinite(a.duration) && a.duration > 0 ? a.duration : DEFAULT_CLIP_DURATION);
    a.onerror = () => resolve(DEFAULT_CLIP_DURATION);
    a.src = url;
  });
}

async function ensureBuffer(url: string, ctx: AudioContext, cache: Map<string, AudioBuffer>): Promise<AudioBuffer | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  try {
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab);
    cache.set(url, buf);
    return buf;
  } catch {
    return null;
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const blockAlign = numCh * 2;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const ws = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); ws(8, 'WAVE');
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * blockAlign, true); v.setUint16(32, blockAlign, true);
  v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(off, s < 0 ? s * 32768 : s * 32767, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function useDAW(initialItems: DAWLibraryItem[]) {
  const [project, setProject] = useState<DAWProject>(() => ({
    tracks: [],
    inserts: makeInitialInserts(),
    bpm: DEFAULT_BPM,
    totalDurationSeconds: MIN_TOTAL_DURATION,
  }));
  const [transport, setTransport] = useState<DAWTransportState>('stopped');
  const [currentTime, setCurrentTime] = useState(0);
  const [pxPerSecond, setPxPerSecond] = useState(80);
  const [exportOpen, setExportOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [selectedInsertId, setSelectedInsertId] = useState<string>('master');
  const [loadingAudio, setLoadingAudio] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const stretchedBuffersRef = useRef<Map<string, AudioBuffer>>(new Map()); // keyed `url@rate`
  const clipSourcesRef = useRef<Map<string, AudioBufferSourceNode[]>>(new Map());
  const trackGainsRef = useRef<Map<string, GainNode>>(new Map());
  const insertsRef = useRef<Map<string, BuiltInsert>>(new Map());
  const playStartCtxRef = useRef(0);
  const playStartOffsetRef = useRef(0);
  const playRateRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const projectRef = useRef(project);
  const transportRef = useRef<DAWTransportState>('stopped');

  useEffect(() => { projectRef.current = project; }, [project]);
  // transportRef is also set imperatively in play/pause/stop so the RAF loop
  // never races a not-yet-committed effect; this effect is just a safety sync.
  useEffect(() => { transportRef.current = transport; }, [transport]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  /** Resolve the playable buffer for a clip at the current rate (pitch-preserved stretch, cached). */
  const getPlayBuffer = useCallback((url: string, rate: number): AudioBuffer | null => {
    const orig = buffersRef.current.get(url);
    if (!orig) return null;
    if (Math.abs(rate - 1) < 0.001) return orig;
    const key = `${url}@${rate.toFixed(3)}`;
    const cached = stretchedBuffersRef.current.get(key);
    if (cached) return cached;
    const ctx = audioCtxRef.current;
    if (!ctx) return orig;
    const stretched = stretchAudioBuffer(ctx, orig, rate);
    stretchedBuffersRef.current.set(key, stretched);
    return stretched;
  }, []);

  // Build initial tracks from library items (durations loaded async)
  useEffect(() => {
    if (initialItems.length === 0) return;
    let cancelled = false;
    (async () => {
      const withDur = await Promise.all(
        initialItems.map(async (item) => ({ ...item, durationSeconds: await loadDuration(item.audioUrl) }))
      );
      if (cancelled) return;
      const tracks = withDur.map(makeTrackFromItem);
      setProject(prev => ({ ...prev, tracks, totalDurationSeconds: computeTotalDuration(tracks) }));
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const startRaf = useCallback(() => {
    const tick = () => {
      const ctx = audioCtxRef.current;
      if (!ctx || transportRef.current !== 'playing') return;
      // Clock advances at rate × wall-time so the ruler stays in project seconds.
      const t = (ctx.currentTime - playStartCtxRef.current) * playRateRef.current + playStartOffsetRef.current;
      const total = projectRef.current.totalDurationSeconds;
      if (t >= total) {
        stopRaf();
        transportRef.current = 'stopped';
        setTransport('stopped');
        setCurrentTime(0);
        currentTimeRef.current = 0;
        return;
      }
      const clamped = Math.max(0, t);
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopRaf]);

  const stopAllSources = useCallback(() => {
    for (const sources of clipSourcesRef.current.values()) {
      for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } }
    }
    clipSourcesRef.current.clear();
  }, []);

  // Recompute every track + insert gain from current project state (live).
  const refreshGains = useCallback(() => {
    const proj = projectRef.current;
    const anyTrackSolo = proj.tracks.some(t => t.solo);
    for (const t of proj.tracks) {
      const g = trackGainsRef.current.get(t.id);
      if (g) g.gain.value = trackActive(t.muted, t.solo, anyTrackSolo) ? t.volume : 0;
    }
    const anyInsertSolo = proj.inserts.some(i => i.solo && i.id !== 'master');
    for (const ins of proj.inserts) {
      const bi = insertsRef.current.get(ins.id);
      if (!bi) continue;
      const active = ins.id === 'master' ? !ins.muted : insertActive(ins, anyInsertSolo);
      bi.volume.gain.value = active ? ins.volume : 0;
      bi.panner.pan.value = ins.pan;
    }
  }, []);

  const play = useCallback(async () => {
    const proj = projectRef.current;
    const offset = currentTimeRef.current;
    const rate = bpmToRate(proj.bpm);

    setLoadingAudio(true);
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    const urls = new Set<string>();
    for (const track of proj.tracks) for (const clip of track.clips) urls.add(clip.audioUrl);
    await Promise.all([...urls].map(u => ensureBuffer(u, ctx, buffersRef.current)));
    // Yield once so the loading state can paint before any (CPU-heavy) time-stretch.
    if (Math.abs(rate - 1) >= 0.001) await new Promise(r => setTimeout(r, 0));
    setLoadingAudio(false);

    stopAllSources();

    const startAt = ctx.currentTime + LOOKAHEAD;

    // Build mixer graph (master + inserts + effects); tempo-synced envelopes anchor to startAt.
    const { inserts } = buildMixGraph(ctx, proj, { startTime: startAt });
    insertsRef.current = inserts;

    // Build per-track gains, route to assigned insert
    trackGainsRef.current.clear();
    const anyTrackSolo = proj.tracks.some(t => t.solo);
    const masterInsert = inserts.get('master');
    for (const track of proj.tracks) {
      const g = ctx.createGain();
      g.gain.value = trackActive(track.muted, track.solo, anyTrackSolo) ? track.volume : 0;
      const target = inserts.get(track.insertId) ?? masterInsert;
      g.connect(target ? target.input : ctx.destination);
      trackGainsRef.current.set(track.id, g);
    }

    playStartCtxRef.current = startAt;
    playStartOffsetRef.current = offset;
    playRateRef.current = rate;

    for (const track of proj.tracks) {
      const g = trackGainsRef.current.get(track.id);
      if (!g) continue;
      for (const clip of track.clips) {
        // Pitch-preserved buffer at the current tempo; its real length = clipDuration / rate.
        const buf = getPlayBuffer(clip.audioUrl, rate);
        if (!buf) continue;
        const clipEnd = clip.startSeconds + clip.durationSeconds;
        if (clipEnd <= offset) continue;

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(g);
        // Real (wall-clock) seconds = project seconds / rate.
        if (clip.startSeconds >= offset) {
          src.start(startAt + (clip.startSeconds - offset) / rate, 0, clip.durationSeconds / rate);
        } else {
          const trimProj = offset - clip.startSeconds;
          const remainingProj = clip.durationSeconds - trimProj;
          if (remainingProj > 0) src.start(startAt, trimProj / rate, remainingProj / rate);
        }
        const arr = clipSourcesRef.current.get(clip.id) ?? [];
        arr.push(src);
        clipSourcesRef.current.set(clip.id, arr);
      }
    }

    transportRef.current = 'playing'; // set before RAF so the loop doesn't bail on frame 1
    setTransport('playing');
    startRaf();
  }, [stopAllSources, startRaf, getPlayBuffer]);

  const pause = useCallback(() => {
    stopRaf();
    stopAllSources();
    audioCtxRef.current?.suspend();
    transportRef.current = 'paused';
    setTransport('paused');
  }, [stopRaf, stopAllSources]);

  const stop = useCallback(() => {
    stopRaf();
    stopAllSources();
    audioCtxRef.current?.suspend();
    transportRef.current = 'stopped';
    setTransport('stopped');
    setCurrentTime(0);
    currentTimeRef.current = 0;
  }, [stopRaf, stopAllSources]);

  const seek = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(t, projectRef.current.totalDurationSeconds));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    if (transportRef.current === 'playing') {
      stopRaf();
      stopAllSources();
      transportRef.current = 'paused';
      setTransport('paused');
      setTimeout(() => play(), 0);
    }
  }, [stopRaf, stopAllSources, play]);

  // Restart playback in place (after a structural graph / tempo change while playing).
  const restartIfPlaying = useCallback(() => {
    if (transportRef.current !== 'playing') return;
    stopRaf();
    stopAllSources();
    transportRef.current = 'paused';
    setTransport('paused');
    setTimeout(() => play(), 0);
  }, [stopRaf, stopAllSources, play]);

  // ── Track ops ────────────────────────────────────────────────────────────────

  const toggleMute = useCallback((trackId: string) => {
    setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t) }));
  }, []);
  const toggleSolo = useCallback((trackId: string) => {
    setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === trackId ? { ...t, solo: !t.solo } : t) }));
  }, []);
  const toggleCollapse = useCallback((trackId: string) => {
    setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === trackId ? { ...t, collapsed: !t.collapsed } : t) }));
  }, []);
  const setTrackVolume = useCallback((trackId: string, vol: number) => {
    setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === trackId ? { ...t, volume: vol } : t) }));
  }, []);
  const setTrackInsert = useCallback((trackId: string, insertId: string) => {
    setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === trackId ? { ...t, insertId } : t) }));
    restartIfPlaying();
  }, [restartIfPlaying]);

  // Apply live gain changes whenever mute/solo/volume/pan state changes
  useEffect(() => { refreshGains(); }, [project.tracks, project.inserts, refreshGains]);

  const addTrackFromLibrary = useCallback((item: DAWLibraryItem) => {
    setProject(prev => {
      const tracks = [...prev.tracks, makeTrackFromItem(item)];
      return { ...prev, tracks, totalDurationSeconds: computeTotalDuration(tracks) };
    });
  }, []);

  const removeTrack = useCallback((trackId: string) => {
    // Stop any live audio for this track's clips immediately
    const track = projectRef.current.tracks.find(t => t.id === trackId);
    if (track) {
      for (const clip of track.clips) {
        const arr = clipSourcesRef.current.get(clip.id);
        if (arr) { for (const s of arr) { try { s.stop(); } catch {} } clipSourcesRef.current.delete(clip.id); }
      }
    }
    trackGainsRef.current.delete(trackId);
    setProject(prev => {
      const tracks = prev.tracks.filter(t => t.id !== trackId);
      return { ...prev, tracks, totalDurationSeconds: computeTotalDuration(tracks) };
    });
  }, []);

  const moveClip = useCallback((clipId: string, newStartSeconds: number) => {
    setProject(prev => {
      const tracks = prev.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => c.id === clipId ? { ...c, startSeconds: Math.max(0, newStartSeconds) } : c),
      }));
      return { ...prev, tracks, totalDurationSeconds: computeTotalDuration(tracks) };
    });
    restartIfPlaying();
  }, [restartIfPlaying]);

  const deleteClip = useCallback((clipId: string) => {
    // Immediately stop the clip's live audio
    const arr = clipSourcesRef.current.get(clipId);
    if (arr) { for (const s of arr) { try { s.stop(); } catch {} } clipSourcesRef.current.delete(clipId); }
    setProject(prev => {
      const tracks = prev.tracks.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== clipId) }));
      return { ...prev, tracks, totalDurationSeconds: computeTotalDuration(tracks) };
    });
  }, []);

  const dropLibraryItemOnTrack = useCallback((item: DAWLibraryItem, trackId: string, startSeconds: number) => {
    setProject(prev => {
      const clip: DAWClip = {
        id: generateId(), trackId, libraryItemId: item.id, audioUrl: item.audioUrl,
        label: item.label, color: item.color,
        startSeconds: Math.max(0, startSeconds),
        durationSeconds: item.durationSeconds ?? DEFAULT_CLIP_DURATION,
      };
      const tracks = prev.tracks.map(t => t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t);
      return { ...prev, tracks, totalDurationSeconds: computeTotalDuration(tracks) };
    });
  }, []);

  const setBpm = useCallback((bpm: number) => {
    setProject(prev => ({ ...prev, bpm: Math.max(40, Math.min(240, bpm)) }));
    // Re-render the stretched buffers at the new tempo and resume in place.
    restartIfPlaying();
  }, [restartIfPlaying]);

  const zoomIn = useCallback(() => setPxPerSecond(z => Math.min(400, z * 1.5)), []);
  const zoomOut = useCallback(() => setPxPerSecond(z => Math.max(20, z / 1.5)), []);

  // ── Mixer ops ────────────────────────────────────────────────────────────────

  const setInsertVolume = useCallback((insertId: string, vol: number) => {
    setProject(prev => ({ ...prev, inserts: prev.inserts.map(i => i.id === insertId ? { ...i, volume: vol } : i) }));
  }, []);
  const setInsertPan = useCallback((insertId: string, pan: number) => {
    setProject(prev => ({ ...prev, inserts: prev.inserts.map(i => i.id === insertId ? { ...i, pan } : i) }));
  }, []);
  const toggleInsertMute = useCallback((insertId: string) => {
    setProject(prev => ({ ...prev, inserts: prev.inserts.map(i => i.id === insertId ? { ...i, muted: !i.muted } : i) }));
  }, []);
  const toggleInsertSolo = useCallback((insertId: string) => {
    setProject(prev => ({ ...prev, inserts: prev.inserts.map(i => i.id === insertId ? { ...i, solo: !i.solo } : i) }));
  }, []);
  const addInsert = useCallback(() => {
    setProject(prev => {
      const n = prev.inserts.filter(i => i.id !== 'master').length + 1;
      const insert: MixerInsert = { id: generateId(), name: `Insert ${n}`, volume: 1, pan: 0, muted: false, solo: false, effects: [] };
      return { ...prev, inserts: [...prev.inserts, insert] };
    });
  }, []);

  const addEffect = useCallback((insertId: string, type: EffectType) => {
    setProject(prev => ({
      ...prev,
      inserts: prev.inserts.map(i => i.id === insertId
        ? { ...i, effects: [...i.effects, { id: generateId(), type, enabled: true, params: defaultEffectParams(type) }] }
        : i),
    }));
    restartIfPlaying();
  }, [restartIfPlaying]);

  const removeEffect = useCallback((insertId: string, effectId: string) => {
    setProject(prev => ({
      ...prev,
      inserts: prev.inserts.map(i => i.id === insertId ? { ...i, effects: i.effects.filter(e => e.id !== effectId) } : i),
    }));
    restartIfPlaying();
  }, [restartIfPlaying]);

  const toggleEffect = useCallback((insertId: string, effectId: string) => {
    setProject(prev => ({
      ...prev,
      inserts: prev.inserts.map(i => i.id === insertId
        ? { ...i, effects: i.effects.map(e => e.id === effectId ? { ...e, enabled: !e.enabled } : e) }
        : i),
    }));
    restartIfPlaying();
  }, [restartIfPlaying]);

  const updateEffectParam = useCallback((insertId: string, effectId: string, key: string, value: number) => {
    setProject(prev => {
      const inserts = prev.inserts.map(i => {
        if (i.id !== insertId) return i;
        return { ...i, effects: i.effects.map(e => e.id === effectId ? { ...e, params: { ...e.params, [key]: value } } : e) };
      });
      // Live-update the running effect node, if any
      const insert = inserts.find(i => i.id === insertId);
      const eff = insert?.effects.find(e => e.id === effectId);
      const built = insertsRef.current.get(insertId)?.effects.get(effectId);
      if (eff && built) built.update(eff.params);
      return { ...prev, inserts };
    });
  }, []);

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportMix = useCallback(async () => {
    const proj = projectRef.current;
    const sr = 44100;
    const rate = bpmToRate(proj.bpm);
    // Rendered timeline is compressed/expanded by the tempo.
    const totalSamples = Math.ceil((proj.totalDurationSeconds / rate) * sr);
    const offCtx = new OfflineAudioContext(2, totalSamples, sr);

    const { inserts } = buildMixGraph(offCtx, proj);
    const masterInsert = inserts.get('master');
    const anyTrackSolo = proj.tracks.some(t => t.solo);

    for (const track of proj.tracks) {
      const g = offCtx.createGain();
      g.gain.value = trackActive(track.muted, track.solo, anyTrackSolo) ? track.volume : 0;
      const target = inserts.get(track.insertId) ?? masterInsert;
      g.connect(target ? target.input : offCtx.destination);

      for (const clip of track.clips) {
        let orig = buffersRef.current.get(clip.audioUrl);
        if (!orig) {
          try {
            const res = await fetch(clip.audioUrl);
            const ab = await res.arrayBuffer();
            const tmp = new AudioContext({ sampleRate: sr });
            orig = await tmp.decodeAudioData(ab);
            await tmp.close();
            buffersRef.current.set(clip.audioUrl, orig);
          } catch { continue; }
        }
        const buf = stretchAudioBuffer(offCtx, orig, rate); // pitch-preserved at tempo
        const src = offCtx.createBufferSource();
        src.buffer = buf;
        src.connect(g);
        src.start(clip.startSeconds / rate, 0, clip.durationSeconds / rate);
      }
    }

    const rendered = await offCtx.startRendering();
    triggerDownload(audioBufferToWav(rendered), 'bananamov-mix.wav');
  }, []);

  const exportTrack = useCallback(async (trackId: string) => {
    const track = projectRef.current.tracks.find(t => t.id === trackId);
    if (!track || track.clips.length === 0) return;
    const clip = track.clips[0];
    const res = await fetch(clip.audioUrl);
    const blob = await res.blob();
    triggerDownload(blob, `${track.name.toLowerCase().replace(/\s+/g, '-')}.mp3`);
  }, []);

  const saveProject = useCallback(() => {
    triggerDownload(new Blob([JSON.stringify(projectRef.current, null, 2)], { type: 'application/json' }), 'bananamov-project.json');
  }, []);

  useEffect(() => {
    return () => {
      stopRaf();
      stopAllSources();
      audioCtxRef.current?.close();
    };
  }, [stopRaf, stopAllSources]);

  return {
    project, transport, currentTime, pxPerSecond, loadingAudio,
    exportOpen, setExportOpen, mixerOpen, setMixerOpen,
    selectedInsertId, setSelectedInsertId,
    // transport
    play, pause, stop, seek, setBpm, zoomIn, zoomOut,
    // tracks
    addTrackFromLibrary, removeTrack, toggleMute, toggleSolo, toggleCollapse,
    setTrackVolume, setTrackInsert, moveClip, deleteClip, dropLibraryItemOnTrack,
    // mixer
    setInsertVolume, setInsertPan, toggleInsertMute, toggleInsertSolo, addInsert,
    addEffect, removeEffect, toggleEffect, updateEffectParam,
    // export
    exportMix, exportTrack, saveProject,
  };
}
