import fs from 'fs';
import path from 'path';
import type { StemSeparationProvider } from './types';
import type { Stem, StemId, StemResult } from '@/types';
import { generateId, delay } from '@/lib/utils';

// Find the current version hash at: https://replicate.com/lucataco/demucs
// Set REPLICATE_MODEL_VERSION in .env.local to override.
const DEFAULT_MODEL_VERSION = process.env.REPLICATE_MODEL_VERSION ?? '';

const STEM_LABELS: Record<string, string> = {
  drums:  'Drums & Percussion',
  bass:   'Bass',
  other:  'Melody & Harmony',
  vocals: 'Vocals',
};

// Replicate returns 'other' for the non-drums/bass/vocals content; we surface it as 'melody'
const REPLICATE_KEY_TO_STEM_ID: Record<string, StemId> = {
  drums:  'drums',
  bass:   'bass',
  other:  'melody',
  vocals: 'vocals',
};

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: Record<string, string>;
  error?: string;
  urls: { get: string };
}

export class ReplicateProvider implements StemSeparationProvider {
  private readonly apiKey: string;
  private readonly modelVersion: string;

  constructor() {
    const apiKey = process.env.REPLICATE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'REPLICATE_API_KEY is not set. Add it to .env.local or set STEM_PROVIDER=mock to use the mock provider.'
      );
    }
    if (!DEFAULT_MODEL_VERSION) {
      throw new Error(
        'REPLICATE_MODEL_VERSION is not set. Find the current demucs version hash at https://replicate.com/lucataco/demucs and add it to .env.local.'
      );
    }
    this.apiKey = apiKey;
    this.modelVersion = DEFAULT_MODEL_VERSION;
  }

  async separate(sourceAudioUrl: string): Promise<StemResult> {
    // Read local MP3 and encode as base64 data URI so Replicate can access it from any environment
    const localPath = path.join(process.cwd(), 'public', sourceAudioUrl);
    const fileBuffer = fs.readFileSync(localPath);
    const dataUri = `data:audio/mpeg;base64,${fileBuffer.toString('base64')}`;

    const prediction = await this.createPrediction(dataUri);
    const completed = await this.pollUntilDone(prediction);

    if (completed.status !== 'succeeded' || !completed.output) {
      throw new Error(
        `Replicate stem separation failed (status: ${completed.status}). ${completed.error ?? ''}`
      );
    }

    const jobId = generateId();
    const outputDir = path.join(process.cwd(), 'public', 'stems', jobId);
    fs.mkdirSync(outputDir, { recursive: true });

    const stems: Stem[] = [];
    for (const [replicateKey, stemUrl] of Object.entries(completed.output)) {
      const stemId = REPLICATE_KEY_TO_STEM_ID[replicateKey];
      if (!stemId) continue;

      const response = await fetch(stemUrl);
      if (!response.ok) throw new Error(`Failed to download ${replicateKey} stem from Replicate.`);
      const arrayBuf = await response.arrayBuffer();
      fs.writeFileSync(path.join(outputDir, `${stemId}.mp3`), Buffer.from(arrayBuf));

      stems.push({
        id: stemId,
        label: STEM_LABELS[replicateKey] ?? stemId,
        audioUrl: `/stems/${jobId}/${stemId}.mp3`,
      });
    }

    // Return stems in canonical order
    const ORDER: StemId[] = ['drums', 'bass', 'melody', 'vocals'];
    stems.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

    return { jobId, stems, sourceAudioUrl };
  }

  private async createPrediction(audioDataUri: string): Promise<ReplicatePrediction> {
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: this.modelVersion,
        input: { audio: audioDataUri, stem: 'none', shifts: 1, overlap: 0.25, mp3_bitrate: 128 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Replicate prediction creation failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<ReplicatePrediction>;
  }

  private async pollUntilDone(prediction: ReplicatePrediction): Promise<ReplicatePrediction> {
    const maxAttempts = 60; // 60 × 3s = 3 minutes
    let current = prediction;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (current.status === 'succeeded' || current.status === 'failed' || current.status === 'canceled') {
        return current;
      }
      await delay(3000);
      const res = await fetch(current.urls.get, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) throw new Error(`Replicate polling failed (${res.status}).`);
      current = await res.json() as ReplicatePrediction;
    }

    throw new Error('Replicate stem separation timed out after 3 minutes.');
  }
}
