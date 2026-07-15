'use client';

import * as React from 'react';

import { api } from './api';
import { Permission, permissionsForRole } from './permissions';
import {
  loadSession,
  saveSession,
  subscribeSession,
  type Session,
  type SessionUser,
} from './session-store';

export type { Session, SessionUser };

const DEV_TENANT = 'tnt_dev';

interface LoginResponse {
  token: string;
  refreshToken: string;
  user: Omit<SessionUser, 'permissions'>;
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: Permission) => boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithPin: (pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function toSession(res: LoginResponse): Session {
  return {
    token: res.token,
    refreshToken: res.refreshToken,
    user: { ...res.user, permissions: permissionsForRole(res.user.role) },
    branchName: 'Main Branch',
    registerName: 'Register 1',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setSession(loadSession());
    setLoading(false);
    // Keep React state in step with store writes (e.g. refresh-on-401 rotations).
    return subscribeSession(setSession);
  }, []);

  const loginWithEmail = React.useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { email, password });
    saveSession(toSession(res));
  }, []);

  const loginWithPin = React.useCallback(async (pin: string) => {
    const res = await api.post<LoginResponse>(
      '/auth/pin-login',
      { pin },
      { tenantId: DEV_TENANT },
    );
    saveSession(toSession(res));
  }, []);

  const logout = React.useCallback(() => {
    const current = loadSession();
    // Best-effort server-side revocation; local sign-out never waits on it.
    if (current?.refreshToken) {
      void api
        .post('/auth/logout', { refreshToken: current.refreshToken })
        .catch(() => undefined);
    }
    saveSession(null);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      isAuthenticated: !!session,
      hasPermission: (p) => !!session?.user.permissions.includes(p),
      loginWithEmail,
      loginWithPin,
      logout,
    }),
    [session, loading, loginWithEmail, loginWithPin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
