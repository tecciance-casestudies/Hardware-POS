import { mkdirSync } from 'fs';
import { resolve } from 'path';

/** Public URL prefix under which uploaded files are served (outside the API version prefix). */
export const UPLOAD_URL_PREFIX = '/uploads';

/** Key prefix every newly stored image lands under. */
export const IMAGE_KEY_PREFIX = 'products';

/**
 * Absolute directory where uploaded files are written and served from. Override
 * with `UPLOAD_DIR`; defaults to `<cwd>/uploads`. Created on first access.
 */
export function getUploadDir(): string {
  const dir = process.env.UPLOAD_DIR ? resolve(process.env.UPLOAD_DIR) : resolve(process.cwd(), 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * The value persisted on the record for an object key. Deliberately a relative
 * path rather than a provider-specific URL: it stays valid when STORAGE_PROVIDER
 * changes, and it never expires, so signing can happen per image request instead
 * of being baked into every API response.
 */
export function toStoredPath(key: string): string {
  return `${UPLOAD_URL_PREFIX}/${key}`;
}

/**
 * Object key behind a stored path, or null when the value isn't one of ours —
 * an absolute URL from an older S3 deployment, a `data:` URI, or an empty column.
 */
export function toObjectKey(storedPath: string | null | undefined): string | null {
  if (!storedPath || !storedPath.startsWith(`${UPLOAD_URL_PREFIX}/`)) return null;
  return sanitizeKey(storedPath.slice(UPLOAD_URL_PREFIX.length + 1));
}

/**
 * Validate a key that reached us from a request URL. Keys are used to build
 * filesystem paths, so anything that could escape the upload directory — `..`,
 * a leading slash, a backslash, a NUL — has to be rejected outright.
 */
export function sanitizeKey(key: string | null | undefined): string | null {
  if (!key || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key)) return null;
  const segments = key.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return null;
  return key;
}
