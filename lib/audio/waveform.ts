// Cached peak-amplitude extraction for in-clip waveforms.
// Each source URL is fetched + decoded once and reduced to a fixed-size array of
// peak (max |sample|) values across the whole source; clips draw a windowed slice.

const DEFAULT_BUCKETS = 2000;

const cache = new Map<string, Float32Array>();
const inflight = new Map<string, Promise<Float32Array>>();

let sharedCtx: AudioContext | null = null;
function decodeCtx(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext();
  return sharedCtx;
}

function computePeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const channels = buffer.numberOfChannels;
  const len = buffer.length;
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));

  const block = Math.max(1, Math.floor(len / buckets));
  const peaks = new Float32Array(buckets);
  for (let b = 0; b < buckets; b++) {
    const start = b * block;
    const end = Math.min(len, start + block);
    let max = 0;
    for (let i = start; i < end; i++) {
      for (let c = 0; c < channels; c++) {
        const v = Math.abs(data[c][i]);
        if (v > max) max = v;
      }
    }
    peaks[b] = max;
  }
  return peaks;
}

/** Returns cached peak amplitudes (0..1) for the whole source. Deduped + cached. */
export function getPeaks(audioUrl: string, buckets = DEFAULT_BUCKETS): Promise<Float32Array> {
  const key = `${audioUrl}@${buckets}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    try {
      const res = await fetch(audioUrl);
      const ab = await res.arrayBuffer();
      const buf = await decodeCtx().decodeAudioData(ab);
      const peaks = computePeaks(buf, buckets);
      cache.set(key, peaks);
      return peaks;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, job);
  return job;
}
