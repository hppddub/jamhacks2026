declare module 'soundtouchjs' {
  /** Core time-stretch / pitch-shift processor. */
  export class SoundTouch {
    tempo: number;          // >1 = faster/shorter, <1 = slower/longer
    pitch: number;          // 1 = unchanged pitch
    rate: number;
    pitchSemitones: number;
    clear(): void;
  }

  /** Wraps an AudioBuffer as a SoundTouch sample source (interleaved stereo). */
  export class WebAudioBufferSource {
    constructor(buffer: AudioBuffer);
    extract(target: Float32Array, numFrames: number, position?: number): number;
  }

  /** Pulls processed frames out of a source through a SoundTouch pipe. */
  export class SimpleFilter {
    constructor(source: WebAudioBufferSource, pipe: SoundTouch);
    extract(target: Float32Array, numFrames: number): number;
    sourcePosition: number;
  }

  export class PitchShifter {
    constructor(context: AudioContext, buffer: AudioBuffer, bufferSize?: number);
    tempo: number;
    pitch: number;
    connect(node: AudioNode): void;
    disconnect(): void;
  }
}
