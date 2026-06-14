import fs from 'fs';
import path from 'path';
import type { MusicGenerationProvider } from '../types';
import type { AnalysisResult, GeneratedScore, ScoreSection } from '@/types';
import { buildCompositionPlan } from './buildCompositionPlan';
import { buildBackendPrompt } from './buildPrompt';
import { generateId } from '@/lib/utils';

const ELEVENLABS_MUSIC_API = 'https://api.elevenlabs.io/v1/music';
const OUTPUT_FORMAT = 'mp3_44100_128';
const MODEL_ID = 'music_v1';

/**
 * Generates a music score via the ElevenLabs Music API (`POST /v1/music`).
 *
 * Unlike the sound-effects provider, this sends a structured `composition_plan`
 * (sections mapped from the Gemini timeline) so the score's structure aligns with
 * the video arc. Always instrumental. Selected by MUSIC_PROVIDER=elevenmusic.
 */
export class ElevenMusicProvider implements MusicGenerationProvider {
  private apiKey: string;

  constructor() {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) {
      throw new Error(
        'ELEVENLABS_API_KEY is not set. Add it to .env.local or set MUSIC_PROVIDER=mock.'
      );
    }
    this.apiKey = key;
  }

  async generate(result: AnalysisResult): Promise<GeneratedScore> {
    const { analysis } = result;
    const plan = buildCompositionPlan(result);
    // Instrument spec drives downstream stem expectations (same source as the other providers).
    const { instrumentSpec } = buildBackendPrompt(result);

    const totalMs = plan.sections.reduce((sum, s) => sum + s.duration_ms, 0);
    const durationSeconds = Math.round((totalMs / 1000) * 10) / 10;

    console.log(
      `[ElevenMusic] ${plan.sections.length} sections, ${durationSeconds}s total`
    );
    console.log('[ElevenMusic] composition plan:', JSON.stringify(plan));

    const response = await fetch(`${ELEVENLABS_MUSIC_API}?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        model_id: MODEL_ID,
        respect_sections_durations: true,
        composition_plan: plan,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ElevenMusic] error body:', errorText);
      if (response.status === 403) {
        throw new Error(
          'ElevenLabs Music API access not enabled on this key. ' +
          'Enable "Music Generation" in your ElevenLabs dashboard, ' +
          'or set MUSIC_PROVIDER=sound-generation in .env.local to use the sound-effects endpoint (max 22s).'
        );
      }
      throw new Error(`ElevenLabs Music ${response.status}: ${errorText || '(empty response)'}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error('ElevenLabs Music returned an empty audio response.');
    }

    const id = generateId();
    const outputDir = path.join(process.cwd(), 'public', 'generated');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `${id}.mp3`), buffer);

    const sections: ScoreSection[] = plan.sections.map((s) => ({
      name: s.section_name,
      durationSeconds: Math.round((s.duration_ms / 1000) * 10) / 10,
      styles: s.positive_local_styles,
    }));

    // Human-readable serialization of the plan for the UI's "Generation Prompt" box.
    const prompt = [
      `Global: ${plan.positive_global_styles.join(', ')}`,
      ...plan.sections.map(
        (s) =>
          `[${s.section_name} · ${Math.round(s.duration_ms / 1000)}s] ${s.positive_local_styles.join(', ')}`
      ),
    ].join('\n');

    return {
      audioUrl: `/generated/${id}.mp3`,
      durationSeconds,
      bpm: analysis.bpm,
      genre: analysis.genre,
      mood: analysis.mood,
      filename: `score-${analysis.mood}-${analysis.bpm}bpm.mp3`,
      prompt,
      backendPrompt: JSON.stringify(plan),
      instrumentSpec,
      sections,
    };
  }
}
