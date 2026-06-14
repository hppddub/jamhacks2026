import type { MixSession, MixTrack, Project, StemId } from '@/types';
import type { DAWLibraryItem } from '@/types/daw';
import { STEM_LABELS } from '@/lib/projects/serialize';

const STEM_ORDER: StemId[] = ['drums', 'bass', 'melody', 'vocals'];

// Stem track colors, mirrored from StemPlayer's STEM_STYLE so the mixer matches
// the colors users see when the stems are presented in the player.
const STEM_COLORS: Record<string, string> = {
  drums: '#ee4444',
  bass: '#6EA556',
  melody: '#FFCC18',
  vocals: '#7CA0CB',
};

/**
 * Builds the handoff contract the (future) mixing/mastering stage consumes from a
 * saved project: every audible track (generated score, stems, original audio) plus
 * the musical metadata (bpm, key, duration). No DSP — just wiring data + file URLs.
 */
export function buildMixSession(project: Project): MixSession {
  const tracks: MixTrack[] = [];

  const score = project.files.find((f) => f.kind === 'score');
  if (score) {
    tracks.push({ id: 'score', label: 'Generated Score', kind: 'score', url: score.url });
  }

  for (const stemId of STEM_ORDER) {
    const file = project.files.find((f) => f.kind === 'stem' && f.stemId === stemId);
    if (file) {
      tracks.push({ id: stemId, label: STEM_LABELS[stemId], kind: 'stem', url: file.url });
    }
  }

  const original = project.files.find((f) => f.kind === 'original_audio');
  if (original) {
    tracks.push({ id: 'original', label: 'Original Audio', kind: 'original', url: original.url });
  }

  return {
    projectId: project.id,
    bpm: project.bpm ?? project.score.bpm,
    keyMode: project.analysis.analysis.keyMode,
    durationSeconds: project.durationSeconds ?? project.score.durationSeconds,
    tracks,
  };
}

/** Adapts a MixSession's tracks into the DAW's seed library items. */
export function mixSessionToDAWSeed(session: MixSession): DAWLibraryItem[] {
  return session.tracks.map((t): DAWLibraryItem => {
    if (t.kind === 'stem') {
      return { id: `stem-${t.id}`, label: t.label, group: 'stems', audioUrl: t.url, color: STEM_COLORS[t.id] ?? '#7ca0cb' };
    }
    if (t.kind === 'original') {
      return { id: 'original', label: t.label, group: 'original', audioUrl: t.url, color: '#7CA0CB' };
    }
    return { id: 'score', label: t.label, group: 'score', audioUrl: t.url, color: '#ffcc18' };
  });
}
