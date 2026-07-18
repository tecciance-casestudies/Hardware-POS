/** Fallback front-end origin used when WEB_ORIGIN is unset (local dev). */
const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

/**
 * Parse the comma-separated `WEB_ORIGIN` env var into a list of allowed
 * front-end origins for CORS (e.g. "https://axlopos.com,https://www.axlopos.com").
 * Whitespace is trimmed and empty entries dropped; falls back to the local dev
 * origin when unset. The FIRST entry is the canonical origin — see
 * {@link canonicalWebOrigin}.
 */
export function parseWebOrigins(raw: string | undefined): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : [DEFAULT_WEB_ORIGIN];
}

/**
 * The canonical (primary) front-end origin — the first `WEB_ORIGIN` entry. Use
 * this when the API must build a single redirect URL back to the app (e.g. the
 * post-OAuth QuickBooks landing page), where a list wouldn't make sense.
 */
export function canonicalWebOrigin(raw: string | undefined): string {
  return parseWebOrigins(raw)[0];
}
