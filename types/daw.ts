export type DAWLibraryGroup = 'score' | 'stems' | 'original' | 'imported';

export interface DAWLibraryItem {
  id: string;
  label: string;
  group: DAWLibraryGroup;
  audioUrl: string;
  color: string;
  durationSeconds?: number;
}

export interface DAWClip {
  id: string;
  trackId: string;
  libraryItemId: string;
  audioUrl: string;
  label: string;
  color: string;
  startSeconds: number;          // position on the arrangement timeline
  durationSeconds: number;       // visible/played length (trimmable)
  offsetSeconds: number;         // in-point within the source audio (0 = source start)
  sourceDurationSeconds: number; // full decoded length of the source (trim bound)
}

export type DAWToolMode = 'move' | 'slice';

export interface DAWTrack {
  id: string;
  name: string;
  color: string;
  muted: boolean;
  solo: boolean;
  collapsed: boolean;
  volume: number;
  insertId: string;        // mixer insert this track is routed to ('master' by default)
  clips: DAWClip[];
}

// ─── Mixer ────────────────────────────────────────────────────────────────────

export type EffectType = 'eq' | 'reverb' | 'delay' | 'compressor' | 'distortion' | 'filter-adsr';

export interface Effect {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: Record<string, number>;
}

export interface MixerInsert {
  id: string;              // 'master' for the master strip
  name: string;
  volume: number;          // 0..1.5
  pan: number;             // -1..1
  muted: boolean;
  solo: boolean;
  effects: Effect[];
}

export interface DAWProject {
  tracks: DAWTrack[];
  inserts: MixerInsert[];
  bpm: number;
  totalDurationSeconds: number;
}

export type DAWTransportState = 'stopped' | 'playing' | 'paused';
