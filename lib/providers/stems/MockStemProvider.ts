import path from 'path';
import type { StemSeparationProvider } from './types';
import type { Stem, StemId, StemResult } from '@/types';
import { generateStemMp3 } from '@/lib/audio/generateTone';
import type { StemConfig } from '@/lib/audio/generateTone';
import { generateId, delay } from '@/lib/utils';

// Fixed musical parameters for each stem — deterministic, no analysis object needed
const STEM_CONFIGS: Record<StemId, Omit<StemConfig, 'durationSeconds' | 'bpm'>> = {
  drums:  { frequency: 80,     amplitude: 0.55, pattern: 'percussive' },
  bass:   { frequency: 65.41,  amplitude: 0.50, pattern: 'continuous' },
  melody: { frequency: 261.63, amplitude: 0.40, pattern: 'continuous' },
  vocals: { frequency: 392.00, amplitude: 0.08, pattern: 'sparse'     },
};

const STEM_LABELS: Record<StemId, string> = {
  drums:  'Drums & Percussion',
  bass:   'Bass',
  melody: 'Melody & Harmony',
  vocals: 'Vocals',
};

const STEM_ORDER: StemId[] = ['drums', 'bass', 'melody', 'vocals'];
const MOCK_BPM = 100;
const MOCK_DURATION = 20;

export class MockStemProvider implements StemSeparationProvider {
  async separate(sourceAudioUrl: string): Promise<StemResult> {
    const jobId = generateId();
    const outputDir = path.join(process.cwd(), 'public', 'stems', jobId);

    const stems: Stem[] = STEM_ORDER.map((id) => {
      const cfg = STEM_CONFIGS[id];
      const outputPath = path.join(outputDir, `${id}.mp3`);
      generateStemMp3(
        { ...cfg, durationSeconds: MOCK_DURATION, bpm: MOCK_BPM },
        outputPath
      );
      return { id, label: STEM_LABELS[id], audioUrl: `/stems/${jobId}/${id}.mp3` };
    });

    // Simulate processing latency after synthesis
    await delay(2000 + Math.random() * 1500);

    return { jobId, stems, sourceAudioUrl };
  }
}
