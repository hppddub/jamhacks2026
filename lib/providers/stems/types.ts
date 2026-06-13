import type { StemResult } from '@/types';

export interface StemSeparationProvider {
  /** audioUrl is the relative public path, e.g. /generated/uuid.mp3 */
  separate(audioUrl: string): Promise<StemResult>;
}
