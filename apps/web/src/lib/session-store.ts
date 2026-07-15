/**
 * Session persistence shared by the auth context and the API client.
 * Lives outside React so `api.ts` can rotate tokens (refresh-on-401) and the
 * AuthProvider can observe the change without a circular import.
 */

import { Permission, type UserRole } from './permissions';

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  tenantId: string;
  permissions: Permission[];
}

export interface Session {
  token: string;
  /** Long-lived rotating token used to mint new access tokens on 401. */
  refreshToken?: string;
  user: SessionUser;
  branchName: string;
  registerName: string;
}

const STORAGE_KEY = 'hpos.session';

type Listener = (session: Session | null) => void;
const listeners = new Set<Listener>();

export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    // Stale sessions from the removed offline demo mode can't reach the API.
    if (parsed.token.startsWith('mock.')) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  if (typeof window !== 'undefined') {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((fn) => fn(session));
}

/** Observe session replacements (e.g. a token refresh performed by the API client). */
export function subscribeSession(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
