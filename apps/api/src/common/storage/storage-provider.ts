/** Allowed image mime types mapped to file extensions. */
export const IMAGE_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const STORAGE_PROVIDER_KINDS = ['local', 's3'] as const;
export type StorageProviderKind = (typeof STORAGE_PROVIDER_KINDS)[number];

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
}

/**
 * How a stored object reaches the browser: a file this server streams itself,
 * or a short-lived URL it redirects to.
 */
export type ResolvedImage =
  | { kind: 'file'; path: string }
  | { kind: 'redirect'; url: string; maxAgeSeconds: number };

/**
 * Abstraction over WHERE uploaded files live (local disk, S3/LocalStack, ...).
 * Implementations persist a file and hand back the stored path recorded on the
 * record (`/uploads/<key>`, provider-neutral so switching backends doesn't
 * invalidate existing rows); `remove` accepts that same path and must ignore
 * paths it doesn't own; `resolve` turns a key back into something loadable.
 */
export interface StorageProvider {
  readonly kind: StorageProviderKind;
  /** Persist an uploaded image and return its stored path. */
  saveImage(file: UploadedImage): Promise<string>;
  /** Remove a previously stored file by its stored path (no-op if not ours). */
  remove(storedPath: string | null | undefined): Promise<void>;
  /** Turn an object key into a file to stream or a URL to redirect to. */
  resolve(key: string): Promise<ResolvedImage>;
}
