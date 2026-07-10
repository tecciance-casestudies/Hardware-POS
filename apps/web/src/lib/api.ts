/**
 * Thin API client for the NestJS backend. Attaches the session bearer token and
 * unwraps the standard `{ data }` envelope. Ready for real calls; the app uses a
 * mock session by default (see lib/auth), so screens render without a backend.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export interface ApiErrorShape {
  statusCode: number;
  message: string | string[];
  error: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorShape,
  ) {
    super(Array.isArray(body.message) ? body.message.join(', ') : body.message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  token?: string | null;
  tenantId?: string | null;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.tenantId) headers['x-tenant-id'] = opts.tenantId;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  });

  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, (json as ApiErrorShape) ?? { statusCode: res.status, message: res.statusText, error: 'Error' });
  }
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}

export const api = {
  baseUrl: BASE_URL,
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PUT', path, { ...opts, body }),
};
