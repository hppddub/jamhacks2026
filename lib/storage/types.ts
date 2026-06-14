/**
 * Durable file storage abstraction. Concrete providers are imported only by
 * `factory.ts` (same pattern as the analysis/music/stem provider factories).
 *
 * Callers pass a `key` (storage-relative path, e.g. `{projectId}/score.mp3`) and
 * receive back a public URL to persist alongside the project row.
 */
export interface StorageProvider {
  /** Upload a local file to durable storage; returns its public URL. */
  upload(localPath: string, key: string, contentType: string): Promise<string>;
  /** Upload in-memory bytes (e.g. a rendered master) to durable storage; returns its public URL. */
  uploadBytes(data: Buffer, key: string, contentType: string): Promise<string>;
  /** Best-effort delete by the URL previously returned from upload/uploadBytes. */
  delete(url: string): Promise<void>;
}
