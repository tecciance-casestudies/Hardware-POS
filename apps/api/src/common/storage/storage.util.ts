import { mkdirSync } from 'fs';
import { resolve } from 'path';

/** Public URL prefix under which uploaded files are served (outside the API version prefix). */
export const UPLOAD_URL_PREFIX = '/uploads';

/** Key prefix every newly stored image lands under. */
export const IMAGE_KEY_PREFIX = 'products';

// ── Tunable image / signing defaults ──
// Overridable via env (IMAGE_MAX_EDGE, IMAGE_WEBP_QUALITY, IMAGE_CACHE_MAX_AGE_SECONDS,
// S3_SIGNED_URL_TTL_SECONDS) and range-validated in config/env.validation.ts. Defined
// here so the storage layer and the env validation share one source of truth.
/** Default longest-edge cap (px) applied to every stored image. */
export const IMAGE_MAX_EDGE_DEFAULT = 780;
/** Default WebP encoder quality (1-100). */
export const IMAGE_WEBP_QUALITY_DEFAULT = 80;
/** Default lifetime (seconds) of a presigned S3 GET URL. */
export const SIGNED_URL_TTL_DEFAULT_SECONDS = 300;
/**
 * Default `Cache-Control: max-age` (seconds) on served images — how long a browser
 * keeps a downloaded image before re-fetching. 6h; keys are content-unique so a
 * higher value is safe, but a bounded one lets a re-created bucket (dev) recover.
 */
export const IMAGE_CACHE_MAX_AGE_DEFAULT_SECONDS = 6 * 60 * 60;

/**
 * Parse an integer environment variable, falling back when unset or blank.
 * Range validation lives in config/env.validation.ts (fail-fast at boot), so a
 * value reaching here is already known-valid; a non-integer still falls back
 * defensively rather than propagating NaN.
 */
export function readIntEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

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
