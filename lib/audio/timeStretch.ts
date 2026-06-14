import { SoundTouch, SimpleFilter, WebAudioBufferSource } from 'soundtouchjs';

/**
 * Pitch-preserving time-stretch. Renders a new AudioBuffer whose length is
 * `original / tempo` (tempo > 1 = faster/shorter) while keeping the original
 * pitch, using the SoundTouch algorithm offline.
 *
 * `tempo ≈ 1` returns the original buffer untouched (no work, no allocation).
 * Works with any BaseAudioContext (online or OfflineAudioContext) — only used
 * for its `createBuffer`.
 */
export function stretchAudioBuffer(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  tempo: number,
): AudioBuffer {
  if (!Number.isFinite(tempo) || Math.abs(tempo - 1) < 0.001) return buffer;

  const st = new SoundTouch();
  st.tempo = tempo;   // time-stretch factor
  st.pitch = 1;       // preserve pitch

  const source = new WebAudioBufferSource(buffer);
  const filter = new SimpleFilter(source, st);

  const channels = buffer.numberOfChannels;
  const outLength = Math.max(1, Math.floor(buffer.length / tempo));
  const out = ctx.createBuffer(channels, outLength, buffer.sampleRate);
  const left = out.getChannelData(0);
  const right = channels > 1 ? out.getChannelData(1) : null;

  const BLOCK = 8192;
  const interleaved = new Float32Array(BLOCK * 2);
  let outPos = 0;
  let frames = 0;

  while (outPos < outLength && (frames = filter.extract(interleaved, BLOCK)) > 0) {
    for (let i = 0; i < frames && outPos < outLength; i++, outPos++) {
      left[outPos] = interleaved[i * 2];
      if (right) right[outPos] = interleaved[i * 2 + 1];
    }
  }

  return out;
}
