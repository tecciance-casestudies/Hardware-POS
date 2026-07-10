'use client';

import * as React from 'react';

import { api } from './api';
import { Permission, permissionsForRole, type UserRole } from './permissions';

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
  user: SessionUser;
  branchName: string;
  registerName: string;
}

const STORAGE_KEY = 'hpos.session';
const DEV_TENANT = 'tnt_dev';

/** Seeded dev users — used for the mock-session quick logins. */
export const MOCK_USERS = {
  owner: { id: 'usr_owner', name: 'Owner', email: 'owner@hardwarepos.test', role: 'OWNER' },
  manager: { id: 'usr_manager', name: 'Manager', email: null, role: 'MANAGER' },
  cashier: { id: 'usr_cashier', name: 'Cashier', email: null, role: 'CASHIER' },
  accountant: {
    id: 'usr_accountant',
    name: 'Accountant',
    email: 'accountant@hardwarepos.test',
    role: 'ACCOUNTANT',
  },
} satisfies Record<string, { id: string; name: string; email: string | null; role: UserRole }>;

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: Permission) => boolean;
  loginMock: (key: keyof typeof MOCK_USERS) => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithPin: (pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function buildMockSession(key: keyof typeof MOCK_USERS): Session {
  const u = MOCK_USERS[key];
  return {
    token: `mock.${key}`,
    user: { ...u, tenantId: DEV_TENANT, permissions: permissionsForRole(u.role) },
    branchName: 'Main Branch',
    registerName: 'Register 1',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw) as Session);
    } catch {
      // ignore malformed storage
    }
    setLoading(false);
  }, []);

  const persist = React.useCallback((next: Session | null) => {
    setSession(next);
    if (typeof window === 'undefined') return;
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loginMock = React.useCallback(
    (key: keyof typeof MOCK_USERS) => persist(buildMockSession(key)),
    [persist],
  );

  const loginWithEmail = React.useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ token: string; user: Omit<SessionUser, 'permissions'> }>(
        '/auth/login',
        { email, password },
      );
      persist({
        token: res.token,
        user: { ...res.user, permissions: permissionsForRole(res.user.role) },
        branchName: 'Main Branch',
        registerName: 'Register 1',
      });
    },
    [persist],
  );

  const loginWithPin = React.useCallback(
    async (pin: string) => {
      const res = await api.post<{ token: string; user: Omit<SessionUser, 'permissions'> }>(
        '/auth/pin-login',
        { pin },
        { tenantId: DEV_TENANT },
      );
      persist({
        token: res.token,
        user: { ...res.user, permissions: permissionsForRole(res.user.role) },
        branchName: 'Main Branch',
        registerName: 'Register 1',
      });
    },
    [persist],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      isAuthenticated: !!session,
      hasPermission: (p) => !!session?.user.permissions.includes(p),
      loginMock,
      loginWithEmail,
      loginWithPin,
      logout: () => persist(null),
    }),
    [session, loading, loginMock, loginWithEmail, loginWithPin, persist],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
